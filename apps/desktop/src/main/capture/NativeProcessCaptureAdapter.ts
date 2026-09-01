import { accessSync, constants } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import {
  helperMessageSchema,
  type FocusSessionConfig,
  type HelperCommand,
  type PermissionStatus,
  type Platform
} from "@mirror/contracts";
import type { CaptureAdapter, CaptureEventHandler } from "./CaptureAdapter.js";

const START_TIMEOUT_MS = 5_000;

export class NativeProcessCaptureAdapter implements CaptureAdapter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private onEvent: CaptureEventHandler | null = null;
  private readonly seenStatuses = new Set<string>();

  constructor(
    readonly platform: Platform,
    readonly name: string,
    private readonly executablePath: string,
    private readonly args: string[] = []
  ) {}

  isAvailable(): boolean {
    try {
      accessSync(this.executablePath, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  }

  async getPermissionStatus(): Promise<PermissionStatus> {
    return this.isAvailable() ? "unknown" : "not-determined";
  }

  async start(
    sessionId: string,
    _config: FocusSessionConfig,
    onEvent: CaptureEventHandler
  ): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error(`${this.name} is not available at ${this.executablePath}`);
    }

    await this.stop();
    this.seenStatuses.clear();
    this.onEvent = onEvent;
    this.child = spawn(this.executablePath, this.args, {
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.lines = createInterface({ input: this.child.stdout });
    this.lines.on("line", (line) => this.handleLine(line));
    this.child.stderr.on("data", (chunk: Buffer) => {
      console.error(`[${this.name}] ${chunk.toString().trim()}`);
    });

    await this.waitForStatus("ready");
    this.send({ command: "start", sessionId });
    await this.waitForStatus("started");
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;

    if (!child.killed) {
      this.send({ command: "stop" });
      child.kill("SIGTERM");
    }

    this.lines?.close();
    this.lines = null;
    this.child = null;
    this.onEvent = null;
    this.seenStatuses.clear();
  }

  private send(command: HelperCommand): void {
    if (!this.child?.stdin.writable) {
      throw new Error(`${this.name} process is not writable`);
    }
    this.child.stdin.write(`${JSON.stringify(command)}\n`);
  }

  private handleLine(line: string): void {
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      console.error(`[${this.name}] Invalid JSON: ${line}`);
      return;
    }

    const parsed = helperMessageSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`[${this.name}] Invalid protocol message`, parsed.error.flatten());
      return;
    }

    if (parsed.data.kind === "event") {
      this.onEvent?.(parsed.data.event);
    } else if (parsed.data.kind === "status") {
      this.seenStatuses.add(parsed.data.status);
    } else if (parsed.data.kind === "error") {
      console.error(`[${this.name}] ${parsed.data.code}: ${parsed.data.message}`);
    }
  }

  private waitForStatus(expected: "ready" | "started"): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.seenStatuses.has(expected)) {
        resolve();
        return;
      }

      if (!this.lines || !this.child) {
        reject(new Error(`${this.name} process is not running`));
        return;
      }

      const cleanup = (): void => {
        clearTimeout(timeout);
        this.lines?.off("line", listener);
        this.child?.off("exit", exitListener);
      };
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`${this.name} did not report ${expected}`));
      }, START_TIMEOUT_MS);

      const listener = (line: string): void => {
        try {
          const message = helperMessageSchema.parse(JSON.parse(line));
          if (message.kind === "status" && message.status === expected) {
            cleanup();
            resolve();
          }
        } catch {
          // The main protocol handler reports malformed messages.
        }
      };

      const exitListener = (code: number | null): void => {
        cleanup();
        reject(new Error(`${this.name} exited with code ${code ?? "unknown"}`));
      };

      this.lines.on("line", listener);
      this.child.once("exit", exitListener);
    });
  }
}

import { appendFile, mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  CaptureEvent,
  CompletedSession,
  FocusSessionConfig,
  PrivacySettings
} from "@mirror/contracts";
import { toSessionCreatePayload } from "@mirror/contracts";

export interface SessionRepository {
  begin(sessionId: string, config: FocusSessionConfig, privacy: PrivacySettings, startedAt: string): Promise<void>;
  append(event: CaptureEvent): Promise<void>;
  complete(session: CompletedSession): Promise<void>;
}

export class LocalSessionRepository implements SessionRepository {
  constructor(private readonly rootDirectory: string) {}

  async begin(
    sessionId: string,
    config: FocusSessionConfig,
    privacy: PrivacySettings,
    startedAt: string
  ): Promise<void> {
    const directory = this.sessionDirectory(sessionId);
    await mkdir(directory, { recursive: true });
    await this.writeJsonAtomic(join(directory, "session.json"), {
      schemaVersion: 1,
      sessionId,
      status: "running",
      config,
      createPayload: toSessionCreatePayload(config),
      privacy,
      startedAt
    });
  }

  async append(event: CaptureEvent): Promise<void> {
    await appendFile(
      join(this.sessionDirectory(event.sessionId), "events.ndjson"),
      `${JSON.stringify(event)}\n`,
      "utf8"
    );
  }

  async complete(session: CompletedSession): Promise<void> {
    await this.writeJsonAtomic(join(this.sessionDirectory(session.sessionId), "completed.json"), {
      schemaVersion: 1,
      ...session
    });
  }

  private sessionDirectory(sessionId: string): string {
    return join(this.rootDirectory, "sessions", sessionId);
  }

  private async writeJsonAtomic(path: string, value: unknown): Promise<void> {
    const temporaryPath = `${path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, path);
  }
}

export class MemorySessionRepository implements SessionRepository {
  readonly events: CaptureEvent[] = [];
  completed: CompletedSession | null = null;

  async begin(): Promise<void> {
    this.events.length = 0;
    this.completed = null;
  }

  async append(event: CaptureEvent): Promise<void> {
    this.events.push(event);
  }

  async complete(session: CompletedSession): Promise<void> {
    this.completed = session;
  }
}

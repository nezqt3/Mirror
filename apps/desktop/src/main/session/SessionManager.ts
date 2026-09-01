import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  captureEventSchema,
  focusSessionConfigSchema,
  type CaptureEvent,
  type CompletedSession,
  type FocusSessionConfig,
  type SessionState
} from "@mirror/contracts";
import type { CaptureAdapter } from "../capture/CaptureAdapter.js";

export class SessionManager extends EventEmitter {
  private readonly events: CaptureEvent[] = [];
  private state: SessionState = {
    status: "idle",
    sessionId: null,
    config: null,
    startedAt: null,
    eventCount: 0,
    error: null
  };

  constructor(private readonly capture: CaptureAdapter) {
    super();
  }

  getState(): SessionState {
    return structuredClone(this.state);
  }

  async start(input: FocusSessionConfig): Promise<SessionState> {
    if (this.state.status !== "idle" && this.state.status !== "failed") {
      throw new Error("A Focus Session is already active");
    }

    const config = focusSessionConfigSchema.parse(input);
    const sessionId = randomUUID();
    const startedAt = new Date().toISOString();
    this.events.length = 0;
    this.setState({
      status: "starting",
      sessionId,
      config,
      startedAt,
      eventCount: 0,
      error: null
    });

    try {
      await this.capture.start(sessionId, config, (event) => this.acceptEvent(event));
      this.setState({ ...this.state, status: "running" });
      return this.getState();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown capture error";
      this.setState({ ...this.state, status: "failed", error: message });
      throw error;
    }
  }

  async stop(): Promise<CompletedSession> {
    if (
      this.state.status !== "running" ||
      !this.state.sessionId ||
      !this.state.config ||
      !this.state.startedAt
    ) {
      throw new Error("There is no running Focus Session");
    }

    const { sessionId, config, startedAt } = this.state;
    this.setState({ ...this.state, status: "stopping" });
    await this.capture.stop();

    const completed: CompletedSession = {
      sessionId,
      config,
      startedAt,
      endedAt: new Date().toISOString(),
      eventCount: this.events.length
    };

    this.setState({
      status: "idle",
      sessionId: null,
      config: null,
      startedAt: null,
      eventCount: 0,
      error: null
    });
    return completed;
  }

  private acceptEvent(input: CaptureEvent): void {
    const event = captureEventSchema.parse(input);
    if (event.sessionId !== this.state.sessionId || this.state.status === "idle") return;

    this.events.push(event);
    this.setState({ ...this.state, eventCount: this.events.length });
  }

  private setState(next: SessionState): void {
    this.state = next;
    this.emit("state-changed", this.getState());
  }
}

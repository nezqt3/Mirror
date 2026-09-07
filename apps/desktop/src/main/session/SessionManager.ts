import { randomUUID } from "node:crypto";
import { EventEmitter } from "events";
import {
  DEFAULT_PRIVACY_SETTINGS,
  captureEventSchema,
  focusSessionConfigSchema,
  privacySettingsSchema,
  type CaptureEvent,
  type CompletedSession,
  type FocusSessionConfigInput,
  type PrivacySettings,
  type SessionState
} from "@mirror/contracts";
import type { CaptureAdapter } from "../capture/CaptureAdapter.js";
import { applyCapturePolicy } from "../privacy/CapturePolicy.js";
import {
  MemorySessionRepository,
  type SessionRepository
} from "../storage/SessionRepository.js";

export class SessionManager extends EventEmitter {
  private state: SessionState = {
    status: "idle",
    sessionId: null,
    config: null,
    startedAt: null,
    plannedEndsAt: null,
    eventCount: 0,
    error: null
  };
  private privacy: PrivacySettings = structuredClone(DEFAULT_PRIVACY_SETTINGS);
  private deadlineTimer: NodeJS.Timeout | null = null;
  private persistenceQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly capture: CaptureAdapter,
    private readonly repository: SessionRepository = new MemorySessionRepository()
  ) {
    super();
  }

  getState(): SessionState {
    return structuredClone(this.state);
  }

  async start(
    input: FocusSessionConfigInput,
    privacyInput: PrivacySettings = DEFAULT_PRIVACY_SETTINGS
  ): Promise<SessionState> {
    if (this.state.status !== "idle" && this.state.status !== "failed") {
      throw new Error("A Focus Session is already active");
    }

    const config = focusSessionConfigSchema.parse(input);
    const privacy = privacySettingsSchema.parse(privacyInput);
    const permission = await this.capture.requestPermissions(config, privacy);
    if (permission !== "granted") {
      throw new Error(
        "Mirror needs Accessibility and Screen Recording permission. Grant access in System Settings, then try again."
      );
    }
    const sessionId = randomUUID();
    const started = new Date();
    const startedAt = started.toISOString();
    const plannedEndsAt = new Date(
      started.getTime() + config.durationMinutes * 60_000
    ).toISOString();
    this.clearDeadline();
    this.privacy = privacy;
    this.persistenceQueue = Promise.resolve();
    this.setState({
      status: "starting",
      sessionId,
      config,
      startedAt,
      plannedEndsAt,
      eventCount: 0,
      error: null
    });

    try {
      await this.repository.begin(sessionId, config, privacy, startedAt);
      await this.capture.start(sessionId, config, privacy, (event) => this.acceptEvent(event));
      this.setState({ ...this.state, status: "running" });
      this.deadlineTimer = setTimeout(() => {
        void this.stop("timer").catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Unable to finish timed session";
          this.setState({ ...this.state, status: "failed", error: message });
        });
      }, Math.max(0, new Date(plannedEndsAt).getTime() - Date.now()));
      return this.getState();
    } catch (error) {
      this.clearDeadline();
      const message = error instanceof Error ? error.message : "Unknown capture error";
      this.setState({ ...this.state, status: "failed", error: message });
      throw error;
    }
  }

  async stop(endReason: CompletedSession["endReason"] = "user"): Promise<CompletedSession> {
    if (
      this.state.status !== "running" ||
      !this.state.sessionId ||
      !this.state.config ||
      !this.state.startedAt
    ) {
      throw new Error("There is no running Focus Session");
    }

    const { sessionId, config, startedAt, eventCount } = this.state;
    this.clearDeadline();
    this.setState({ ...this.state, status: "stopping" });
    await this.capture.stop();
    await this.persistenceQueue;

    const completed: CompletedSession = {
      sessionId,
      config,
      startedAt,
      endedAt: new Date().toISOString(),
      endReason,
      eventCount
    };
    await this.repository.complete(completed);

    this.setState({
      status: "idle",
      sessionId: null,
      config: null,
      startedAt: null,
      plannedEndsAt: null,
      eventCount: 0,
      error: null
    });
    return completed;
  }

  private acceptEvent(input: CaptureEvent): void {
    const event = captureEventSchema.parse(input);
    if (event.sessionId !== this.state.sessionId || this.state.status === "idle") return;

    const allowedEvent = applyCapturePolicy(event, this.privacy);
    if (!allowedEvent) return;

    this.persistenceQueue = this.persistenceQueue.then(() => this.repository.append(allowedEvent));
    this.setState({ ...this.state, eventCount: this.state.eventCount + 1 });
  }

  private clearDeadline(): void {
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    this.deadlineTimer = null;
  }

  private setState(next: SessionState): void {
    this.state = next;
    this.emit("state-changed", this.getState());
  }
}

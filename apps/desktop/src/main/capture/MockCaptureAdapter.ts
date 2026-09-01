import { randomUUID } from "node:crypto";
import type {
  CaptureEvent,
  FocusSessionConfig,
  PermissionStatus,
  Platform
} from "@mirror/contracts";
import type { CaptureAdapter, CaptureEventHandler } from "./CaptureAdapter.js";

export class MockCaptureAdapter implements CaptureAdapter {
  readonly platform: Platform = "mock";
  readonly name = "mock-capture";
  private timer: NodeJS.Timeout | null = null;

  isAvailable(): boolean {
    return true;
  }

  async getPermissionStatus(): Promise<PermissionStatus> {
    return "granted";
  }

  async start(
    sessionId: string,
    _config: FocusSessionConfig,
    onEvent: CaptureEventHandler
  ): Promise<void> {
    await this.stop();

    const emitHeartbeat = (): void => {
      const event: CaptureEvent = {
        id: randomUUID(),
        sessionId,
        type: "heartbeat",
        timestamp: new Date().toISOString(),
        platform: this.platform,
        source: this.name,
        payload: { mode: "development-fallback" }
      };
      onEvent(event);
    };

    emitHeartbeat();
    this.timer = setInterval(emitHeartbeat, 5_000);
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

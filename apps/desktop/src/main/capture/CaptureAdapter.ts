import type {
  CaptureEvent,
  FocusSessionConfig,
  PermissionStatus,
  Platform
} from "@mirror/contracts";

export type CaptureEventHandler = (event: CaptureEvent) => void;

export interface CaptureAdapter {
  readonly platform: Platform;
  readonly name: string;
  isAvailable(): boolean;
  getPermissionStatus(): Promise<PermissionStatus>;
  start(
    sessionId: string,
    config: FocusSessionConfig,
    onEvent: CaptureEventHandler
  ): Promise<void>;
  stop(): Promise<void>;
}

import type {
  CaptureEvent,
  FocusSessionConfig,
  InstalledApplication,
  PermissionStatus,
  Platform,
  PrivacySettings
} from "@mirror/contracts";

export type CaptureEventHandler = (event: CaptureEvent) => void;

export interface CaptureAdapter {
  readonly platform: Platform;
  readonly name: string;
  isAvailable(): boolean;
  requestPermissions(
    config: FocusSessionConfig,
    privacy: PrivacySettings
  ): Promise<PermissionStatus>;
  listApplications(): Promise<InstalledApplication[]>;
  start(
    sessionId: string,
    config: FocusSessionConfig,
    privacy: PrivacySettings,
    onEvent: CaptureEventHandler
  ): Promise<void>;
  stop(): Promise<void>;
}

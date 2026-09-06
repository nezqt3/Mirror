import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  installedApplicationSchema,
  privacySettingsSchema,
  sessionStateSchema,
  type FocusSessionConfigInput,
  type MirrorDesktopApi,
  type PrivacySettings,
  type SessionState
} from "@mirror/contracts";

const api: MirrorDesktopApi = {
  startSession: (config: FocusSessionConfigInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.sessionStart, config),
  stopSession: () => ipcRenderer.invoke(IPC_CHANNELS.sessionStop),
  getSessionState: () => ipcRenderer.invoke(IPC_CHANNELS.sessionGetState),
  listApplications: async () =>
    installedApplicationSchema.array().parse(
      await ipcRenderer.invoke(IPC_CHANNELS.applicationsList)
    ),
  getPrivacySettings: async () =>
    privacySettingsSchema.parse(await ipcRenderer.invoke(IPC_CHANNELS.privacyGetSettings)),
  savePrivacySettings: async (settings: PrivacySettings) =>
    privacySettingsSchema.parse(
      await ipcRenderer.invoke(IPC_CHANNELS.privacySaveSettings, settings)
    ),
  onSessionStateChanged: (listener: (state: SessionState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
      const parsed = sessionStateSchema.safeParse(raw);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.sessionStateChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.sessionStateChanged, handler);
  }
};

contextBridge.exposeInMainWorld("mirror", api);

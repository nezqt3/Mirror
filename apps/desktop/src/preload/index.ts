import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  sessionStateSchema,
  type FocusSessionConfig,
  type MirrorDesktopApi,
  type SessionState
} from "@mirror/contracts";

const api: MirrorDesktopApi = {
  startSession: (config: FocusSessionConfig) =>
    ipcRenderer.invoke(IPC_CHANNELS.sessionStart, config),
  stopSession: () => ipcRenderer.invoke(IPC_CHANNELS.sessionStop),
  getSessionState: () => ipcRenderer.invoke(IPC_CHANNELS.sessionGetState),
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

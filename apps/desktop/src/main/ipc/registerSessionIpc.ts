import { BrowserWindow, ipcMain } from "electron";
import {
  focusSessionConfigSchema,
  IPC_CHANNELS,
  type SessionState
} from "@mirror/contracts";
import type { SessionManager } from "../session/SessionManager.js";

export function registerSessionIpc(sessionManager: SessionManager): () => void {
  ipcMain.handle(IPC_CHANNELS.sessionStart, (_event, input: unknown) =>
    sessionManager.start(focusSessionConfigSchema.parse(input))
  );
  ipcMain.handle(IPC_CHANNELS.sessionStop, () => sessionManager.stop());
  ipcMain.handle(IPC_CHANNELS.sessionGetState, () => sessionManager.getState());

  const broadcastState = (state: SessionState): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC_CHANNELS.sessionStateChanged, state);
    }
  };
  sessionManager.on("state-changed", broadcastState);

  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.sessionStart);
    ipcMain.removeHandler(IPC_CHANNELS.sessionStop);
    ipcMain.removeHandler(IPC_CHANNELS.sessionGetState);
    sessionManager.off("state-changed", broadcastState);
  };
}

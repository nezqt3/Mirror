import { BrowserWindow, ipcMain } from "electron";
import {
  focusSessionConfigSchema,
  IPC_CHANNELS,
  privacySettingsSchema,
  type SessionState
} from "@mirror/contracts";
import type { SessionManager } from "../session/SessionManager.js";
import type { CaptureAdapter } from "../capture/CaptureAdapter.js";
import type { SettingsRepository } from "../storage/SettingsRepository.js";

export function registerSessionIpc(
  sessionManager: SessionManager,
  settingsRepository: SettingsRepository,
  captureAdapter: CaptureAdapter
): () => void {
  ipcMain.handle(IPC_CHANNELS.sessionStart, async (_event, input: unknown) => {
    const privacy = await settingsRepository.getPrivacySettings();
    return sessionManager.start(focusSessionConfigSchema.parse(input), privacy);
  });
  ipcMain.handle(IPC_CHANNELS.sessionStop, () => sessionManager.stop());
  ipcMain.handle(IPC_CHANNELS.sessionGetState, () => sessionManager.getState());
  ipcMain.handle(IPC_CHANNELS.privacyGetSettings, () =>
    settingsRepository.getPrivacySettings()
  );
  ipcMain.handle(IPC_CHANNELS.privacySaveSettings, (_event, input: unknown) =>
    settingsRepository.savePrivacySettings(privacySettingsSchema.parse(input))
  );
  ipcMain.handle(IPC_CHANNELS.applicationsList, () => captureAdapter.listApplications());

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
    ipcMain.removeHandler(IPC_CHANNELS.privacyGetSettings);
    ipcMain.removeHandler(IPC_CHANNELS.privacySaveSettings);
    ipcMain.removeHandler(IPC_CHANNELS.applicationsList);
    sessionManager.off("state-changed", broadcastState);
  };
}

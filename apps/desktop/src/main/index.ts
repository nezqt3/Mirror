import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { createCaptureAdapter } from "./capture/createCaptureAdapter.js";
import { registerSessionIpc } from "./ipc/registerSessionIpc.js";
import { SessionManager } from "./session/SessionManager.js";

let mainWindow: BrowserWindow | null = null;
let disposeIpc: (() => void) | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 940,
    minHeight: 620,
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0b0d12",
    webPreferences: {
      preload: join(__dirname, "../preload/index.cjs"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`Preload failed at ${preloadPath}`, error);
  });
  if (!app.isPackaged) {
    mainWindow.webContents.once("did-finish-load", () => {
      void mainWindow?.webContents
        .executeJavaScript("Boolean(window.mirror)")
        .then((available: boolean) => console.info(`Desktop bridge ready: ${available}`));
    });
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

void app.whenReady().then(() => {
  const sessionManager = new SessionManager(createCaptureAdapter());
  disposeIpc = registerSessionIpc(sessionManager);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  disposeIpc?.();
  disposeIpc = null;
});

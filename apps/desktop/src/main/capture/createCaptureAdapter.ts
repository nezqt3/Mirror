import { app } from "electron";
import { resolve } from "node:path";
import type { CaptureAdapter } from "./CaptureAdapter.js";
import { MockCaptureAdapter } from "./MockCaptureAdapter.js";
import { NativeProcessCaptureAdapter } from "./NativeProcessCaptureAdapter.js";

function nativeRoot(): string {
  return app.isPackaged
    ? resolve(process.resourcesPath, "native")
    : resolve(__dirname, "../../../../native");
}

export function createCaptureAdapter(): CaptureAdapter {
  const fallback = new MockCaptureAdapter();

  if (process.platform === "darwin") {
    const executable =
      process.env.MIRROR_MACOS_HELPER_PATH ??
      resolve(nativeRoot(), "macos-capture/.build/release/mirror-capture-macos");
    const adapter = new NativeProcessCaptureAdapter(
      "macos",
      "swift-capture-helper",
      executable
    );
    return adapter.isAvailable() ? adapter : fallback;
  }

  if (process.platform === "win32") {
    const executable =
      process.env.MIRROR_WINDOWS_HELPER_PATH ??
      resolve(
        nativeRoot(),
        "windows-capture/bin/Release/net8.0-windows/MirrorCapture.Helper.exe"
      );
    const adapter = new NativeProcessCaptureAdapter(
      "windows",
      "dotnet-capture-helper",
      executable
    );
    return adapter.isAvailable() ? adapter : fallback;
  }

  return fallback;
}

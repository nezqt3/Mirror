/// <reference types="vite/client" />

import type { MirrorDesktopApi } from "@mirror/contracts";

declare global {
  interface Window {
    mirror: MirrorDesktopApi;
  }
}

export {};

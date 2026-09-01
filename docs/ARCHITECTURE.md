# Mirror Architecture

This document records the initial production-oriented boundary design for the desktop application.

## Repository layout

```text
Mirror/
├── apps/
│   └── desktop/                 Electron application
│       └── src/
│           ├── main/            Trusted orchestration process
│           │   ├── capture/     Platform adapters and helper transport
│           │   ├── ipc/         Allowlisted renderer operations
│           │   └── session/     Focus Session lifecycle
│           ├── preload/         Narrow contextBridge API
│           └── renderer/        React + TypeScript UI
├── packages/
│   └── contracts/               Runtime-validated cross-process contracts
├── native/
│   ├── macos-capture/           Swift system-capture helper
│   └── windows-capture/         C#/.NET system-capture helper
└── docs/                        Architecture and decisions
```

## Trust boundaries

```mermaid
flowchart LR
    subgraph Untrusted_UI[Sandboxed renderer]
        UI[React UI]
    end

    subgraph Trusted_Desktop[Trusted desktop processes]
        PRELOAD[Allowlisted preload bridge]
        MAIN[Electron main]
        BUFFER[Local session buffer]
    end

    subgraph Native[Least-privilege native helpers]
        MAC[Swift / macOS]
        WIN[C# or Node-API / Windows]
    end

    UI --> PRELOAD --> MAIN
    MAIN <--> MAC
    MAIN <--> WIN
    MAIN --> BUFFER
    BUFFER --> API[Remote API]
```

The renderer is treated as untrusted. It has no Node.js integration and cannot spawn processes or access native APIs. The preload bridge exposes only typed Focus Session operations. Native helpers run as separate processes, receive commands over stdin, and emit newline-delimited JSON over stdout.

## Native helper protocol

All commands and responses are defined in `@mirror/contracts` and validated at runtime.

Commands:

- `start` with a Focus Session UUID;
- `stop`;
- `permissions`;
- `ping`.

Messages:

- `status` for helper lifecycle and permissions;
- `event` containing one normalized capture event;
- `error` containing a stable error code and safe message.

Platform-specific payloads are allowed only inside `event.payload`. Identity, session, time, event type, platform, and source fields remain stable across platforms.

## Scaling rules

1. New renderer features use the preload API; they do not import Electron or Node.js directly.
2. New system-capture capabilities are added behind `CaptureAdapter`.
3. Cross-process data changes begin in `@mirror/contracts` and include validation tests.
4. Native helpers never receive authentication tokens or backend credentials.
5. Raw capture data is buffered locally per session and uploaded only through a dedicated backend gateway.
6. Analysis, storage, and sync remain outside the capture layer so each can evolve independently.

## Next architectural slices

- encrypted local event store with retention policies;
- backend gateway with resumable session upload;
- permissions onboarding for macOS and Windows;
- screenshot capture behind an explicit per-session capability;
- application and website blacklist enforcement before persistence;
- structured observability with privacy-safe diagnostics;
- signed and packaged native helpers for production distribution.

## Containerized desktop build

The Electron workspace includes a multi-stage Dockerfile for reproducible CI verification and bundle generation. It intentionally builds artifacts rather than attempting to run the desktop GUI inside a container.

```bash
# Run type checking and tests inside the image build.
docker build -f apps/desktop/Dockerfile --target verify .

# Build the Electron bundle and produce the minimal artifact image.
docker build -f apps/desktop/Dockerfile --target artifact -t mirror-desktop-build .

# Copy compiled artifacts to the host without running Electron in Docker.
container_id=$(docker create mirror-desktop-build)
docker cp "$container_id:/opt/mirror" ./docker-artifacts
docker rm "$container_id"
```

Native Swift and C# helpers are built and signed on their target operating systems. They are deliberately kept outside the Linux Electron bundle produced by this Dockerfile.

The repository-level Compose configuration connects both useful Dockerfile targets:

```bash
# Build the minimal image containing compiled Electron artifacts.
docker compose build desktop-build

# Print the artifact files produced by the default service.
docker compose run --rm desktop-build

# Run the containerized typecheck and test build stage.
docker compose --profile verify build desktop-verify
```

# syntax=docker/dockerfile:1.7

# Build context must be the repository root:
# docker build -f apps/desktop/Dockerfile --target artifact .

FROM node:22-bookworm-slim AS dependencies

WORKDIR /workspace

ENV CI=true

COPY package.json package-lock.json .npmrc ./
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/contracts/package.json packages/contracts/package.json

RUN --mount=type=cache,target=/root/.npm \
    npm ci

FROM dependencies AS source

COPY tsconfig.base.json ./
COPY apps/desktop apps/desktop
COPY packages/contracts packages/contracts

FROM source AS verify

RUN npm run typecheck && npm test

FROM source AS build

RUN npm run build

FROM node:22-bookworm-slim AS artifact

WORKDIR /opt/mirror

COPY --from=build /workspace/apps/desktop/out ./desktop
COPY --from=build /workspace/packages/contracts/dist ./contracts

LABEL org.opencontainers.image.title="Mirror Desktop Build"
LABEL org.opencontainers.image.description="Compiled Electron, React, and shared contract artifacts"
LABEL org.opencontainers.image.licenses="MIT"

CMD ["sh", "-c", "find /opt/mirror -type f -print"]

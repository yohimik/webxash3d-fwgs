FROM --platform=linux/amd64 node:22-alpine AS client

RUN npm install -g pnpm

WORKDIR /client

COPY docker/hl-web-server/package.json docker/hl-web-server/package.json
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
COPY pnpm-workspace.yaml pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY docker/cs-web-server/vite.config.ts docker/hl-web-server/vite.config.ts
COPY packages/xash3d-fwgs packages/xash3d-fwgs
COPY packages/hlsdk-portable packages/hlsdk-portable
COPY docker/cs-web-server/tsconfig.json docker/hl-web-server/tsconfig.json
COPY docker/cs-web-server/src/client docker/hl-web-server/src/client
COPY docker/hl-web-server/src/client/config.ts docker/hl-web-server/src/client/config.ts

WORKDIR /client/docker/hl-web-server

RUN pnpm run build

FROM yohimik/cs-web-server:latest

COPY --from=client /client/docker/hl-web-server/src/client/dist ./public

# Start server
ENTRYPOINT ["./xash", "+ip", "0.0.0.0", "-port", "27015"]

# Default start parameters
CMD ["+map crossfire", "+maxplayers", "16"]
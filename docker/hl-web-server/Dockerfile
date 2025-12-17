FROM debian:trixie-slim AS engine

RUN dpkg --add-architecture i386
RUN apt update && apt upgrade -y && apt -y --no-install-recommends install aptitude
RUN aptitude -y --without-recommends install git ca-certificates build-essential gcc-multilib g++-multilib libbsd-dev:i386 libsdl2-dev:i386 libfreetype-dev:i386 libopus-dev:i386 libbz2-dev:i386 libvorbis-dev:i386 libopusfile-dev:i386 libogg-dev:i386

ENV PKG_CONFIG_PATH=/usr/lib/i386-linux-gnu/pkgconfig

WORKDIR /xash

RUN git clone --branch go --single-branch https://github.com/yohimik/xash3d-fwgs . \
    && git submodule update --init --recursive

RUN ./waf configure -T release -d --enable-lto --enable-openmp && ./waf build

FROM golang:1.25.1 AS go

WORKDIR /go
COPY docker/hl-web-server/go.mod go.mod
COPY docker/hl-web-server/go.sum go.sum
RUN go mod download
RUN mkdir -p ../github.com/yohimik/goxash3d-fwgs
RUN cp -r $(go list -m -f '{{.Dir}}' github.com/yohimik/goxash3d-fwgs)/* ../github.com/yohimik/goxash3d-fwgs
RUN echo 'replace github.com/yohimik/goxash3d-fwgs => ../github.com/yohimik/goxash3d-fwgs' >> go.mod

COPY docker/hl-web-server/src/server src/server
COPY --from=engine /xash/build/engine/libxash.a ../github.com/yohimik/goxash3d-fwgs/pkg/libxash.a
COPY --from=engine /xash/build/public/libbuild_vcs.a ../github.com/yohimik/goxash3d-fwgs/pkg/libbuild_vcs.a
COPY --from=engine /xash/build/public/libpublic.a ../github.com/yohimik/goxash3d-fwgs/pkg/libpublic.a
COPY --from=engine /xash/build/3rdparty/libbacktrace/libbacktrace.a ../github.com/yohimik/goxash3d-fwgs/pkg/libbacktrace.a

ENV GOARCH=386
ENV CC="gcc -m32 -D__i386__"
ENV CGO_CFLAGS="-fopenmp -m32"
ENV CGO_LDFLAGS="-fopenmp -m32"
RUN go build -o ./xash ./src/server


FROM debian:trixie-slim AS hlds

ARG hlds_build=8308
ARG hlds_url="https://github.com/DevilBoy-eXe/hlds/releases/download/$hlds_build/hlds_build_$hlds_build.zip"

RUN groupadd -r xash && useradd -r -g xash -m -d /opt/xash xash
RUN usermod -a -G games xash

RUN apt-get -y update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    unzip \
    && apt-get -y clean

USER xash
WORKDIR /opt/xash
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN mkdir -p /opt/xash/xashds

RUN curl -sLJO "$hlds_url" \
    && unzip "hlds_build_$hlds_build.zip" -d "/opt/xash/hlds_build_$hlds_build" \
    && cp -R "hlds_build_$hlds_build/hlds"/* xashds/ \
    && rm -rf "hlds_build_$hlds_build" "hlds_build_$hlds_build.zip"

# Fix warnings:
# couldn't exec listip.cfg
# couldn't exec banned.cfg
RUN touch /opt/xash/xashds/valve/listip.cfg
RUN touch /opt/xash/xashds/valve/banned.cfg

WORKDIR /opt/xash/xashds

# Copy default config
COPY docker/hl-web-server/configs/valve valve

FROM --platform=linux/amd64 node:22-alpine AS client

RUN npm install -g pnpm

WORKDIR /client

COPY docker/hl-web-server/package.json docker/hl-web-server/package.json
COPY package.json package.json
COPY pnpm-lock.yaml pnpm-lock.yaml
COPY pnpm-workspace.yaml pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile
COPY docker/hl-web-server/vite.config.ts docker/hl-web-server/vite.config.ts
COPY packages/xash3d-fwgs packages/xash3d-fwgs
COPY packages/hlsdk-portable packages/hlsdk-portable
COPY docker/hl-web-server/tsconfig.json docker/hl-web-server/tsconfig.json
COPY docker/hl-web-server/src/client docker/hl-web-server/src/client

WORKDIR /client/docker/hl-web-server

RUN pnpm run build


FROM debian:trixie-slim AS final

ENV XASH3D_BASEDIR=/xashds

RUN dpkg --add-architecture i386
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgcc-s1:i386 \
    libstdc++6:i386 \
    libgomp1:i386 \
    ca-certificates \
    openssl \
    && apt-get clean

RUN groupadd xashds && useradd -m -g xashds xashds
USER xashds
WORKDIR /xashds
ENV LD_LIBRARY_PATH=/xashds

COPY --from=hlds /opt/xash/xashds .
COPY --from=go /go/xash ./xash
COPY --from=client /client/docker/hl-web-server/src/client/dist ./public
COPY --from=engine /xash/build/filesystem/filesystem_stdio.so ./filesystem_stdio.so
COPY --from=engine "/usr/lib/i386-linux-gnu/libstdc++.so.6" "./libstdc++.so.6"
COPY --from=engine "/usr/lib/i386-linux-gnu/libgcc_s.so.1" "./libgcc_s.so.1"
EXPOSE 27015/udp

# Start server
ENTRYPOINT ["./xash", "+ip", "0.0.0.0", "-port", "27015", "+console"]

# Default start parameters
CMD ["+map crossfire", "+maxplayers", "16"]
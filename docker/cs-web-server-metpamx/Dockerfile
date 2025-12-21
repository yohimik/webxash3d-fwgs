FROM debian:trixie-slim AS addons

RUN dpkg --add-architecture i386
RUN apt update && apt upgrade -y && apt -y --no-install-recommends install aptitude

RUN apt install -y --no-install-recommends \
    ca-certificates curl patchelf

ENV PKG_CONFIG_PATH=/usr/lib/i386-linux-gnu/pkgconfig

WORKDIR /xash

ARG METAMOD_FILENAME="metamod.so"
ARG METAMOD_URL="https://github.com/mittorn/metamod-p/releases/download/1/metamod.so"
ARG METAMOD_SHA256="276a7714c1c01bd6669e6835424e64e3b7755153aee24ea0a9144af357c2b634"

ARG AMXMODX_VERSION="1.9.0-git5294"
ARG AMXMODX_FILENAME="amxmodx-$AMXMODX_VERSION-base-linux.tar.gz"
ARG AMXMODX_FILENAME_CSTRIKE="amxmodx-$AMXMODX_VERSION-cstrike-linux.tar.gz"
ARG AMXMODX_SHA256="b9467a63aa92fc22330c06817d9059c4462abc3ecb50d39538dda21c8f27bd58"
ARG AMXMODX_SHA256_CSTRIKE="25153ed78a4a9b2220400040ce34cb9ea009af9255df3f21a6e5686162900cfe"
ARG AMXMODX_URL_BASE="https://www.amxmodx.org/amxxdrop/1.9"

RUN mkdir -p /opt/xash/xashds/cstrike/addons/metamod/dlls \
    && touch /opt/xash/xashds/cstrike/addons/metamod/plugins.ini

RUN curl -sLO "$METAMOD_URL" \
    && echo "$METAMOD_SHA256  $METAMOD_FILENAME" | sha256sum -c - \
    && mv "$METAMOD_FILENAME" /opt/xash/xashds/cstrike/addons/metamod/dlls/

RUN curl -sLO "$AMXMODX_URL_BASE/$AMXMODX_FILENAME" \
    && echo "$AMXMODX_SHA256  $AMXMODX_FILENAME" | sha256sum -c - \
    && tar -C /opt/xash/xashds/cstrike/ -zxvf "$AMXMODX_FILENAME" \
    && echo 'linux addons/amxmodx/dlls/amxmodx_mm_i386.so' >> /opt/xash/xashds/cstrike/addons/metamod/plugins.ini \
    && rm -f "$AMXMODX_FILENAME" \
    && patchelf --clear-execstack /opt/xash/xashds/cstrike/addons/amxmodx/dlls/amxmodx_mm_i386.so

RUN curl -sLO "$AMXMODX_URL_BASE/$AMXMODX_FILENAME_CSTRIKE" \
    && echo "$AMXMODX_SHA256_CSTRIKE  $AMXMODX_FILENAME_CSTRIKE" | sha256sum -c - \
    && tar -C /opt/xash/xashds/cstrike/ -zxvf "$AMXMODX_FILENAME_CSTRIKE" \
    && rm -f "$AMXMODX_FILENAME_CSTRIKE"

FROM yohimik/cs-web-server:latest AS server

COPY --from=addons "/opt/xash/xashds/cstrike" cstrike
USER root
RUN sed -i 's/dlls\/cs\.so/addons\/metamod\/dlls\/metamod.so/g' cstrike/liblist.gam
USER xashds
RUN cat cstrike/mapcycle.txt >> cstrike/addons/amxmodx/configs/maps.ini

WORKDIR /xashds
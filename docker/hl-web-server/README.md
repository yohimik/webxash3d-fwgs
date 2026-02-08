# Half-Life Web Server Docker

This repository provides a **plug-and-play Docker image** for running a fully functional **Half-Life** client
and dedicated server via the web. Powered by **Xash3D FWGS**, **WebRTC**, and modern web tooling, this setup allows for
in-browser gameplay and remote multiplayer support.

---

## 🧱 Features

- ✅ Web-based Half-Life client (HTML + TypeScript + Vite)
- ✅ Dedicated Half-Life server (Go + CGO + Xash3D FWGS)
- ✅ WebRTC support for browser-to-server networking
- ✅ AMX Mod X & Metamod-R compatible
- ✅ Dockerized & easy to deploy
- ✅ i386 (32-bit) architecture support

---

## 🎯 Looking for AMX Mod X Support?

If you want **AMX Mod X and Metamod pre-installed and ready to use**, check out the [hl-web-server-metpamx](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server-metpamx) variant. It includes:
- Pre-configured Metamod-P
- AMX Mod X with all base modules
- Ready for custom plugins out of the box

This base version is compatible with AMX Mod X but requires manual installation.

---

## 🔧 Technologies

### 🖥️ Client (src/client)

* Framework: Vite (with HTML + TypeScript)
* NPM packages:
    * xash3d-fwgs
    * hlsdk-portable
* Uses WebRTC to connect to the dedicated server

### 🎮 Server (src/server)

* Language: Go (Golang) + CGO
* Embedded: Xash3D FWGS (dedicated server)
* Network: Pion WebRTC library
* Serves static files for the client frontend

## 🚀 Getting Started

### 🎮 Game Content (Required)

To run the game, you must provide original **Half-Life game files** from Steam. These must be packaged in a
`valve.zip` file and mounted into the Docker container.

### 📦 `valve.zip` Structure

The `valve.zip` file must contain the following directory from your Steam installation:

```plaintext
valve.zip
└── valve/
```

### ✅ Prerequisites

* Docker installed
* A public IP address (if hosting outside LAN)
* An open UDP port (e.g. 27018)

You must mount the file to the container path `/xashds/public/valve.zip`:

```shell
docker build --platform linux/386 -t hl-web-server  .
docker run -d \
  -p 27016:27016 \
  -p <your-port>:<your-port> \
  -p <your-port>:<your-port>/udp \
  -e IP=<your-public-ip> \
  -e PORT=<your-port> \
  -v $(pwd)/valve.zip:/xashds/public/valve.zip \
  yohimik/hl-web-server:latest \
  +map crossfire +maxplayers 14
```

```yaml
services:
  xash3d:
    image: yohimik/hl-web-server:latest
    command: [ "+map crossfire", "+maxplayers 14" ]
    restart: always
    platform: linux/386
    environment:
      PORT: <your-port>
      IP: <your-public-ip>
    volumes:
      - "./valve.zip:/xashds/public/valve.zip"
    ports:
      - "27016:27016"
      - "<your-port>:<your-port>"
      - "<your-port>:<your-port>/udp"

```

Replace the placeholders:

* `<your-public-ip>` — your server's external IP
* `<your-port>` — open UDP port (e.g. 27018)

Then open `http://<your-server-ip>:27016` in your browser!

## 🌍 Environment Variables

This image uses the same configuration system as the [CS Web Server](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/cs-web-server#-environment-variables).

The default values for Half-Life are pre-configured, but you can customize them using the same environment variables documented in the CS Web Server README.

## 🛠️ Customization

* Client UI/UX: Modify files in src/client

To include custom content:

* Mount a volume to `/xashds` inside the container
* Or copy files into the Docker build context

## 🌐 Discord Community

Need help? Want to share your project or ideas?
**[Join our Discord community](https://discord.gg/cRNGjWfTDd)** to connect with others!

## 📜 License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE.md) file for more information.

## 📝 Changelog

See [CHANGELOG.md](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server/CHANGELOG.md) for a full
list of updates and release history.

## 🔗 Related Projects

- [cs-web-server](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/cs-web-server) - Counter-Strike 1.6 Web Server
- [hl-web-server-metpamx](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server-metpamx) - Version with AMX Mod X & Metamod pre-installed
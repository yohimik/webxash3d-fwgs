# Counter-Strike 1.6 Web Server Docker

This image provides a **plug-and-play Docker image** for running a fully functional **Counter-Strike 1.6** client
and dedicated server via the web. Powered by **Xash3D FWGS**, **WebRTC**, and modern web tooling, this setup allows for
in-browser gameplay and remote multiplayer support.

Repository: [github.com/yohimik/webxash3d-fwgs/docker/multi-web-server](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/multi-web-server)
---

## 🧱 Features

- ✅ Web-based CS 1.6 client (HTML + TypeScript + Vite)
- ✅ Dedicated CS 1.6 server (Go + CGO + Xash3D FWGS)
- ✅ WebRTC support for browser-to-server networking
- ✅ AMX Mod X & Metamod-R compatible
- ✅ Dockerized & easy to deploy
- ✅ i386 (32-bit) architecture support

---

## 🎯 Looking for AMX Mod X Support?

If you want **AMX Mod X and Metamod pre-installed and ready to use**, check out the [cs-web-server-metpamx](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/cs-web-server-metpamx) variant. It includes:
- Pre-configured Metamod-P
- AMX Mod X with all base modules
- Ready for custom plugins out of the box

This base version is compatible with AMX Mod X but requires manual installation.

---

## 🚀 Getting Started

### 🎮 Game Content (Required)

To run the game, you must provide original **Counter-Strike 1.6 game files** from Steam. These must be packaged in a
`valve.zip` file and mounted into the Docker container.

### 📦 `valve.zip` Structure

```plaintext
valve.zip
├── valve/
└── cstrike/
```

The `valve.zip` file must contain the following two directories from your Steam installation:

### ✅ Prerequisites

* Docker installed
* A public IP address (if hosting outside LAN)
* An open UDP port (e.g. 27018)

You must mount the file to the container path `/xashds/public/valve.zip`:

### 🐋 Using Docker Run

```shell
docker run -d \
  -p 27016:27016 \
  -p <your-port>:<your-port> \
  -p <your-port>:<your-port>/udp \
  -e GAME_TYPE=cstrike \
  -e IP=<your-public-ip> \
  -e PORT=<your-port> \
  -e MAP=de_dust2 \
  -e MAXPLAYERS=16 \
  -v $(pwd)/valve.zip:/xashds/public/valve.zip \
  yohimik/multi-web-server:latest
```

### 🐳 Using Docker Compose (Recommended)

#### Counter-Strike 1.6
```yaml
services:
  xash3d:
    image: yohimik/multi-web-server:latest
    restart: always
    platform: linux/386
    environment:
      GAME_TYPE: "cstrike"
      IP: "<your-public-ip>"
      PORT: "<your-port>"
      MAP: "de_dust2"           # Optional, auto-detected
      MAXPLAYERS: "16"          # Optional
      CONSOLE_COMMANDS: '["mp_timelimit 45", "mp_roundtime 3"]'  # Optional
    volumes:
      - "./valve.zip:/xashds/public/valve.zip"
    ports:
      - "27016:27016"
      - "<your-port>:<your-port>"
      - "<your-port>:<your-port>/udp"
```

#### Half-Life (using the same image)
```yaml
services:
  xash3d:
    image: yohimik/multi-web-server:latest
    restart: always
    platform: linux/386
    environment:
      GAME_TYPE: "hlsdk"
      IP: "<your-public-ip>"
      PORT: "<your-port>"
      MAP: "crossfire"          # Optional, auto-detected
      MAXPLAYERS: "16"          # Optional
    volumes:
      - "./valve.zip:/xashds/public/valve.zip"
    ports:
      - "27016:27016"
      - "<your-port>:<your-port>"
      - "<your-port>:<your-port>/udp"
```

#### Advanced: Custom arguments
```yaml
services:
  xash3d:
    image: yohimik/multi-web-server:latest
    command: ["+map de_aztec", "+maxplayers 32", "+sv_cheats 1"]
    restart: always
    platform: linux/386
    environment:
      GAME_TYPE: "cstrike"
      IP: "<your-public-ip>"
      PORT: "<your-port>"
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

| Variable               | Description                                                     | Default      | Example                      |
|------------------------|-----------------------------------------------------------------|--------------|------------------------------|
| `GAME_TYPE`            | Game mod to run (`cstrike` or `hlsdk`)                          | `cstrike`    | `hlsdk`                      |
| `IP`                   | Public IP address for WebRTC connection                         | `192.168.0.1`    | `123.45.67.89`               |
| `PORT`                 | UDP port for game server (must be open)                         | `27018`      | `27018`                      |
| `MAP`                  | Starting map (auto: `de_dust2` for CS, `crossfire` for HL)     | (auto)       | `de_aztec`                   |
| `MAXPLAYERS`           | Maximum number of players                                       | `16`         | `32`                         |
| `CONSOLE_COMMANDS`     | JSON array of console commands to execute on startup            | `[]`         | `["mp_timelimit 45"]`        |
| `DISABLE_X_POWERED_BY` | Set to `true` to remove the `X-Powered-By` HTTP header         | `false`      | `true`                       |
| `X_POWERED_BY_VALUE`   | Custom value for `X-Powered-By` header if not disabled          | `yohimik`    | `CS 1.6 Web Server`          |

## 🛠️ Customization

* Client UI/UX: Modify files in src/client

To include custom plugins:

* Mount a volume to `/xashds` inside the container
* Or copy plugin files into the Docker build context

## 🌐 Discord Community

Need help? Want to share your project or ideas?
**[Join our Discord community](https://discord.gg/cRNGjWfTDd)** to connect with others!

## 📜 License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE.md) file for more information.

## 📝 Changelog

See [CHANGELOG.md](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/multi-web-server/CHANGELOG.md) for a full
list of updates and release history.

## 🔗 Related Projects

- [cs-web-server-metpamx](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/cs-web-server-metpamx) - Version with AMX Mod X & Metamod pre-installed
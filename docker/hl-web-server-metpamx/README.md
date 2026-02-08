# Half-Life Web Server Docker (with AMX Mod X)

This repository provides a **plug-and-play Docker image** for running a fully functional **Half-Life** client
and dedicated server via the web with **AMX Mod X pre-installed**. Powered by **Xash3D FWGS**, **WebRTC**, and modern web tooling, this setup allows for
in-browser gameplay and remote multiplayer support with full plugin support.

---

## 🙏 Credits & Acknowledgements

Special thanks that made this project possible:

- [@ludufre](https://github.com/ludufre) initial Docker image creation and plugins support

--- 

## 🧱 Features

- ✅ Web-based Half-Life client (HTML + TypeScript + Vite)
- ✅ Dedicated Half-Life server (Go + CGO + Xash3D FWGS)
- ✅ WebRTC support for browser-to-server networking
- ✅ **Pre-installed Metamod-P & AMX Mod X**
- ✅ **Ready for custom plugins out of the box**
- ✅ Dockerized & easy to deploy
- ✅ i386 (32-bit) architecture support

---

## 🆚 Difference from Base Version

This image extends the base [hl-web-server](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server) with:
- **Metamod-P** pre-installed and configured
- **AMX Mod X** pre-installed with all base modules
- Modified `liblist.gam` to load Metamod automatically
- Pre-configured plugin directories and files

If you don't need AMX Mod X or prefer a vanilla server, use the [base hl-web-server](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server) instead.

---

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
docker build --platform linux/386 -t hl-web-server-metpamx .
docker run -d \
  -p 27016:27016 \
  -p <your-port>:<your-port>/udp \
  -e IP=<your-public-ip> \
  -e PORT=<your-port> \
  -v $(pwd)/valve.zip:/xashds/public/valve.zip \
  yohimik/hl-web-server-metpamx:latest \
  +map de_dust +maxplayers 14
```

```yaml
services:
  xash3d:
    image: yohimik/hl-web-server-metpamx:latest
    command: [ "+map de_dust", "+maxplayers 14" ]
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

Variables available from [base image](https://github.com/yohimik/webxash3d-fwgs/blob/main/docker/cs-web-server/README.md#-environment-variables)

## 🛠️ Customization

### Client UI/UX
Modify files in src/client

### AMX Mod X Plugins

This image comes with AMX Mod X pre-installed. To add custom plugins:

**Option 1: Mount plugins directory**
```yaml
volumes:
  - "./plugins:/xashds/valve/addons/amxmodx/plugins"
  - "./configs:/xashds/valve/addons/amxmodx/configs"
```

**Option 2: Mount entire addons directory**
```yaml
volumes:
  - "./addons:/xashds/valve/addons"
```

**Option 3: Build custom image**
```dockerfile
FROM yohimik/hl-web-server-metpamx:latest
COPY my-plugins/*.amxx /xashds/valve/addons/amxmodx/plugins/
COPY my-configs/*.cfg /xashds/valve/addons/amxmodx/configs/
```

### Plugin Configuration

Edit `plugins.ini` to enable/disable plugins:
```yaml
volumes:
  - "./plugins.ini:/xashds/valve/addons/amxmodx/configs/plugins.ini"
```

### Metamod Configuration

The Metamod plugins are configured in `/xashds/valve/addons/metamod/plugins.ini`

## 🌐 Discord Community

Need help? Want to share your project or ideas?
**[Join our Discord community](https://discord.gg/cRNGjWfTDd)** to connect with others!

## 📜 License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE.md) file for more information.

## 📝 Changelog

See [CHANGELOG.md](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server-metpamx/CHANGELOG.md) for a full
list of updates and release history.

## 🔗 Related Projects

- [hl-web-server](https://github.com/yohimik/webxash3d-fwgs/tree/main/docker/hl-web-server) - Vanilla version without AMX Mod X
# Xash3D-FWGS Emscripten Web Ports Monorepo <img alt="WebXash3D icon" align="right" width="128" height="128" src="./screenshots/logo.png" />

[![Join our Discord](https://img.shields.io/discord/1397890383605927967?color=5865F2&label=Discord&logo=discord&logoColor=white&style=for-the-badge)](https://discord.gg/cRNGjWfTDd)

This project is a [Lerna](https://lerna.js.org)-managed monorepo for running and compiling WebAssembly builds of [Xash3D-FWGS](https://github.com/FWGS/xash3d-fwgs), an open-source reimplementation of the GoldSource engine, in the browser using [Emscripten](https://emscripten.org/).

---

```shell
npm install xash3d-fwgs hlsdk-portable cs16-client
```

```typescript
import { Xash3D } from "xash3d-fwgs"

const x = new Xash3D({
    canvas: document.getElementById('canvas'),
    arguments: ['-game', 'cstrike'],
})
await x.init()
x.main()
x.Cmd_ExecuteString('map de_dust2')
x.Cmd_ExecuteString('sv_cheats 1')
x.Cmd_ExecuteString('noclip')
x.Cmd_ExecuteString('kill')
x.quit()
```

### Included Packages

* [xash3d-fwgs](packages/xash3d-fwgs): Core engine build for WebAssembly.
* [hlsdk-portable](packages/hlsdk-portable): Portable Half-Life SDK game logic.
* [cs16-client](packages/cs16-client): Counter-Strike 1.6 client build for the web.
* [webxash3d-mserver](packages/webxash3d-mserver): WebXash3D MServer written in TypeScript for in a game server list.

### Docker Servers

Ready-to-deploy Docker images for Counter-Strike 1.6 web servers:

* [cs-web-server](docker/cs-web-server): Vanilla CS 1.6 web server with client and dedicated server
* [cs-web-server-metpamx](docker/cs-web-server-metpamx): CS 1.6 web server with **Metamod-P & AMX Mod X pre-installed**

Both support WebRTC for browser-to-server networking and are fully Dockerized for easy deployment.

## Getting Started 

### Clone the repository

```shell
git clone --recurse-submodules https://github.com/yohimik/webxash3d-fwgs.git
cd webxash3d-fwgs
```

### Install Dependencies

```shell
pnpm install
```

### Game Content

You must provide your own game files (e.g., from Steam):
```shell
steamcmd +force_install_dir ./hl +login your_steam_username +app_update 70 validate +quit
```

### Compile and run

To build and run a project, go to the [examples/ folder](examples) and choose the example that matches the game or setup you want.

### hlsdk

<details>
  <summary>Screenshots (black frames - mac book camera, blue frames - browser active outline)</summary>

![hlsdk screenshot 0](./screenshots/hlsdk0.png)
![hlsdk screenshot 1](./screenshots/hlsdk1.png)
![hlsdk screenshot 2](./screenshots/hlsdk2.png)
![hlsdk screenshot 3](./screenshots/hlsdk3.png)
![hlsdk screenshot 4](./screenshots/hlsdk4.png)

</details>

### cs16

<details>
  <summary>Screenshots (black frames - mac book camera, blue frames - browser active outline)</summary>

![cs16-client screenshot 0](./screenshots/cs16-client0.png)
![cs16-client screenshot 1](./screenshots/cs16-client1.png)
![cs16-client screenshot 2](./screenshots/cs16-client2.png)
![cs16-client screenshot 3](./screenshots/cs16-client3.png)

</details>

### tf15-client

Cannot be supported at this moment (wait for `freevgui`).

### WebRTC Online Mod

<details>
  <summary>Screenshots</summary>

![webrtc screenshot 0](./screenshots/webrtc0.png)

</details>

## Discord Community

Need help? Want to share your project or ideas?
**[Join our Discord community](https://discord.gg/cRNGjWfTDd)** to connect with others!

# TODO

## WebRTC/UDP proxy

Support WebRTC/UDP proxy (webxash3d-mserver).

## Engine Touch Support (potentially)

Enable touch support at the engine level.
Requires `isNeedTouch` engine function support.

## Fix Text Inputs (potentially)

Text inputs are not rendered as standard HTML input fields, which makes text input impossible on mobile devices.

## Async/lazy loading (potentially)

Patch the FS module to load only the currently required game files using `fetch`, instead of loading all files into RAM. 
Requires `EAGAIN` support from the engine.

## Gles3compat improves (potentially)

Support GLES3Compat batching and fix `Vertex buffer is not big enough for the draw call.Understand this warning` warning.

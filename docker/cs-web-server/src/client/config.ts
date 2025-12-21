import menuURL from "cs16-client/cl_dll/menu_emscripten_wasm32.wasm?url";
import clientURL from "cs16-client/cl_dlls/client_emscripten_wasm32.wasm?url";
import sServerURL from "cs16-client/dlls/cs_emscripten_wasm32.so?url";
import extrasURL from "cs16-client/extras.pk3?url";

export const config = {
  arguments: ["-windowed", "-game", "cstrike"],
  console: ["_vgui_menus 0"],
  game_dir: "cstrike",
  libraries: {
    client: {
      path: "cs16-client/cl_dlls/client_emscripten_wasm32.wasm",
      url: clientURL,
    },
    server: {
      path: "cs16-client/dlls/cs_emscripten_wasm32.so",
      url: sServerURL,
    },
    extras: {
      path: "cs16-client/extras.pk3",
      url: extrasURL,
    },
    menu: {
      path: "cs16-client/cl_dll/menu_emscripten_wasm32.wasm",
      url: menuURL,
    },
  },
  server_lib: "dlls/cs_emscripten_wasm32.so",
};

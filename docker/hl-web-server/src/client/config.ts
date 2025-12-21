import menuURL from "xash3d-fwgs/cl_dll/menu_emscripten_wasm32.wasm?url";
import clientURL from "hlsdk-portable/cl_dlls/client_emscripten_wasm32.wasm?url";
import sServerURL from "hlsdk-portable/dlls/hl_emscripten_wasm32.so?url";
import extrasURL from "xash3d-fwgs/extras.pk3?url";

export const config = {
  arguments: ["-windowed"],
  console: [],
  game_dir: "valve",
  libraries: {
    client: {
      path: "hlsdk-portable/cl_dlls/client_emscripten_wasm32.wasm",
      url: clientURL,
    },
    server: {
      path: "hlsdk-portable/dlls/hl_emscripten_wasm32.so",
      url: sServerURL,
    },
    extras: {
      path: "xash3d-fwgs/extras.pk3",
      url: extrasURL,
    },
    menu: {
      path: "xash3d-fwgs/cl_dll/menu_emscripten_wasm32.wasm",
      url: menuURL,
    },
  },
  server_lib: "dlls/hl_emscripten_wasm32.so",
};

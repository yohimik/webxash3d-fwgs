import {loadAsync} from 'jszip'
import filesystemURL from 'xash3d-fwgs/filesystem_stdio.wasm?url'
import xashURL from 'xash3d-fwgs/xash.wasm?url'
import gl4esURL from 'xash3d-fwgs/libref_webgl2.wasm?url'

// CS16 Client
import cs16MenuURL from 'cs16-client/cl_dll/menu_emscripten_wasm32.wasm?url'
import cs16ClientURL from 'cs16-client/cl_dlls/client_emscripten_wasm32.wasm?url'
import cs16ServerURL from 'cs16-client/dlls/cs_emscripten_wasm32.so?url'
import cs16ExtrasURL from 'cs16-client/extras.pk3?url'

// HLSDK Portable
import hlsdkMenuURL from 'xash3d-fwgs/cl_dll/menu_emscripten_wasm32.wasm?url'
import hlsdkClientURL from 'hlsdk-portable/cl_dlls/client_emscripten_wasm32.wasm?url'
import hlsdkServerURL from 'hlsdk-portable/dlls/hl_emscripten_wasm32.so?url'
import hlsdkExtrasURL from 'xash3d-fwgs/extras.pk3?url'

import {Xash3DWebRTC} from "./webrtc";

// Mapeamento de bibliotecas
const libraryMap: Record<string, string> = {
    'cs16-client/cl_dll/menu_emscripten_wasm32.wasm': cs16MenuURL,
    'cs16-client/cl_dlls/client_emscripten_wasm32.wasm': cs16ClientURL,
    'cs16-client/dlls/cs_emscripten_wasm32.so': cs16ServerURL,
    'cs16-client/extras.pk3': cs16ExtrasURL,
    'xash3d-fwgs/cl_dll/menu_emscripten_wasm32.wasm': hlsdkMenuURL,
    'hlsdk-portable/cl_dlls/client_emscripten_wasm32.wasm': hlsdkClientURL,
    'hlsdk-portable/dlls/hl_emscripten_wasm32.so': hlsdkServerURL,
    'xash3d-fwgs/extras.pk3': hlsdkExtrasURL,
};

const touchControls = document.getElementById('touchControls') as HTMLInputElement
touchControls.addEventListener('change', () => {
    localStorage.setItem('touchControls', String(touchControls.checked))
})

let usernamePromiseResolve: (name: string) => void
const usernamePromise = new Promise<string>(resolve => {
    usernamePromiseResolve = resolve
})

async function fetchWithProgress(url: string) {
    const progress = document.getElementById('progress') as HTMLProgressElement
    const res = await fetch(url);

    const contentLength = res.headers.get('Content-Length');

    const total = contentLength ? parseInt(contentLength, 10) : null;
    const reader = res.body!.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        received += value.length;

        if ( total !== null) {
            progress.value = received / total
        } else {
            progress.value = received
        }
    }

    progress.style.opacity = '0'

    const blob = new Blob(chunks);
    return blob.arrayBuffer()
}

async function main() {
    // Fetch server configuration
    const configRes = await fetch('/config')
    const config = await configRes.json()
    
    // Resolve libraries from static mapping
    const menuURL = libraryMap[config.libraries.menu]
    const clientURL = libraryMap[config.libraries.client]
    const serverURL = libraryMap[config.libraries.server]
    const extrasURL = libraryMap[config.libraries.extras]
    
    if (!menuURL || !clientURL || !serverURL || !extrasURL) {
        throw new Error('Unknown library configuration from server')
    }
    
    const x = new Xash3DWebRTC({
        canvas: document.getElementById('canvas') as HTMLCanvasElement,
        arguments: config.arguments || ['-windowed'],
        libraries: {
            filesystem: filesystemURL,
            xash: xashURL,
            menu: menuURL,
            server: serverURL,
            client: clientURL,
            render: {
                gl4es: gl4esURL,
            }
        },
        dynamicLibraries: [config.server_lib, '/rwdir/filesystem_stdio.wasm'],
        filesMap: {
            [config.server_lib]: serverURL,
            '/rwdir/filesystem_stdio.wasm': filesystemURL,
        },
    });

    const [zip, extras] = await Promise.all([
        (async () => {
            const res = await fetchWithProgress('valve.zip')
            return await loadAsync(res);
        })(),
        (async () => {
            const res = await fetch(extrasURL)
            return await res.arrayBuffer();
        })(),
        x.init(),
    ])

    await Promise.all(Object.entries(zip.files).map(async ([filename, file]) => {
        if (file.dir) return;

        const path = '/rodir/' + filename;
        const dir = path.split('/').slice(0, -1).join('/');

        x.em.FS.mkdirTree(dir);
        x.em.FS.writeFile(path, await file.async("uint8array"));
    }))

    x.em.FS.writeFile(`/rodir/${config.game_dir}/extras.pk3`, new Uint8Array(extras))
    x.em.FS.chdir('/rodir')

    document.getElementById('logo')!.style.animationName = 'pulsate-end'
    document.getElementById('logo')!.style.animationFillMode = 'forwards'
    document.getElementById('logo')!.style.animationIterationCount = '1'
    document.getElementById('logo')!.style.animationDirection = 'normal'

    const username = await usernamePromise
    x.main()
    x.Cmd_ExecuteString('_vgui_menus 0')
    if (touchControls.checked) {
        x.Cmd_ExecuteString('touch_enable 1')
    }
    x.Cmd_ExecuteString(`name "${username}"`)
    
    // Execute custom server commands
    if (config.console && Array.isArray(config.console)) {
        config.console.forEach((cmd: string) => {
            x.Cmd_ExecuteString(cmd)
        })
    }
    
    x.Cmd_ExecuteString('connect 127.0.0.1:8080')

    window.addEventListener('beforeunload', (event) => {
        event.preventDefault();
        event.returnValue = '';
        return '';
    });
}
const enableTouch = localStorage.getItem('touchControls')
if (enableTouch === null) {
    const isMobile = !window.matchMedia('(hover: hover)').matches;
    touchControls.checked = isMobile
    localStorage.setItem('touchControls', String(isMobile))
} else {
    touchControls.checked = enableTouch === 'true'
}

const username = localStorage.getItem('username')
if (username) {
    (document.getElementById('username') as HTMLInputElement).value = username
}

(document.getElementById('form') as HTMLFormElement).addEventListener('submit', (e) => {
    e.preventDefault()
    const username = (document.getElementById('username') as HTMLInputElement).value
    localStorage.setItem('username', username);
    (document.getElementById('form') as HTMLFormElement).style.display = 'none';
    (document.getElementById('social') as HTMLDivElement).style.display = 'none';
    usernamePromiseResolve(username)
})

main()
import {loadAsync} from 'jszip'
import filesystemURL from 'xash3d-fwgs/filesystem_stdio.wasm?url'
import xashURL from 'xash3d-fwgs/xash.wasm?url'
import menuURL from 'xash3d-fwgs/cl_dll/menu_emscripten_wasm32.wasm?url'
import clientURL from 'hlsdk-portable/cl_dlls/client_emscripten_wasm32.wasm?url'
import serverURL from 'hlsdk-portable/dlls/hl_emscripten_wasm32.so?url'
import gl4esURL from 'xash3d-fwgs/libref_webgl2.wasm?url'
import extrasURL from 'xash3d-fwgs/extras.pk3?url'
import {Xash3DWebRTC} from "./webrtc";

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
    const x = new Xash3DWebRTC({
        canvas: document.getElementById('canvas') as HTMLCanvasElement,
        arguments: ['-windowed'],
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
        dynamicLibraries: ['dlls/hl_emscripten_wasm32.so', '/rwdir/filesystem_stdio.wasm'],
        filesMap: {
            'dlls/hl_emscripten_wasm32.so': serverURL,
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

    x.em.FS.writeFile('/rodir/valve/extras.pk3', new Uint8Array(extras))
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
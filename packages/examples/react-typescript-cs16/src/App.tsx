import React, {FC, useRef} from 'react';
import {Xash3D} from "xash3d-fwgs";
import filesystemURL from 'xash3d-fwgs/dist/filesystem_stdio.wasm'
import xashURL from 'xash3d-fwgs/dist/xash.wasm'
import menuURL from 'cs16-client/dist/cl_dlls/menu_emscripten_wasm32.wasm'
import clientURL from 'cs16-client/dist/cl_dlls/client_emscripten_wasm32.wasm'
import serverURL from 'cs16-client/dist/dlls/cs_emscripten_wasm32.so'
import gles3URL from 'xash3d-fwgs/dist/libref_gles3compat.wasm'
import {loadAsync} from 'jszip'
import './App.css';

const App: FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    return (
        <>
            <button onClick={async () => {
                const x = new Xash3D({
                    canvas: canvasRef.current!,
                    args: ['-windowed', '-game', 'cstrike', '+_vgui_menus', '0'],
                    libraries: {
                        filesystem: filesystemURL,
                        xash: xashURL,
                        menu: menuURL,
                        server: serverURL,
                        client: clientURL,
                        render: {
                            gles3compat: gles3URL,
                        }
                    },
                    filesMap: {
                        'dlls/cs_emscripten_wasm32.so': serverURL,
                        '/rwdir/filesystem_stdio.so': filesystemURL,
                    },
                });

                const [zip] = await Promise.all([
                    (async () => {
                        const res = await fetch('valve.zip')
                        return await loadAsync(await res.arrayBuffer());
                    })(),
                    x.init(),
                ])

                if (x.exited) return

                await Promise.all(Object.entries(zip.files).map(async ([filename, file]) => {
                    if (file.dir) return;

                    const path = '/rodir/' + filename;
                    const dir = path.split('/').slice(0, -1).join('/');

                    x.FS.mkdirTree(dir);
                    x.FS.writeFile(path, await file.async("uint8array"));
                }))

                x.FS.chdir('/rodir')
                x.main()
            }}>
                Start
            </button>
            <canvas id="canvas" ref={canvasRef}/>
        </>
    );
}

export default App;

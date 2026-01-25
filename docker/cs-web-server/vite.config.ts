import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'src/client/index.html'),
                admin: path.resolve(__dirname, 'src/client/admin/index.html'),
            }
        }
    },
    root: 'src/client',
    publicDir: 'public',
});
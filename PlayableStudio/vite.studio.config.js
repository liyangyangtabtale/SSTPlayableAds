import {defineConfig} from 'vite'; import {viteSingleFile} from 'vite-plugin-singlefile';
export default defineConfig(({command}) => ({
  server: {port: 5191, host: '127.0.0.1'}, plugins: command === 'build' ? [viteSingleFile()] : [],
  build: {target: 'es2022', outDir: 'dist/studio', emptyOutDir: true, chunkSizeWarningLimit: 8000, rollupOptions: {input: 'studio.html'}},
}));

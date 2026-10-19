import {defineConfig} from 'vite'; import {viteSingleFile} from 'vite-plugin-singlefile';
// 运行时：构建成单文件模板 dist/runtime/index.html，里面留 window.__PLAYABLE__ 的占位(/*PLAYABLE_DATA*/)，Studio 和导出器往里注入配置和资源。
const placeholder = () => ({name: 'playable-placeholder', transformIndexHtml(html, ctx) { return ctx.server ? html : html.replace('<script src="/dev-data.js"></script>', '<script>window.__PLAYABLE__=null;/*PLAYABLE_DATA*/</script>'); }});
export default defineConfig(({command}) => ({
  publicDir: command === 'serve' ? 'public' : false, server: {port: 5190, host: '127.0.0.1'}, plugins: command === 'build' ? [placeholder(), viteSingleFile()] : [placeholder()],
  build: {target: 'es2020', outDir: 'dist/runtime', emptyOutDir: true, chunkSizeWarningLimit: 4000},
}));

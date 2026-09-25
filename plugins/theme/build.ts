import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * 浏览器侧打包。react 的四个包名**外置**——由页面 importmap 解析到内核包打包的那一份，插件之间用同一个实例；
 * 本插件没有别的运行时依赖，startup-css.js 是纯函数，直接打包进 client.js（预览和存取用同一段逻辑）。
 */

const here = path.dirname(fileURLToPath(import.meta.url))

/** 内核 0.6 起页面入口里写死的 importmap 只有这四个包名，与内核仓 index.html 的那张表一一对应 */
const PAGE_IMPORTMAP_NAMES = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'dist/client.js',
  external: PAGE_IMPORTMAP_NAMES,
  absWorkingDir: here,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  bundle: true,
  minify: false,
  legalComments: 'none',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
})

console.log('[theme] dist/client.js ← src/client/index.tsx')

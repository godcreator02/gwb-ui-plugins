import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * 浏览器侧打包。react 的四个包名**外置**——由页面 importmap 解析到内核包打包的那一份，插件之间用同一个实例；
 * 其余（shadcn 组件那几条运行时依赖）一律打包进 client.js，外置成包名就是运行时一句
 * `Failed to resolve module specifier`。
 */

const here = path.dirname(fileURLToPath(import.meta.url))

/** 内核 0.6 起页面入口里写死的 importmap 只有这四个包名，与内核仓 index.html 的那张表一一对应 */
const PAGE_IMPORTMAP_NAMES = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client']

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'dist/client.js',
  external: PAGE_IMPORTMAP_NAMES,
  // shadcn 生成的组件写的是 @/… 这种别名，跟 components.json 与两份 tsconfig 的
  // paths 是同一条约定（都指 src/client）
  alias: { '@': path.join(here, 'src', 'client') },
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

console.log('[baseui] dist/client.js ← src/client/index.tsx')

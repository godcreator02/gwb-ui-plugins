import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import postcss from 'postcss'

/**
 * node 侧与浏览器侧都用 esbuild 打成一个文件，外置名单之外的依赖全部打包进去；再生成图标名单与几张样式表。
 * dockview 一律打包进 client.js：它不在页面 importmap 里，外置成包名就是运行时「Failed to resolve module specifier」。
 * `.d.ts`（包根与子路径 `./pane`）由 package.json 的 build 脚本在本脚本之后用 tsc 输出。
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

/**
 * node 侧外置名单：peer 里的包（home 里装着）、electron，以及 cordis——按值 import 了 cordis 却没写进 peer 时，
 * 产物里留下包名、被发版前检查拦住，而不是悄悄打包进一份拷贝
 */
function nodeSideExternals(): string[] {
  const manifest: unknown = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'))
  const peers = isRecord(manifest) && isRecord(manifest['peerDependencies']) ? Object.keys(manifest['peerDependencies']) : []
  return ['electron', 'cordis', ...peers]
}

/**
 * 浏览器侧外置名单只从提供方读：react 的四个包名由内核包提供，写死在它页面入口 dist/index.html 的 importmap 里，
 * 构建时从装好的内核包里读（peer 写了它，pnpm 装在本包的 node_modules 里）。外置了 importmap 里没有的名字，
 * 运行时就是「Failed to resolve module specifier」
 */
function importmapNamesOfKernel(): string[] {
  const manifestPath = fileURLToPath(import.meta.resolve('@godcreator/gwb-kernel-desktop/package.json'))
  const pageEntry = path.join(path.dirname(manifestPath), 'dist', 'index.html')
  const importmapScript = /<script type="importmap">([\s\S]*?)<\/script>/.exec(fs.readFileSync(pageEntry, 'utf8'))
  if (importmapScript === null) {
    throw new Error(`${pageEntry} 里没有 <script type="importmap">：外置名单只从内核包页面入口的这段 importmap 读，读不到就不构建`)
  }
  const importmap: unknown = JSON.parse(importmapScript[1]!)
  const imports = isRecord(importmap) ? importmap['imports'] : undefined
  if (!isRecord(imports)) throw new Error(`${pageEntry} 的 importmap 里没有 imports`)
  return Object.keys(imports)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// 上一次构建留下的文件会随 files 白名单一起发出去，先清空
fs.rmSync(path.join(here, 'dist'), { recursive: true, force: true })

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  external: nodeSideExternals(),
  // 打包进来的 CommonJS 依赖会 require node 内置模块；ESM 产物里没有 require，
  // esbuild 的 __require 执行到就抛「Dynamic require ... is not supported」。在产物开头用 createRequire 造一个
  banner: { js: 'import { createRequire as __createRequire } from "node:module";\nconst require = __createRequire(import.meta.url);' },
  format: 'esm',
  platform: 'node',
  target: 'node22',
  bundle: true,
  minify: false,
  legalComments: 'none',
  logLevel: 'warning',
  absWorkingDir: here,
})

await build({
  entryPoints: ['src/client/index.tsx'],
  outfile: 'dist/client.js',
  external: importmapNamesOfKernel(),
  // shadcn 生成的组件写的是 @/… 这种别名，跟 components.json 与两份 tsconfig 的 paths 是同一条约定（都指 src/client）
  alias: { '@': path.join(here, 'src', 'client') },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  bundle: true,
  minify: false,
  legalComments: 'none',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  absWorkingDir: here,
})

console.log('[shell] dist/index.js ← src/index.ts，dist/client.js ← src/client/index.tsx')

/**
 * `dist/pane-icons.json` = 打包进 client.js 的那份 lucide-react 的全部导出名 + 版本。node 侧登记
 * 窗格时拿它认图标名：标签画得出哪些、登记就认哪些，两边用的是同一份 lucide。
 */
const lucideDir = path.dirname(require.resolve('lucide-react/package.json'))
const lucideVersion = (JSON.parse(fs.readFileSync(path.join(lucideDir, 'package.json'), 'utf8')) as { version: string }).version
const { icons } = require('lucide-react') as { icons: Record<string, unknown> }
const iconKeys = Object.keys(icons).sort()
fs.writeFileSync(
  path.join(here, 'dist', 'pane-icons.json'),
  `${JSON.stringify({ lucide: lucideVersion, keys: iconKeys })}\n`,
  'utf8',
)
console.log(`[shell] dist/pane-icons.json ← lucide-react ${lucideVersion}（${iconKeys.length} 个）`)

/**
 * `dist/dockview.css` = **裁剪过的** dockview 基础规则 + 我们自己那套主题。
 *
 * dockview 自带 18 套主题，我们一套都不用——所以凡是**选择器里带 `.dockview-` 的规则**
 * 整条删掉。那不只是 18 套配色：`.dockview-spaced` 这个 modifier 也在其中，它带着圆角与
 * 间距的规则（我们的主题表把用得上的照写了一份）。
 *
 * **按选择器裁剪，不按行猜**：一个内置主题都不用，整类规则可以按选择器整体删除。
 * 用 postcss 解析、**不用字符串数括号**：CSS 的注释与字符串里都可能有括号。
 */
const dockviewCss = require.resolve('dockview-react/dist/styles/dockview.css')
const themeFile = path.join(here, 'src', 'client', 'dockview-theme.css')
const rawCss = fs.readFileSync(dockviewCss, 'utf8')
const themeCss = fs.readFileSync(themeFile, 'utf8')

/** 这条选择器只有挂了 dockview 自带的某个类才命中——我们只挂 `dockview-theme-gwb` */
function isTheirs(selector: string): boolean {
  return selector.includes('.dockview-')
}

const base = postcss.parse(rawCss)
base.walkRules((rule) => {
  // at-rule 底下的「规则」不是选择器（keyframes 的 `from`/`to`），别去动
  if (rule.parent?.type === 'atrule' && (rule.parent as { name?: string }).name !== 'media') return
  if (rule.selectors.every(isTheirs)) {
    rule.remove()
    return
  }
  // 一条规则有好几个选择器时，只摘掉属于他们的那几个
  const keep = rule.selectors.filter((s) => !isTheirs(s))
  if (keep.length !== rule.selectors.length) rule.selectors = keep
})
const baseCss = base.toString()

const head =
  `/* 由 build.ts 拼装：**裁剪过的** dockview 基础规则 + gwb 自己那套主题。\n` +
  ` * 它自带的 18 套主题连同 .dockview-spaced 那个 modifier 一起删掉了——我们一套都不用。\n` +
  ` * 这张不按选择器限定范围（.dv-* 由 dockview 自己创建，portal 元素在 body 下）。\n` +
  ` * 改主题改 src/client/dockview-theme.css 重新构建，别手改这份 */\n`
const out = head + baseCss + '\n' + themeCss
fs.writeFileSync(path.join(here, 'dist', 'dockview.css'), out, 'utf8')

const saved = Buffer.byteLength(rawCss, 'utf8') - Buffer.byteLength(baseCss, 'utf8')
console.log(
  `[shell] dist/dockview.css ← 基础规则 + gwb theme（${Buffer.byteLength(out, 'utf8').toLocaleString()} 字节，` +
    `裁掉他们的主题省了 ${saved.toLocaleString()}）`,
)

/* ──────────────────────────────────────────────────────────
 * 令牌的两张表。
 * theme.css 不经 Tailwind 编译——这张表里没有一个工具类，只有 preflight、令牌值与两条
 * base 规则；工具类由各个插件在自己构建时编译（它们引用的是映射表 theme.reference.css）。
 * ────────────────────────────────────────────────────────── */

/**
 * 层顺序由这张表声明，而且它得**第一个**加载：插件的样式表只写 `@layer utilities { … }`、
 * 自己不声明顺序。而 CSS 里**未分层的规则优先级高于所有分层规则**——preflight
 * 不包进 base 层的话，它会盖掉插件样式表里的工具类。
 */
const LAYERS = '@layer theme, base, components, utilities;'

const preflight = fs.readFileSync(require.resolve('tailwindcss/preflight.css'), 'utf8')
const tokensCss = fs.readFileSync(path.join(here, 'src', 'tokens', 'tokens.css'), 'utf8')

fs.writeFileSync(
  path.join(here, 'dist', 'theme.css'),
  `${LAYERS}\n\n@layer base {\n${preflight}\n}\n\n${tokensCss}`,
  'utf8',
)

// 映射表原样发布：插件构建时引用的就是这份
fs.copyFileSync(path.join(here, 'src', 'tokens', 'theme.reference.css'), path.join(here, 'dist', 'theme.reference.css'))

console.log('[shell] dist/theme.css ← preflight + src/tokens/tokens.css')
console.log('[shell] dist/theme.reference.css ← 原样复制')

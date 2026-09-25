import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物测试。这个插件分 node 侧与浏览器侧，两侧的规矩不一样：
 *
 * - **node 侧**（`dist/index.js` 那几个，tsc 输出）：相对 import 带扩展名、没有按值 import 的包名
 * - **浏览器侧**（`dist/client.js`，esbuild 打包）：包名 import **只许** react 的四个——它们由
 *   内核页面入口里写死的 importmap 解析到内核包。多一个就是运行时一句
 *   `Failed to resolve module specifier`，而那要打开窗格才看得见
 *
 * node 侧名单为空还有一层意思：logger 与 plugin-manager 在这里是**可选**的
 * （局部注入，源码里只有 `import type {}`）。哪天有人把它写成运行时 import，这条
 * 会当场失败——否则现象是「home 里没装那两个基础插件时少注册一个窗格」之外
 * 还多一句 ERR_MODULE_NOT_FOUND，看不出是依赖写错了地方。
 *
 * 没有产物时整组跳过——门禁不依赖 build。
 */

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const built = fs.existsSync(distDir)

if (!built) console.warn('[gwb-baseui] dist/ 还没有生成，产物测试跳过（pnpm build 之后再跑）')

/** node 侧运行时按值 import 的包名：一个都没有（全是 import type；内核包的包根一加载就启动 Electron 应用） */
const ALLOWED_BARE = new Set<string>()

/** 内核页面入口写死的 importmap 里的四个包名，与 build.ts 的 PAGE_IMPORTMAP_NAMES 一一对应 */
const PAGE_IMPORTMAP_NAMES = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'])

const CLIENT = 'client.js'

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

function specsIn(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((m) => m[1]!)
}

/** 只匹配行首：产物里顶层 import 都顶格写，字符串字面量里的总带着缩进 */
const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

/** css 注释 */
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g
/**
 * 一条规则的选择器（或 at-rule 的头）：`{` 之前、上一个 `{` / `}` / `;` 之后的那一段。
 * 只在这一段里找类——直接全文搜 `.xxx` 会把声明值里的小数（`0.25rem` 的 `.25rem`）
 * 也当成类选择器
 */
const PRELUDE = /(?:^|[{};])([^{};]*)\{/g
/** 一个类选择器。转义序列（`.baseui\:flex` 里那个 `\:`）整体匹配 */
const CLASS_SELECTOR = /\.(?:\\.|[A-Za-z0-9_-])+/g
/**
 * 唯一放行的非前缀类：`.dark` 是页面级的亮暗标志，加在 `<html>` 上、由令牌表
 * 与外壳负责。它只作为祖先出现在 `baseui:dark:*` 编译出的
 * `.baseui\:dark\:…:is(.dark *)` 里，不是本插件元素上的类
 */
const DARK_FLAG = new Set(['.dark'])

function classSelectors(css: string): string[] {
  const found = new Set<string>()
  for (const rule of css.replaceAll(CSS_COMMENT, '').matchAll(PRELUDE)) {
    const prelude = rule[1]!.trim()
    if (prelude.startsWith('@')) continue
    for (const cls of prelude.matchAll(CLASS_SELECTOR)) found.add(cls[0])
  }
  return [...found]
}

describe.skipIf(!built)('产物', () => {
  const all = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) : []
  const nodeHalf = all.filter((f) => f !== CLIENT)

  it('两侧都有产物可查', () => {
    expect(nodeHalf.length).toBeGreaterThan(0)
    expect(all).toContain(CLIENT)
  })

  it('node 侧：相对 import 一律带扩展名——产物由 node 直接加载，ESM 不补扩展名', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      for (const spec of specsIn(read(file), RELATIVE)) {
        if (!spec.endsWith('.js')) bad.push(`${file}: ${spec}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('node 侧：没有按值 import 的包名——logger / plugin-manager 是局部注入的可选依赖，写成运行时 import 这里当场失败', () => {
    const bare = new Set<string>()
    for (const file of nodeHalf) {
      for (const spec of specsIn(read(file), BARE)) {
        if (!spec.startsWith('node:')) bare.add(spec)
      }
    }
    expect([...bare].filter((s) => !ALLOWED_BARE.has(s))).toEqual([])
  })

  it('node 侧：浏览器侧的源文件没被 tsc 一起编译进来——它们是 esbuild 的输入，不是产物', () => {
    expect(fs.existsSync(path.join(distDir, 'client'))).toBe(false)
  })

  it('浏览器侧：包名 import 只许页面 importmap 里的四个', () => {
    const leaked = specsIn(read(CLIENT), BARE).filter((s) => !PAGE_IMPORTMAP_NAMES.has(s))
    expect(leaked).toEqual([])
  })

  it('style.css 里的类选择器一律 .baseui\\: 开头——靠类名前缀隔离', () => {
    const bad = classSelectors(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8'))
      .filter((s) => !s.startsWith('.baseui\\:') && !DARK_FLAG.has(s))
      .sort()
    expect(bad).toEqual([])
  })

  it('style.css 里没有 data-gwb-plugin——靠前缀隔离之后，这张表不依赖任何祖先关系', () => {
    expect(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8')).not.toContain('data-gwb-plugin')
  })

  it('radix / cva 打包进了 client.js——外置成包名就是运行时一句 Failed to resolve', () => {
    // 认编译后的产物，别写 JSX 里那种原样字面量：esbuild 会把属性编成对象的键
    expect(read(CLIENT)).toContain('data-slot')
  })

  it('卸载在界面上有入口：plugin-manager.uninstall 得打包进 client.js', () => {
    const client = read(CLIENT)
    // 只认 ASCII 标记：esbuild 默认把非 ASCII 转义成 \\uXXXX，中文在产物里搜不到
    expect(client).toContain('plugin-manager.uninstall')
    expect(client).toContain('pnpm remove')
  })

  /* —— 零字面 fallback 与颜色白名单 ——
   * 规则正本：docs-site「令牌与颜色：共享规则」第六节。两条都在测试时读取正本，不手写名单。 */

  it('style.css 零字面 fallback——值只许查表（令牌变量或 currentcolor 关键字）', () => {
    const css = read('style.css')
    /** tw-animate-css 包内写死的动画默认值（animation 简写、enter/exit 变换那一组），
     *  令牌映射文件管不到：它们是动画的运行时默认（时长 0s、次数 1、位移 0、缩放 1），
     *  不是设计值。除此之外，fallback 必须是 var() 引用。 */
    const mechanismDefault = (key: string, fb: string) =>
      key.startsWith('--tw-animation-') ||
      key.startsWith('--tw-enter-') ||
      key.startsWith('--tw-exit-') ||
      (key === '--tw-ease' && fb === 'ease')
    const bad = [...css.matchAll(/var\((--[\w-]+),\s*([^;{)]+)\)/g)]
      .filter((m) => !mechanismDefault(m[1]!, m[2]!.trim()))
      .map((m) => m[2]!.trim())
      .filter((v) => !v.startsWith('var(') && v !== 'currentcolor')
    expect([...new Set(bad)].sort()).toEqual([])
  })

  it('style.css 颜色类只在白名单内——令牌映射文件 ∪ 本插件样式入口 @theme 注册的', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const tokenMap = fs.readFileSync(
      path.join(root, 'node_modules/@godcreator/gwb-shell/dist/theme.reference.css'),
      'utf8',
    )
    const ownEntry = fs.readFileSync(path.join(root, 'src/client/styles.css'), 'utf8')
    const allowed = new Set([
      // 特殊色名：transparent / inherit / current 是 CSS 关键字，不是调色板也不是令牌
      'transparent',
      'inherit',
      'current',
      ...[...`${tokenMap}\n${ownEntry}`.matchAll(/--color-([\w-]+)\s*:/g)].map((m) => m[1]!),
    ])
    // text- 族带字号与对齐歧义，border-/divide- 带边侧与宽度歧义——这些形态不是色名
    const NON_COLOR = /^(?:[bltrxy2](?:-\d+)?|\d|center|left|right|justify|start|end|xs|sm|base|lg|xl|2xl|3xl|4xl)$/
    const FAMILY = '(?:text|bg|border|from|via|to|divide)-'
    const bad = new Set<string>()
    for (const sel of classSelectors(read('style.css'))) {
      for (const m of sel.matchAll(new RegExp(`(?:^|\\\\:)${FAMILY}([\\w-]+)`, 'g'))) {
        const name = m[1]!
        if (NON_COLOR.test(name)) continue
        if (!allowed.has(name)) bad.add(sel)
      }
    }
    expect([...bad].sort()).toEqual([])
  })
})

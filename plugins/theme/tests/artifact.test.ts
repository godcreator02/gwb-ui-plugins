import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物测试。没有产物时整组跳过——门禁不依赖 build。
 *
 * 两侧的规矩照 shell 那份：node 侧由 tsc 输出（`index.js` 与 `startup-css.js`），
 * 浏览器侧由 esbuild 打包（`client.js`，react 的四个包名外置给 importmap，其余打包进去）。
 * node 侧 = 所有 .js 减掉 client.js。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(here, '../dist')
const built = fs.existsSync(distDir)

if (!built) console.warn('[gwb-theme] dist/ 还没有生成，产物测试跳过（pnpm build 之后再跑）')

const CLIENT = 'client.js'
/** node 侧运行时按值 import 的包名：一个都没有。内核包与用到的插件都是 `import type`，编译后整句删掉，不该出现 */
const ALLOWED_BARE = new Set<string>()
/** 内核页面入口写死的 importmap 里的四个包名，与 build.ts 外置的是同一份名单 */
const PAGE_IMPORTMAP_NAMES = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'])
/** 只匹配行首：字符串字面量里的 import 总带着缩进，顶格的才是顶层 import */
const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

/** css 注释 */
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g
/**
 * 一条规则的选择器（或 at-rule 的头）：`{` 之前、上一个 `{` / `}` / `;` 之后的那一段。
 * **只在这一段里找类**——直接全文搜 `.xxx` 会把声明值里的小数（`0.25rem` 的 `.25rem`）
 * 也当成类选择器
 */
const PRELUDE = /(?:^|[{};])([^{};]*)\{/g
/** 一个类选择器。转义序列（`.theme\:flex` 里那个 `\:`）整体匹配 */
const CLASS_SELECTOR = /\.(?:\\.|[A-Za-z0-9_-])+/g
/**
 * **唯一放行的非前缀类**：`.dark` 是页面级的亮暗标志，加在 `<html>` 上、由令牌表
 * 与外壳负责。它只作为**祖先**出现在 `theme:dark:*` 编译出的
 * `.theme\:dark\:…:is(.dark *)` 里，不是本插件元素上的类
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

  it('两侧都在——node 侧的 index.js 与 startup-css.js，浏览器侧的 client.js', () => {
    expect(nodeHalf.sort()).toEqual(['index.js', 'startup-css.js'])
    expect(all).toContain(CLIENT)
  })

  it('node 侧：相对 import 一律带扩展名——产物由 node 直接加载，ESM 不补扩展名', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      const text = fs.readFileSync(path.join(distDir, file), 'utf8')
      for (const m of text.matchAll(RELATIVE)) {
        if (!m[1]!.endsWith('.js')) bad.push(`${file}: ${m[1]!}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('node 侧：没有按值 import 的包名——内核包的包根一加载就启动 Electron 应用，只能 import type', () => {
    const bare = new Set<string>()
    for (const file of nodeHalf) {
      const text = fs.readFileSync(path.join(distDir, file), 'utf8')
      for (const m of text.matchAll(BARE)) {
        const spec = m[1]!
        if (!spec.startsWith('node:')) bare.add(spec)
      }
    }
    expect([...bare].filter((s) => !ALLOWED_BARE.has(s))).toEqual([])
  })

  it('浏览器侧：包名 import 只许页面 importmap 里的四个——多出一个，浏览器就解析不到', () => {
    const text = fs.readFileSync(path.join(distDir, CLIENT), 'utf8')
    const bare = [...text.matchAll(BARE)].map((m) => m[1]!)
    expect(bare.filter((s) => !PAGE_IMPORTMAP_NAMES.has(s))).toEqual([])
  })

  it('style.css 里的类选择器一律 .theme\\: 开头——靠类名前缀隔离', () => {
    const bad = classSelectors(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8'))
      .filter((s) => !s.startsWith('.theme\\:') && !DARK_FLAG.has(s))
      .sort()
    expect(bad).toEqual([])
  })

  it('style.css 里没有 data-gwb-plugin——靠前缀隔离之后，这张表不依赖任何祖先关系', () => {
    // 出现它说明构建改回了按选择器限定范围（scope）的做法。
    // 症状是弹出层（portal 到 body 的那些）没有样式，而构建照样通过
    expect(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8')).not.toContain('data-gwb-plugin')
  })

  /* —— 零字面 fallback 与颜色白名单 ——
   * 规则正本：docs-site「令牌与颜色：共享规则」第六节。两条都在测试时读取正本，不手写名单。 */

  it('style.css 零字面 fallback——值只许查表（令牌变量或 currentcolor 关键字）', () => {
    const css = fs.readFileSync(path.join(distDir, 'style.css'), 'utf8')
    /** tw-animate-css 包内写死的动画默认值（animation 简写、enter/exit 变换那一组），
     *  令牌映射文件管不到：它们是动画的运行时默认（时长 0s、次数 1、位移 0、缩放 1），不是设计值。 */
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
    const NON_COLOR =
      /^(?:[bltrxy2](?:-\d+)?|\d|center|left|right|justify|start|end|xs|sm|base|lg|xl|2xl|3xl|4xl)$/
    const FAMILY = '(?:text|bg|border|from|via|to|divide)-'
    const bad = new Set<string>()
    for (const sel of classSelectors(fs.readFileSync(path.join(distDir, 'style.css'), 'utf8'))) {
      for (const m of sel.matchAll(new RegExp(`(?:^|\\\\:)${FAMILY}([\\w-]+)`, 'g'))) {
        const name = m[1]!
        if (NON_COLOR.test(name)) continue
        if (!allowed.has(name)) bad.add(sel)
      }
    }
    expect([...bad].sort()).toEqual([])
  })
})

describe('注册窗格时报上地址', () => {
  const source = fs.readFileSync(path.resolve(here, '../src/index.ts'), 'utf8')

  /**
   * 内核不读 exports 表：插件注册窗格时报上浏览器侧代码与样式表的 `file://` 地址，
   * 从自己的 `import.meta.url` 算。漏了这两个字段的症状是窗格打开后只显示一句错误，
   * 而那要打开那个窗格才看得见——所以在这里检查。
   */
  it('两个地址都从 import.meta.url 算', () => {
    expect(source).toContain("new URL('./client.js', import.meta.url).href")
    expect(source).toContain("new URL('./style.css', import.meta.url).href")
  })

  it('registerPane 把两个地址都报上去了', () => {
    expect(source).toContain('client: CLIENT_URL')
    expect(source).toContain('style: STYLE_URL')
  })
})

describe('包清单', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(here, '../package.json'), 'utf8')) as {
    exports?: Record<string, unknown>
    files?: string[]
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
    devDependencies?: Record<string, string>
  }

  it('dist 和 src 都进了 files——检查浏览器侧代码要读 src', () => {
    expect(manifest.files).toContain('dist')
    expect(manifest.files).toContain('src')
  })

  it('外壳写在 peer 里、标可选，不另写 dev——没装外壳时本插件照常加载，由 inject 里没有 gwbShell 保证', () => {
    expect(manifest.peerDependencies?.['@godcreator/gwb-shell']).toBeDefined()
    expect(manifest.peerDependenciesMeta?.['@godcreator/gwb-shell']?.optional).toBe(true)
    expect(manifest.devDependencies?.['@godcreator/gwb-shell']).toBeUndefined()
  })
})

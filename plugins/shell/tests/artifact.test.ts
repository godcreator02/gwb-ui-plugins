import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物测试。这个插件分 node 侧与浏览器侧，两侧的规矩不一样：
 *
 * - **node 侧**（`dist/*.js`，tsc 输出）：相对 import 带扩展名、包名 import 只许 cordis 与词汇表包
 * - **浏览器侧**（`dist/client.js`，esbuild 打包）：包名 import **只许**那四个共享包名——它们由
 *   页面 importmap 解析到外壳。多一个（比如 dockview 被误配成 external）就是运行时
 *   一句 `Failed to resolve module specifier`，而那要打开窗格才看得见
 * - **子路径 `./pane`**（`dist/types/`，tsc 只输出声明）：只有 d.ts，引用到的文件里没有包名 import
 *
 * 没有产物时整组跳过——`pnpm check` 不依赖 build。
 */

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const built = fs.existsSync(distDir)

/** 页面 importmap 提供的那四个，跟 build.ts 的 SHARED 一一对应 */
const SHARED = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'])

const CLIENT = 'client.js'

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

/** 去掉 css 注释。检查规则之前要先去掉讲这条规则的说明文字 */
function stripComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

function specsIn(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((m) => m[1] ?? m[2]!)
}

/**
 * **只匹配行首**（`^` + `m`）：dockview 的一句错误消息里嵌着示例代码
 * `  import 'dockview-enterprise';`，不限行首就会误报企业包打进了 client.js。
 * 依据是 tsc 与 esbuild 都把顶层 import 写在行首，字符串字面量里的带缩进。
 */
const RELATIVE = /^import\s+(?:[^'"]*from\s*)?['"](\.[^'"]*)['"]/gm
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

/**
 * 一条规则的选择器（或 at-rule 的头）：`{` 之前、上一个 `{` / `}` / `;` 之后的那一段。
 * **只在这一段里找类**——直接全文搜 `.xxx` 会把声明值里的小数（`0.25rem` 的 `.25rem`）
 * 也当成类选择器
 */
const PRELUDE = /(?:^|[{};])([^{};]*)\{/g
/** 一个类选择器。转义序列（`.shell\:flex` 里那个 `\:`）整体匹配 */
const CLASS_SELECTOR = /\.(?:\\.|[A-Za-z0-9_-])+/g
/**
 * **唯一放行的非前缀类**：`.dark` 是页面级的亮暗标志，加在 `<html>` 上、由令牌表
 * 与外壳启动代码负责。它只作为**祖先**出现在 `shell:dark:*` 编译出的
 * `.shell\:dark\:…:is(.dark *)` 里，不是外壳自己元素上的类
 */
const DARK_FLAG = new Set(['.dark'])

function classSelectors(css: string): string[] {
  const found = new Set<string>()
  for (const rule of stripComments(css).matchAll(PRELUDE)) {
    const prelude = rule[1]!.trim()
    if (prelude.startsWith('@')) continue
    for (const cls of prelude.matchAll(CLASS_SELECTOR)) found.add(cls[0])
  }
  return [...found]
}

describe.skipIf(!built)('产物', () => {
  const all = built ? fs.readdirSync(distDir).filter((f) => f.endsWith('.js')) : []
  /** 外壳提供给页面 importmap 的 react 四个包：属于浏览器侧，里面的包名 import react 由 importmap 解析 */
  const VENDOR = new Set(['react.js', 'react-jsx-runtime.js', 'react-dom.js', 'react-dom-client.js'])
  const nodeHalf = all.filter((f) => f !== CLIENT && !VENDOR.has(f))

  it('两侧都有产物可查', () => {
    expect(nodeHalf.length).toBeGreaterThan(0)
    expect(all).toContain(CLIENT)
  })

  it('node 侧：相对 import 一律带扩展名', () => {
    const bad: string[] = []
    for (const file of nodeHalf) {
      for (const spec of specsIn(read(file), RELATIVE)) {
        if (!spec.endsWith('.js')) bad.push(`${file}: ${spec}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('node 侧：包名 import 只许 cordis 与词汇表包——Service 基类必须是宿主那一份，requireKernel 是真函数', () => {
    const allowed = new Set(['cordis', '@godcreator/gwb-plugin-api'])
    const bare: string[] = []
    for (const file of nodeHalf) {
      for (const spec of specsIn(read(file), BARE)) {
        if (!spec.startsWith('node:') && !allowed.has(spec)) bare.push(`${file}: ${spec}`)
      }
    }
    expect(bare).toEqual([])
  })

  it('浏览器侧：包名 import 只许那四个共享的，dockview 得打包进 client.js', () => {
    const leaked = specsIn(read(CLIENT), BARE).filter((s) => !SHARED.has(s))
    expect(leaked).toEqual([])
  })

  it('浏览器侧：dockview 真的在 client.js 里（外置了的话这条会失败）', () => {
    expect(read(CLIENT)).toContain('dv-groupview')
  })

  /**
   * 登记时认图标名、标签上画图标，用的必须是同一份 lucide：名单是 build.ts 从 lucide-react 读出的，
   * client.js 里是 esbuild 打包进去的全集。任一边变少（名单旧了、全集被 tree-shaking 删成几个），就会「登记说认得、
   * 标签画成 #」或反过来，两边都不报错
   */
  it('图标名单跟打包进 client.js 的 lucide 全集是同一份', () => {
    const require = createRequire(import.meta.url)
    const icons = Object.keys((require('lucide-react') as { icons: Record<string, unknown> }).icons).sort()
    const version = (require('lucide-react/package.json') as { version: string }).version
    expect(JSON.parse(read('pane-icons.json'))).toEqual({ lucide: version, keys: icons })
    // 全集真在 client.js 里：挑几个最早那八个名字之外的正式名字，它们随图标数据一起打包进去
    const client = read(CLIENT)
    for (const name of ['layout-grid', 'receipt', 'gauge', 'zap']) expect(client).toContain(`name: "${name}"`)
  })

  it('两张样式表都生成了，各自的隔离规则不同', () => {
    const own = fs.readFileSync(path.join(distDir, 'style.css'), 'utf8')
    const dockview = fs.readFileSync(path.join(distDir, 'dockview.css'), 'utf8')
    // 外壳自己那张靠类名前缀隔离：类选择器一律以 .shell\: 开头
    expect(classSelectors(own).filter((s) => !s.startsWith('.shell\\:') && !DARK_FLAG.has(s)).sort()).toEqual([])
    // 出现 data-gwb-plugin 说明构建改成了按选择器限定范围（scope）的做法。症状是状态栏两个
    // portal 到 body 的菜单没有样式，而构建照样通过
    expect(stripComments(own)).not.toContain('data-gwb-plugin')
    // dockview 那张**不许有任何 scope 规则**：portal 元素放在 body 下，限定在容器里的规则匹配不上它们。
    // 先去掉注释——两张表开头的注释都提到 data-gwb-plugin，不去掉的话查到的是说明文字而不是规则
    expect(stripComments(dockview)).not.toContain('data-gwb-plugin')
    expect(dockview).toContain('.dockview-theme-gwb')
  })

  /**
   * 裁剪 dockview 样式表是**每次构建都在跑的代码**，写坏了有两种症状：裁多了是某个交互没样式，
   * 裁少了是它自带的主题生效、盖掉我们的值。两种都不报错，所以在这里检查。
   */
  it('dockview 自带的主题一个都不许剩，除了我们自己那个', () => {
    const css = stripComments(fs.readFileSync(path.join(distDir, 'dockview.css'), 'utf8'))
    const theirs = [...css.matchAll(/\.dockview-[a-z0-9-]+/g)]
      .map((m) => m[0])
      .filter((c) => c !== '.dockview-theme-gwb')
    expect([...new Set(theirs)]).toEqual([])
  })

  it('裁完之后基础规则还在——窗格容器本身的规则不能被裁掉', () => {
    const css = fs.readFileSync(path.join(distDir, 'dockview.css'), 'utf8')
    // 这几个类是窗格容器的基本结构，全由 dockview 的 JS 创建，规则少一条就是一处没样式
    for (const cls of ['.dv-groupview', '.dv-tabs-and-actions-container', '.dv-tab', '.dv-sash', '.dv-drop-target']) {
      expect(css).toContain(cls)
    }
    // 裁掉的是约三分之二（那批主题），剩下的应该在 50–70KB 之间；超出这个范围说明裁剪逻辑出错了
    const bytes = Buffer.byteLength(css, 'utf8')
    expect(bytes).toBeGreaterThan(45_000)
    expect(bytes).toBeLessThan(75_000)
  })

  /* —— 零字面 fallback 与颜色白名单 ——
   * 规则正本：docs-site「令牌与颜色：共享规则」第六节。两条都在测试时读取正本，不手写名单。 */

  it('style.css 零字面 fallback——值只许查表（令牌变量或 currentcolor 关键字）', () => {
    const css = fs.readFileSync(path.join(distDir, 'style.css'), 'utf8')
    /** tw-animate-css 包内写死的动画默认值（animation 简写、enter/exit 变换那一组），
     *  令牌映射文件（theme.reference.css）管不到：它们是动画的运行时默认（时长 0s、次数 1、位移 0、缩放 1），不是设计值。 */
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

  it('style.css 颜色类只在白名单内——令牌映射面 ∪ 本插件样式入口 @theme 注册的', () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const tokenMap = fs.readFileSync(
      path.join(root, 'src/tokens/theme.reference.css'),
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

  describe('子路径 ./pane：窗格浏览器侧入口的类型', () => {
    const typesDir = path.join(distDir, 'types')
    const declarationFiles = (): string[] =>
      fs
        .readdirSync(typesDir, { recursive: true, encoding: 'utf8' })
        .filter((entry) => fs.statSync(path.join(typesDir, entry)).isFile())

    it('package.json 的 exports 只给 types 条件——没有运行时入口，按值 import 会在构建时报错', () => {
      const manifest = JSON.parse(fs.readFileSync(path.join(distDir, '../package.json'), 'utf8')) as {
        exports: Record<string, unknown>
      }
      expect(manifest.exports['./pane']).toEqual({ types: './dist/types/client/pane-api.d.ts' })
    })

    it('dist/types 下只有 d.ts，构建产物里不多出运行时代码', () => {
      expect(declarationFiles().filter((file) => !file.endsWith('.d.ts'))).toEqual([])
    })

    it('入口导出 mountPane 用到的类型', () => {
      const entry = read('types/client/pane-api.d.ts')
      for (const name of [
        'PaneArgs',
        'PaneHandle',
        'ShellBridge',
        'HostBridge',
        'OpenPaneOptions',
        'Placement',
        'PaneKind',
        'PaneContent',
      ]) {
        expect(entry).toMatch(new RegExp(`export type \\{[^}]*\\b${name}\\b`))
      }
    })

    it('d.ts 链上没有包名 import——调用方的浏览器侧类型检查不用为它多列依赖', () => {
      const packageSpecifiers = declarationFiles().flatMap((file) =>
        [...read(path.join('types', file)).matchAll(/from\s*['"]([^'".][^'"]*)['"]/g)].map(
          (m) => `${file}: ${m[1]!}`,
        ),
      )
      expect(packageSpecifiers).toEqual([])
    })
  })
})

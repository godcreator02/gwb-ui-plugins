import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 产物测试，只查本插件独有的：dockview 与图标全集打包进了 client.js、dockview 样式表的裁剪与主题、主入口与子路径 `./pane`
 * 的类型、node 侧按值 import 的包名。类名前缀、`var()` fallback、颜色只用令牌、浏览器侧只许 importmap 里的名字
 * 由 devkit 的样式检查与发版前检查负责，这里不另查。
 *
 * 没有产物时整组跳过——`pnpm check` 不依赖 build。
 */

const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist')
const built = fs.existsSync(distDir)

const CLIENT = 'client.js'

function read(file: string): string {
  return fs.readFileSync(path.join(distDir, file), 'utf8')
}

/** 去掉 css 注释。检查规则之前要先去掉讲这条规则的说明文字 */
function stripComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 顶层包名 import。只匹配行首（`^` + `m`）：esbuild 把顶层 import 写在行首，
 * 字符串字面量里嵌着的示例代码带缩进
 */
const BARE = /^import\s+(?:[^'"]*from\s*)?['"]([^'".][^'"]*)['"]/gm

describe.skipIf(!built)('产物', () => {
  it('node 侧：包名 import 只许 cordis——Service 基类必须是 home 里那一份；内核包的包根一加载就启动 Electron 应用，只能 import type', () => {
    const allowed = new Set(['cordis'])
    const bare = [...read('index.js').matchAll(BARE)]
      .map((m) => m[1]!)
      .filter((spec) => !spec.startsWith('node:') && !allowed.has(spec))
    expect(bare).toEqual([])
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

  it('dockview.css 不按选择器限定范围，带着我们自己的主题', () => {
    const dockview = read('dockview.css')
    // 不许有任何 scope 规则：portal 元素放在 body 下，限定在容器里的规则匹配不上它们。
    // 先去掉注释——表头的注释提到了 data-gwb-plugin，不去掉的话查到的是说明文字而不是规则
    expect(stripComments(dockview)).not.toContain('data-gwb-plugin')
    expect(dockview).toContain('.dockview-theme-gwb')
  })

  /**
   * 裁剪 dockview 样式表是**每次构建都在跑的代码**，写坏了有两种症状：裁多了是某个交互没样式，
   * 裁少了是它自带的主题生效、盖掉我们的值。两种都不报错，所以在这里检查。
   */
  it('dockview 自带的主题一个都不许剩，除了我们自己那个', () => {
    const css = stripComments(read('dockview.css'))
    const theirs = [...css.matchAll(/\.dockview-[a-z0-9-]+/g)]
      .map((m) => m[0])
      .filter((c) => c !== '.dockview-theme-gwb')
    expect([...new Set(theirs)]).toEqual([])
  })

  it('裁完之后基础规则还在——窗格容器本身的规则不能被裁掉', () => {
    const css = read('dockview.css')
    // 这几个类是窗格容器的基本结构，全由 dockview 的 JS 创建，规则少一条就是一处没样式
    for (const cls of ['.dv-groupview', '.dv-tabs-and-actions-container', '.dv-tab', '.dv-sash', '.dv-drop-target']) {
      expect(css).toContain(cls)
    }
    // 裁掉的是约三分之二（那批主题），剩下的应该在 50–70KB 之间；超出这个范围说明裁剪逻辑出错了
    const bytes = Buffer.byteLength(css, 'utf8')
    expect(bytes).toBeGreaterThan(45_000)
    expect(bytes).toBeLessThan(75_000)
  })

  describe('主入口 dist/index.d.ts 只带公开接口', () => {
    it('不给 cordis 的 Context 补 gwbData / gwbCommands：那段只给外壳自己编译用，发出去下游没注入这两个服务也以为它们在', () => {
      const entry = read('index.d.ts')
      expect(entry).not.toMatch(/\bgwbData\b/)
      expect(entry).not.toMatch(/\bgwbCommands\b/)
      expect(entry).toMatch(/gwbShell: GwbShellApi/)
    })

    it('不列 GwbShell 的私有成员（标了 @internal，tsconfig.build.json 的 stripInternal 去掉它们）', () => {
      expect(read('index.d.ts')).not.toMatch(/\bprivate\b/)
    })

    it('不导出命令名常量、ShellEnv / LayoutDoc / SavedLayout 与注册表的行类型；GwbShellApi 只有 registerPane、describeSelf 与 registerStatusItem', () => {
      const entry = read('index.d.ts')
      expect([...entry.matchAll(/\b[A-Z_]+_COMMAND\b/g)].map((m) => m[0])).toEqual([])
      for (const name of ['ShellEnv', 'LayoutDoc', 'SavedLayout', 'PaneOwner', 'RegisteredPane', 'RegisteredPlugin', 'RegisteredStatusItem']) {
        expect(entry).not.toMatch(new RegExp(`\\b${name}\\b`))
      }
      const shellApi = /export interface GwbShellApi \{([\s\S]*?)\n\}/.exec(entry)?.[1]
      expect(shellApi).toBeDefined()
      expect([...(shellApi ?? '').matchAll(/^ {4}(\w+)\(/gm)].map((m) => m[1])).toEqual(['registerPane', 'describeSelf', 'registerStatusItem'])
      expect(shellApi).not.toMatch(/\bpanes\(/)
      expect(shellApi).not.toMatch(/\bplugins\(/)
      expect(entry).not.toMatch(/\bpanes\(\): /)
      expect(entry).not.toMatch(/\bplugins\(\): /)
    })
  })

  it('发布的 d.ts 里不指向文档站的页面：包里没有文档站，读 d.ts 的人打不开', () => {
    const declarationFiles = fs
      .readdirSync(distDir, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.d.ts'))
    const pointingToDocs = declarationFiles.filter((file) => read(file).includes('.mdx'))
    expect(pointingToDocs).toEqual([])
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

    it('ShellBridge 上没有 bus', () => {
      const shellBridge = /export interface ShellBridge \{([\s\S]*?)\n\}/.exec(read('types/client/types.d.ts'))?.[1]
      expect(shellBridge).toBeDefined()
      expect(shellBridge).toMatch(/\bopenPane\(/)
      expect(shellBridge).not.toMatch(/\bbus\b/)
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

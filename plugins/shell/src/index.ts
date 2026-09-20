import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Service } from 'cordis'
import { requireKernel, type GwbContext, type GwbKernelApi } from '@godcreator/gwb-plugin-api'
// 只为激活 commands 件的 `declare module 'cordis'`——它给 ctx 加上 gwbCommands 这个名字。
// **类型本身也在这儿 import 进来**：下面那份本文件自己的声明要用它（理由见那段注释）
import type { GwbCommands } from '@godcreator/gwb-commands'
// 同一个道理，给 ctx 加上 gwbData：布局档经它落进 home
import type { GwbDataApi } from '@godcreator/gwb-data'
import { createPaneRegistry, type PaneOwner, type PaneRegistry, type PaneSpec, type RegisteredPane } from './pane-registry.js'
import { createPluginRegistry, type PluginInfo, type PluginRegistry, type RegisteredPlugin } from './plugin-registry.js'
import { LAYOUT_DOC, LAYOUT_GET_COMMAND, LAYOUT_SAVE_COMMAND, defaultDoc, parseLayoutDoc } from './layout.js'
import { ENV_COMMAND, PANES_COMMAND, PLUGINS_COMMAND, type ShellEnv, type Versions } from './protocol.js'
import { versionsOf, type RuntimeVersions } from './versions.js'
import { DESKTOP_EVENT, parseDeleteArgs, parseRenameArgs } from './desktops.js'
import { parseOpenPaneArgs } from './open-pane.js'
import { listRowsOf, parsePaneArgs, parsePaneSync, type PaneSync } from './pane-actions.js'
import { PANE_SYNC_COMMAND } from './protocol.js'
import { electronWindows, reloadWindows, type ReloadDeps } from './reload.js'
import { iconProblem, parseIconCatalog, type IconCatalog } from './pane-icon.js'
import { startupCss } from './startup-style.js'

export type { PaneSpec, PaneOwner, RegisteredPane } from './pane-registry.js'
export type { PluginInfo, RegisteredPlugin } from './plugin-registry.js'
export type { SavedLayout, LayoutDoc } from './layout.js'

/**
 * node 半：窗格注册服务。件在自己的 `apply` 里说「我有一格窗格」，浏览器那半经
 * `shell.panes` 这条命令把表取过去。运行时注册与表经命令过桥的判据见文档站。
 */

/**
 * 本件要用的那两项服务在 cordis 的 `Context` 上。
 *
 * **为什么在自己这儿再声明一遍**（2026-09-20 实测）：件各自发的 `declare module 'cordis'`
 * 在 pnpm 的 store 布局下落空——store 里那份件的依赖各自软到带 peer 后缀的目录，同一个
 * cordis 以两条物理路径进程序，TS 7 当成两个模块，增强就加在了另一个 `Context` 上
 * （`pnpm check` 报「属性不存在」，而代码一个字没错；shell 0.13.1 的提交态同样报，
 * 与包的版本无关）。试过的两条路都不通：`preserveSymlinks` 治好了它却让 `dockview-react`
 * 的类型解析不了；把增强从 `declare module` 换成 `declare global` 一样落空。
 * 所以按 import 拿真类型、在本文件声明——语义与那两份 d.ts 里的**逐字一致**，只是换了落点。
 * 上游把软链布局那件事解决了就可以删掉这一段。
 */
declare module 'cordis' {
  interface Context {
    gwbCommands?: GwbCommands
    gwbData: GwbDataApi
  }
}

/** 跨半的命令名与环境形状。常量本体住 `protocol.ts`（纯模块，浏览器半 import 它不带 cordis） */
export { PANES_COMMAND, PLUGINS_COMMAND, ENV_COMMAND } from './protocol.js'
export type { ShellEnv } from './protocol.js'
/** 布局档的两条命令。常量本体住 `layout.ts`（同一个道理） */
export { LAYOUT_GET_COMMAND, LAYOUT_SAVE_COMMAND } from './layout.js'

const nodeRequire = createRequire(import.meta.url)
const fileUrl = (spec: string): string => pathToFileURL(nodeRequire.resolve(spec)).href

function shellEnv(home: string, versions: Versions): ShellEnv {
  return {
    home,
    styles: [
      fileUrl('@godcreator/gwb-tokens/theme.css'),
      new URL('./dockview.css', import.meta.url).href,
      new URL('./style.css', import.meta.url).href,
    ],
    versions,
  }
}

/** 本包清单：`dist/` 的上一级。外壳自己的版本读它 */
const MANIFEST_URL = new URL('../package.json', import.meta.url)

/** 图标名单：`build.ts` 从打进 client.js 的那份 lucide-react 抄出来，跟 client.js 是邻居 */
const ICON_CATALOG_URL = new URL('./pane-icons.json', import.meta.url)

/** 读名单。读不出或形状不对回原因 */
function loadIconCatalog(): IconCatalog | string {
  try {
    return parseIconCatalog(JSON.parse(readFileSync(ICON_CATALOG_URL, 'utf8'))) ?? '形状不对'
  } catch (err: unknown) {
    return String(err)
  }
}

/**
 * 整页重载全部窗口。给命令面的——`plugins.update-all` 热升完靠它让页面重新 import 新束、
 * 重注 importmap；状态栏那颗「刷新」是同一件事的人手版。做法在 `reload.ts`
 */
export const RELOAD_COMMAND = 'shell.reload'

/** 桌面那几条命令。**井在页面那半**，switch / new 只是经内核事件口把动作转进去执行 */
export const DESKTOP_LIST_COMMAND = 'shell.desktop.list'
export const DESKTOP_SWITCH_COMMAND = 'shell.desktop.switch'
export const DESKTOP_NEW_COMMAND = 'shell.desktop.new'

/** 跨件开格那一条。**井在页面那半**，这条只是经内核事件口把动作转进去执行 */
export const OPEN_PANE_COMMAND = 'shell.openPane'

/** 桌面改名与删除。同桌面那几条：转发给页面执行 */
export const DESKTOP_RENAME_COMMAND = 'shell.desktop.rename'
export const DESKTOP_DELETE_COMMAND = 'shell.desktop.delete'

/** 窗格那几条：list 读页面推来的缓存，其余三条转发给页面执行 */
export const PANE_LIST_COMMAND = 'shell.pane.list'
export const PANE_FOCUS_COMMAND = 'shell.pane.focus'
export const PANE_SEND_COMMAND = 'shell.pane.send'
export const PANE_CLOSE_COMMAND = 'shell.pane.close'

/** 消费方拿到的那一格。写 `inject: ['gwbShell']` 才有 */
export interface GwbShellApi {
  /**
   * 注册一格窗格。身份不用给——`pkg` 与 `entryId` 由这儿从调用方的 fiber 上取。`kind` 说清
   * 它是工具窗格还是文档窗格，不说就是 `'tool'`。
   *
   * 回一个注销函数给要提前摘的场景。**不用自己包 `ctx.effect`**：件卸载时这一格
   * 自动从表上摘掉。
   */
  registerPane(spec: PaneSpec): () => void
  /**
   * 报一下自己叫什么。给人看的名字归运行时，不进包清单——包清单里那种字段没人读的
   * 时候没有任何机制会发现（`gwb.title` 就这么死了一阵）。
   *
   * 收尾同 `registerPane`：件卸载时自动从表上摘掉。
   */
  describeSelf(info: PluginInfo): () => void
  /** 此刻表里有哪些格，按注册先后 */
  panes(): RegisteredPane[]
  /** 此刻有哪些件报过名字，按报名先后 */
  plugins(): RegisteredPlugin[]
}

export default class GwbShell extends Service implements GwbShellApi {
  /**
   * 两个都是硬等待——inject 是 cordis 的等待机制，不是建议。没有命令总线，注册表出不了
   * 这个进程；没有 data 件，布局档没地方落，布局就活不过一次重启。
   */
  static inject = ['gwbCommands', 'gwbData']

  /**
   * 注册表本体。**用 TS 的 `private` 不用 `#`**：cordis 给每个消费者派生一份
   * `Object.create(this)`，而 `#` 私有字段的内部槽不在原型链上，派生对象上一读就炸。
   */
  /** 窗格表：键是 (entryId, 窗格 id)，一条条目可以有好几条 */
  private readonly paneTable: PaneRegistry
  /** 件名表：键是 entryId，一条条目至多一条 */
  private readonly pluginTable: PluginRegistry
  /** 提供方自己的嗓门。构造时 this.ctx 还是自己，logger 绑的是本件 */
  private readonly info: (message: string) => void
  /** 内核服务（dataDir / version / emit / setShell）。构造时取——那时 this.ctx 还是提供方自己的 */
  private readonly kernel: GwbKernelApi
  /**
   * 页面推来的窗格清单（`shell.pane.sync`）。node 半没有容器，`shell.pane.list` 读的就是它；
   * 页面每次布局变化落盘时顺手推一份。页面还没推过就是 undefined
   */
  private paneCache: PaneSync | undefined

  constructor(ctx: GwbContext) {
    super(ctx, 'gwbShell')
    this.kernel = requireKernel(ctx)
    // 构造时 this.ctx 还是**提供方**自己的，logger 绑的是本件
    const logger = ctx.logger('gwb-shell')
    const warn = (message: string): void => logger.warn(message)
    this.info = (message: string): void => logger.info(message)
    const catalog = loadIconCatalog()
    if (typeof catalog === 'string') {
      logger.error(`图标名单 ${ICON_CATALOG_URL.href} 读不出（${catalog}）——产物不全，登记时不再核对图标名`)
    }
    const checkIcon = (name: string): string | undefined =>
      typeof catalog === 'string' ? undefined : iconProblem(name, catalog)
    this.paneTable = createPaneRegistry(warn, checkIcon)
    this.pluginTable = createPluginRegistry(warn, checkIcon)
  }

  /** 服务就绪时把命令挂上、把页面根要过来；effect 包着，本件卸载时自动注销 */
  [Service.init](): void {
    const cli = this.ctx.gwbCommands
    // inject 保证了它在，这句只是把类型收窄
    if (cli === undefined) return
    this.registerTableCommands(cli)
    this.registerLayoutCommands(cli)
    this.registerEnvCommand(cli)
    this.registerReloadCommand(cli)
    this.registerDesktopCommands(cli)
    this.registerOpenPaneCommand(cli)
    this.registerPaneCommands(cli)
    // 把页面根要过来。入口是本包的 client.js，effect 包着：本件卸载页面根自动收回
    const entry = new URL('./client.js', import.meta.url).href
    this.ctx.effect(() => this.kernel.setShell(entry))
    this.ctx.logger('gwb-shell').info(
      `窗格注册就绪（ctx.gwbShell），取表走 ${PANES_COMMAND} 与 ${PLUGINS_COMMAND}，布局档走 ${LAYOUT_GET_COMMAND} 与 ${LAYOUT_SAVE_COMMAND}，整页重载走 ${RELOAD_COMMAND}，桌面走 ${DESKTOP_LIST_COMMAND} / ${DESKTOP_SWITCH_COMMAND} / ${DESKTOP_NEW_COMMAND} / ${DESKTOP_RENAME_COMMAND} / ${DESKTOP_DELETE_COMMAND}，跨件开格走 ${OPEN_PANE_COMMAND}，窗格走 ${PANE_LIST_COMMAND} / ${PANE_FOCUS_COMMAND} / ${PANE_SEND_COMMAND} / ${PANE_CLOSE_COMMAND}；页面根已要来，入口 ${entry}`,
    )
  }

  /** 取表那两条：窗格注册表与件名表。注册与调用两处同吃那两个常量 */
  private registerTableCommands(cli: GwbCommands): void {
    this.ctx.effect(() =>
      cli.register(
        {
          name: PANES_COMMAND,
          description: '此刻注册了哪些窗格',
          usage: "无参数。回 [{ id, title, icon?, client?, style?, kind, entryId, pkg }]，按注册先后；kind 是 'tool'（工具窗格，注册时不说就是它）或 'document'（文档窗格）",
          plugin: '@godcreator/gwb-shell',
        },
        () => this.paneTable.list(),
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        { name: PLUGINS_COMMAND, description: '此刻有哪些件报过名字', usage: '无参数', plugin: '@godcreator/gwb-shell' },
        () => this.pluginTable.list(),
      ),
    )
  }

  /** 布局档那两条：取整档、整份替换 */
  private registerLayoutCommands(cli: GwbCommands): void {
    this.ctx.effect(() =>
      cli.register(
        { name: LAYOUT_GET_COMMAND, description: '外壳的布局档（当前布局＋已存清单）', usage: '没存过回 null。无参数', plugin: '@godcreator/gwb-shell' },
        () => this.ctx.gwbData.readDoc(LAYOUT_DOC),
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        { name: LAYOUT_SAVE_COMMAND, description: '整份替换外壳的布局档', usage: '参数是整份布局档 { v, current, saved }（shell.layout.get 回的那个形状）', plugin: '@godcreator/gwb-shell' },
        (args) => {
          // 存这头也过一遍形状：浏览器半自己的 bug 拼出坏档，不该有资格盖掉盘上那份好的
          const doc = parseLayoutDoc(args)
          if (doc === null) return { ok: false, error: '布局档形状不对，不落盘' }
          // registry.run 会 await 这个 promise，落盘的成败进回执
          return this.ctx.gwbData.writeDoc(LAYOUT_DOC, doc).then(() => undefined)
        },
      ),
    )
  }

  /**
   * 浏览器半开机问一次的环境：home、三张样式表的 `file://` 地址，外加这一刻的用户外观样式
   * （theme 没装就没有，见 `startup-style.ts`）
   */
  private registerEnvCommand(cli: GwbCommands): void {
    // Electron 主进程的 process.versions 带 electron / chrome 两格，@types/node 的形状里没有
    const runtime = process.versions as unknown as RuntimeVersions
    const versions = versionsOf(this.kernel.version, readFileSync(MANIFEST_URL, 'utf8'), runtime)
    const env = shellEnv(this.kernel.dataDir, versions)
    this.ctx.effect(() =>
      cli.register(
        {
          name: ENV_COMMAND,
          description: '外壳浏览器半开机要的环境（home、样式表的地址、用户外观样式、版本）',
          usage:
            '回 { home, styles, startupCss?, versions }——startupCss 是 theme.startupCss 此刻的值，theme 没装或没设就没有这一项；versions 是 { kernel, shell, electron, node, chrome }：kernel 取 gwbKernel.version（内核自己报的），shell 是本件版本，其余三格是主进程 process.versions。无参数',
          plugin: '@godcreator/gwb-shell',
        },
        async (): Promise<ShellEnv> => {
          const css = await startupCss(cli)
          return css === undefined ? env : { ...env, startupCss: css }
        },
      ),
    )
  }

  /** 整页重载全部窗口。做法在 `reload.ts` */
  private registerReloadCommand(cli: GwbCommands): void {
    this.ctx.effect(() =>
      cli.register(
        {
          name: RELOAD_COMMAND,
          description: '整页重载全部窗口',
          usage: 'BrowserWindow.webContents.reload：装了新件、热升之后让页面重取注册表、重注 importmap。没有窗口回 ok:false。无参数',
          plugin: '@godcreator/gwb-shell',
        },
        async () => {
          let deps: ReloadDeps
          try {
            deps = await electronWindows()
          } catch (err: unknown) {
            return { ok: false, error: `拿不到 electron 的窗口列表：${String(err)}` }
          }
          const result = reloadWindows(deps)
          if (result.ok) this.info(`整页重载了 ${String(result.reloaded)} 扇窗口`)
          return result
        },
      ),
    )
  }

  /**
   * 桌面那五条。井在页面那半（一口桌面一口、常驻保活），node 这侧只做两件事：
   * 读盘上的档答 list，把 switch / new / rename / delete 经内核事件口转给页面执行——页面
   * 那边收到后自己动、自己落盘。回执只代表「转发了」；要确认结果，稍等一下再 list（页面切换
   * 时同步 flush 一次档）
   */
  private registerDesktopCommands(cli: GwbCommands): void {
    this.ctx.effect(() =>
      cli.register(
        { name: DESKTOP_LIST_COMMAND, description: '此刻有哪些桌面', usage: '回 { desktops: [{id,name}], active }（读盘上布局档，认不出回一口缺省）。无参数', plugin: '@godcreator/gwb-shell' },
        async () => {
          const raw = await this.ctx.gwbData.readDoc(LAYOUT_DOC)
          const doc = parseLayoutDoc(raw) ?? defaultDoc()
          return { desktops: doc.desktops.map(({ id, name }) => ({ id, name })), active: doc.active }
        },
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        { name: DESKTOP_SWITCH_COMMAND, description: '切到某口桌面', usage: '参数 { id?, name? }（id 优先，二者给一）。井在页面那半，这条只把动作转发进去，回执 ok 代表转发了不是切完了', plugin: '@godcreator/gwb-shell' },
        (args) => {
          const a = args as { id?: unknown; name?: unknown } | undefined
          const id = typeof a?.id === 'string' && a.id !== '' ? a.id : undefined
          const name = typeof a?.name === 'string' && a.name !== '' ? a.name : undefined
          if (id === undefined && name === undefined) return { ok: false, error: 'id 与 name 至少给一个' }
          this.kernel.emit({ t: DESKTOP_EVENT, action: 'switch', ...(id === undefined ? {} : { id }), ...(name === undefined ? {} : { name }) })
          return { ok: true, relayed: true }
        },
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        { name: DESKTOP_NEW_COMMAND, description: '新建一口桌面并切过去，出生为空（不铺默认）', usage: '参数 { name? }（缺省叫「桌面 N」）。同 switch：转发给页面执行，回执 ok 代表转发了', plugin: '@godcreator/gwb-shell' },
        (args) => {
          const a = args as { name?: unknown } | undefined
          const name = typeof a?.name === 'string' && a.name.trim() !== '' ? a.name.trim() : undefined
          this.kernel.emit({ t: DESKTOP_EVENT, action: 'new', ...(name === undefined ? {} : { name }) })
          return { ok: true, relayed: true }
        },
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        {
          name: DESKTOP_RENAME_COMMAND,
          description: '给一张桌面改名',
          usage: '参数 { id, name }——id 是桌面 id（shell.desktop.list 现查），name 非空（两头空白去掉）。转发给页面执行，回执 ok 代表转发了',
          plugin: '@godcreator/gwb-shell',
        },
        async (args) => {
          const parsed = parseRenameArgs(args)
          if (!parsed.ok) return { ok: false, error: parsed.error }
          const doc = parseLayoutDoc(await this.ctx.gwbData.readDoc(LAYOUT_DOC)) ?? defaultDoc()
          if (!doc.desktops.some((d) => d.id === parsed.id)) return { ok: false, error: `没有桌面 ${parsed.id}——shell.desktop.list 现查` }
          this.kernel.emit({ t: DESKTOP_EVENT, action: 'rename', id: parsed.id, name: parsed.name })
          return { ok: true, relayed: true }
        },
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        {
          name: DESKTOP_DELETE_COMMAND,
          description: '删除一张桌面，上面的窗格一起关掉（不弹确认）',
          usage:
            '参数 { id }。上面的窗格逐个关掉（插件照常 dispose）再删桌面；删的是当前桌面就切到左边相邻那张（最左边那张就切到右边）。只剩一张时回错。回 { ok, relayed, closed }——closed 是转发那一刻页面清单里那张桌面上的窗格数。转发给页面执行',
          plugin: '@godcreator/gwb-shell',
        },
        async (args) => {
          const parsed = parseDeleteArgs(args)
          if (!parsed.ok) return { ok: false, error: parsed.error }
          const doc = parseLayoutDoc(await this.ctx.gwbData.readDoc(LAYOUT_DOC)) ?? defaultDoc()
          if (!doc.desktops.some((d) => d.id === parsed.id)) return { ok: false, error: `没有桌面 ${parsed.id}——shell.desktop.list 现查` }
          if (doc.desktops.length < 2) return { ok: false, error: '只剩这一张桌面，删不了' }
          const closed = this.paneCache?.entries.filter((e) => e.desktop === parsed.id).length ?? 0
          this.kernel.emit({ t: DESKTOP_EVENT, action: 'delete', id: parsed.id })
          return { ok: true, relayed: true, closed }
        },
      ),
    )
  }

  /**
   * 窗格那几条。`list` 读页面推来的缓存（`shell.pane.sync`，页面每次落盘时推）；`focus` / `send` /
   * `close` 先拿缓存验一下实例在不在，再转发给页面执行——回执 ok 只代表转发了
   */
  private registerPaneCommands(cli: GwbCommands): void {
    const plugin = '@godcreator/gwb-shell'
    this.ctx.effect(() =>
      cli.register(
        {
          name: PANE_SYNC_COMMAND,
          description: '页面专用：把所有桌面上开着的窗格推给 node 半缓存（shell.pane.list 读它）。别调',
          usage: '参数 { entries, desktops, active }——页面每次布局落盘时推一份。别的调用方推进来就是改写了 shell.pane.list 的回执',
          plugin,
        },
        (args) => {
          const sync = parsePaneSync(args)
          if (sync === undefined) return { ok: false, error: '清单形状不对，没收' }
          this.paneCache = sync
          return { ok: true }
        },
      ),
    )
    this.ctx.effect(() =>
      cli.register(
        {
          name: PANE_LIST_COMMAND,
          description: '所有桌面上开着的窗格',
          usage:
            "无参数。回 [{ instance, desktop, group, pkg, entryId, paneId, kind, key, title, preview, active }]，按桌面顺序——instance 是窗格的实例 id（pane.instance），kind 是 'tool' / 'document'，key 是此刻装的内容（件上报过就是上报的那个），active 是它是不是那一组的活动标签。读页面每次落盘时推来的清单，最多慢 400ms；页面还没推过回空表",
          plugin,
        },
        () => {
          const kindOf = (entryId: string, paneId: string) =>
            this.paneTable.list().find((p) => p.entryId === entryId && p.id === paneId)?.kind ?? 'tool'
          return listRowsOf(this.paneCache?.entries ?? [], kindOf)
        },
      ),
    )
    const relay = (name: string, action: 'focus' | 'close' | 'send', description: string, usage: string) =>
      this.ctx.effect(() =>
        cli.register({ name, description, usage, plugin }, (args) => {
          const parsed = parsePaneArgs(action, args)
          if (!parsed.ok) return { ok: false, error: parsed.error }
          const { instance } = parsed.action
          if (this.paneCache !== undefined && !this.paneCache.entries.some((e) => e.instance === instance)) {
            return { ok: false, error: `窗格 ${instance} 不在清单里——${PANE_LIST_COMMAND} 现查` }
          }
          if (parsed.action.action === 'send' && parsed.action.desktop !== undefined && this.paneCache !== undefined) {
            const to = parsed.action.desktop
            if (!this.paneCache.desktops.some((d) => d.id === to)) return { ok: false, error: `没有桌面 ${to}——shell.desktop.list 现查` }
          }
          this.kernel.emit(parsed.action)
          return { ok: true, relayed: true }
        }),
      )
    relay(
      PANE_FOCUS_COMMAND,
      'focus',
      '激活一个窗格；在别的桌面就切过去',
      '参数 { instance }——instance 是 shell.pane.list 回的实例 id。这是显式切桌面的一种。转发给页面执行，回执 ok 代表转发了',
    )
    relay(
      PANE_SEND_COMMAND,
      'send',
      '把一个窗格送到别的桌面',
      '参数 { instance, desktop?, newDesktop?, follow? }——desktop（已有桌面的 id）与 newDesktop（新桌面的名字，true 或空串用缺省名「桌面 N」）给一个。源桌面关掉它（插件 dispose）、目标桌面按目标组规则开一份正式的（工具窗格目标桌面已有就只激活那一份），插件的状态只靠参数带过去。当前桌面不变；follow: true 送完跟过去。转发给页面执行，回执 ok 代表转发了',
    )
    relay(
      PANE_CLOSE_COMMAND,
      'close',
      '关掉一个窗格',
      '参数 { instance }。插件照常 dispose，不切桌面。转发给页面执行，回执 ok 代表转发了',
    )
  }

  /**
   * 跨件开一格：任何件开任何格——身份走注册表的键（entryId + 窗格 id），选项与件在
   * 自己桥上开的同形。「件报不出别人的窗格」那道边界落在件手里的桥上；命令总线本就是
   * 可信面（`docs-site.stop` 能杀进程树，开格不比它敏感），devkit 转调 `docs-site.create`
   * 已是插件互调的先例。先查注册表：格不在表里当场回错，不转发一个注定没动静的动作；
   * 在表里也只转发——井在页面那半，回执 ok 代表转发了不是开完了。
   */
  private registerOpenPaneCommand(cli: GwbCommands): void {
    this.ctx.effect(() =>
      cli.register(
        {
          name: OPEN_PANE_COMMAND,
          description: '开一格窗格（任何件的）',
          usage: "参数 { entryId, paneId, key?, params?, preview?, from?, placement? }——entryId+paneId 是注册表的键（shell.panes 现查），选项与件开自己格的同形：key 命中本桌已开的份就激活、preview 放目标组的预览槽、params 跟着这一份落盘；from 是来源窗格的实例 id（件手上的 pane.instance），新窗格落在它旁边、开在它那张桌面上，页面上找不到就当没给；placement 'auto'（缺省，按目标组规则）或 'side'（开到来源旁边，没有来源就是活动组旁边）。从不切桌面。井在页面那半，回执 ok 代表转发了不是开完了",
          plugin: '@godcreator/gwb-shell',
        },
        (args) => {
          const parsed = parseOpenPaneArgs(args)
          if (!parsed.ok) return { ok: false, error: parsed.error }
          const known = this.paneTable
            .list()
            .some((p) => p.entryId === parsed.action.entryId && p.id === parsed.action.paneId)
          if (!known) {
            return {
              ok: false,
              error: `条目 ${parsed.action.entryId} 的窗格 ${parsed.action.paneId} 不在注册表里——${PANES_COMMAND} 现查`,
            }
          }
          this.kernel.emit(parsed.action)
          return { ok: true, relayed: true }
        },
      ),
    )
  }

  /**
   * 取它的是哪个件。方法里的 `this.ctx` 是**消费者**的 ctx，`fiber.entry` 是 loader
   * 挂上的（不是 cordis 本体的面），所以按运行时形状取、不动全局类型声明。
   *
   * 两样都要：`pkg` 认得出是哪个包，但同一个包挂两条条目时只有 `entryId` 分得开它们。
   */
  private owner(): PaneOwner {
    const fiber = this.ctx.fiber as unknown as { entry?: { id?: unknown; options?: { name?: unknown } } } | undefined
    const entry = fiber?.entry
    const entryId = entry?.id
    const pkg = entry?.options?.name
    if (typeof entryId !== 'string' || entryId === '' || typeof pkg !== 'string' || pkg === '') {
      throw new Error('取不到调用方的身份——ctx.gwbShell 只能在经 cordis.yml 挂上的件里用')
    }
    return { entryId, pkg }
  }

  registerPane(spec: PaneSpec): () => void {
    const owner = this.owner()
    const off = this.paneTable.register(owner, spec)
    // 「哪格窗格是谁的」是注册表最基本的账：过去只有撞名才出声，挂上了反而无声
    this.info(`窗格 ${spec.id}（${spec.title}，${spec.kind === 'document' ? '文档窗格' : '工具窗格'}）登记上了（${owner.pkg}）`)
    // 挂在**调用方**的 effect 上（this.ctx 在方法里是消费者的），件卸载时自动摘。
    // 忘了收的症状是「件卸了格还在，点开是个死格」——静默的错，这层自动把它消掉
    this.ctx.effect(() => off)
    return off
  }

  describeSelf(info: PluginInfo): () => void {
    const owner = this.owner()
    const off = this.pluginTable.describe(owner, info)
    this.info(`${owner.pkg} 报了名字：${info.title}`)
    this.ctx.effect(() => off)
    return off
  }

  panes(): RegisteredPane[] {
    return this.paneTable.list()
  }

  plugins(): RegisteredPlugin[] {
    return this.pluginTable.list()
  }
}

declare module 'cordis' {
  interface Context {
    gwbShell: GwbShellApi
  }
}

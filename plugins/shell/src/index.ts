import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { Service } from 'cordis'
import type { GwbContext, GwbKernelApi } from '@godcreator/gwb-kernel-desktop'
import { requireKernel } from './vocab.js'
import type { GwbCommandDef, GwbCommands } from '@godcreator/gwb-commands'
import type { GwbDataApi } from '@godcreator/gwb-data'
import type { GwbSkillsApi } from '@godcreator/gwb-skills'
import { createPaneRegistry, type PaneOwner, type PaneRegistry, type PaneSpec, type RegisteredPane } from './pane-registry.js'
import { createPluginRegistry, type PluginInfo, type PluginRegistry, type RegisteredPlugin } from './plugin-registry.js'
import { LAYOUT_DOC, LAYOUT_GET_COMMAND, LAYOUT_SAVE_COMMAND, defaultDoc, parseLayoutDoc, type LayoutDoc } from './layout.js'
import { ENV_COMMAND, PANES_COMMAND, PLUGINS_COMMAND, type ShellEnv, type Versions } from './protocol.js'
import { versionsOf, type RuntimeVersions } from './versions.js'
import { DESKTOP_EVENT, parseDeleteArgs, parseRenameArgs } from './desktops.js'
import { parseOpenPaneArgs } from './open-pane.js'
import { listRowsOf, parsePaneArgs, parsePaneSync, type PaneAction, type PaneSync } from './pane-actions.js'
import { PANE_SYNC_COMMAND } from './protocol.js'
import { electronWindows, reloadWindows, type ReloadDeps } from './reload.js'
import { iconProblem, parseIconCatalog, type IconCatalog } from './pane-icon.js'
import { startupCss } from './startup-style.js'

export type { PaneSpec, PaneOwner, RegisteredPane } from './pane-registry.js'
export type { PluginInfo, RegisteredPlugin } from './plugin-registry.js'
export type { SavedLayout, LayoutDoc } from './layout.js'

/** 各插件发的 `declare module 'cordis'` 在 pnpm store 布局下会加到另一个 `Context` 上，所以在本文件按真类型再声明一遍 */
declare module 'cordis' {
  interface Context {
    gwbCommands?: GwbCommands
    gwbData: GwbDataApi
  }
}

export { PANES_COMMAND, PLUGINS_COMMAND, ENV_COMMAND } from './protocol.js'
export type { ShellEnv } from './protocol.js'
export { LAYOUT_GET_COMMAND, LAYOUT_SAVE_COMMAND } from './layout.js'

const PACKAGE_NAME = '@godcreator/gwb-shell'

const nodeRequire = createRequire(import.meta.url)
const fileUrlOfPackageExport = (specifier: string): string => pathToFileURL(nodeRequire.resolve(specifier)).href

function shellEnvWithoutStartupCss(home: string, versions: Versions): ShellEnv {
  return {
    home,
    styles: [
      fileUrlOfPackageExport('@godcreator/gwb-shell/theme.css'),
      new URL('./dockview.css', import.meta.url).href,
      new URL('./style.css', import.meta.url).href,
    ],
    versions,
  }
}

/** 构建产物在 dist/ 下，包清单在上一级 */
const MANIFEST_URL = new URL('../package.json', import.meta.url)

/** `build.ts` 从打包进 client.js 的那份 lucide-react 生成，与 client.js 同目录 */
const ICON_CATALOG_URL = new URL('./pane-icons.json', import.meta.url)

/** 构建产物在 dist/ 下，包根的 skills/ 就是 '../skills/'；这个目录要列进 package.json 的 files */
const OWN_SKILLS_DIR = new URL('../skills/', import.meta.url)

/** 读不出或形状不对回原因 */
function loadIconCatalog(): IconCatalog | string {
  try {
    return parseIconCatalog(JSON.parse(readFileSync(ICON_CATALOG_URL, 'utf8'))) ?? '形状不对'
  } catch (err: unknown) {
    return String(err)
  }
}

/** 名单读不出时不核对图标名 */
function iconCheckerFor(iconCatalogOrLoadError: IconCatalog | string): (name: string) => string | undefined {
  return (name) => (typeof iconCatalogOrLoadError === 'string' ? undefined : iconProblem(name, iconCatalogOrLoadError))
}

function nonEmptyStringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

export const RELOAD_COMMAND = 'shell.reload'

export const DESKTOP_LIST_COMMAND = 'shell.desktop.list'
export const DESKTOP_SWITCH_COMMAND = 'shell.desktop.switch'
export const DESKTOP_NEW_COMMAND = 'shell.desktop.new'

export const OPEN_PANE_COMMAND = 'shell.openPane'

export const DESKTOP_RENAME_COMMAND = 'shell.desktop.rename'
export const DESKTOP_DELETE_COMMAND = 'shell.desktop.delete'

export const PANE_LIST_COMMAND = 'shell.pane.list'
export const PANE_FOCUS_COMMAND = 'shell.pane.focus'
export const PANE_SEND_COMMAND = 'shell.pane.send'
export const PANE_CLOSE_COMMAND = 'shell.pane.close'

/** `inject: ['gwbShell']` 的插件拿到的服务 */
export interface GwbShellApi {
  /**
   * 注册一个窗格；`pkg` 与 `entryId` 由服务从调用方的 fiber 上取，`kind` 不给就是 `'tool'`。
   * 插件卸载时自动注销，不用自己包 `ctx.effect`；返回的注销函数给要提前注销的场景
   */
  registerPane(spec: PaneSpec): () => void
  /** 报自己给人看的名字；注销同 `registerPane` */
  describeSelf(info: PluginInfo): () => void
  /** 按注册先后 */
  panes(): RegisteredPane[]
  /** 按报名字的先后 */
  plugins(): RegisteredPlugin[]
}

export default class GwbShell extends Service implements GwbShellApi {
  /** 必需依赖：缺哪个本插件就不加载，cordis 在日志里写明在等谁 */
  static inject = ['gwbCommands', 'gwbData']

  // 字段用 TS 的 `private` 不用 `#`：cordis 给每个调用方派生 `Object.create(this)`，`#` 字段在派生对象上一读就抛错
  /** 键是 (entryId, 窗格 id) */
  private readonly paneTable: PaneRegistry
  /** 键是 entryId */
  private readonly pluginTable: PluginRegistry
  private readonly logInfo: (message: string) => void
  private readonly kernel: GwbKernelApi
  /** 页面经 `shell.pane.sync` 推来的窗格清单；页面还没推过是 undefined */
  private paneCache: PaneSync | undefined

  constructor(ctx: GwbContext) {
    super(ctx, 'gwbShell')
    // 构造时 this.ctx 是本插件自己的上下文，内核服务与 logger 在这里取
    this.kernel = requireKernel(ctx)
    const logger = ctx.logger('gwb-shell')
    const logWarn = (message: string): void => logger.warn(message)
    this.logInfo = (message: string): void => logger.info(message)
    const iconCatalogOrLoadError = loadIconCatalog()
    if (typeof iconCatalogOrLoadError === 'string') {
      logger.error(`图标名单 ${ICON_CATALOG_URL.href} 读不出（${iconCatalogOrLoadError}）——产物不全，登记时不再核对图标名`)
    }
    const checkIcon = iconCheckerFor(iconCatalogOrLoadError)
    this.paneTable = createPaneRegistry(logWarn, checkIcon)
    this.pluginTable = createPluginRegistry(logWarn, checkIcon)
  }

  [Service.init](): void {
    const commandBus = this.ctx.gwbCommands
    // static inject 保证了它在，这句只为收窄类型
    if (commandBus === undefined) return
    this.registerTableCommands(commandBus)
    this.registerLayoutCommands(commandBus)
    this.registerEnvCommand(commandBus)
    this.registerReloadCommand(commandBus)
    this.registerDesktopCommands(commandBus)
    this.registerOpenPaneCommand(commandBus)
    this.registerPaneCommands(commandBus)
    const clientEntry = this.takeOverPageRoot()
    this.registerOwnSkillsWheneverSkillsPluginIsLoaded()
    this.logReady(clientEntry)
  }

  /** 本插件卸载时页面根自动交还 */
  private takeOverPageRoot(): string {
    const clientEntry = new URL('./client.js', import.meta.url).href
    this.ctx.effect(() => this.kernel.setShell(clientEntry))
    return clientEntry
  }

  /** 说明书插件可选：不写进 static inject，它后加载时补登记、卸载时自动注销 */
  private registerOwnSkillsWheneverSkillsPluginIsLoaded(): void {
    this.ctx.inject(['gwbSkills'], (contextWithSkills) => {
      const { gwbSkills } = contextWithSkills as typeof contextWithSkills & { gwbSkills: GwbSkillsApi }
      contextWithSkills.effect(() => gwbSkills.register(OWN_SKILLS_DIR))
    })
  }

  private logReady(clientEntry: string): void {
    this.ctx.logger('gwb-shell').info(
      `窗格注册就绪（ctx.gwbShell），取表走 ${PANES_COMMAND} 与 ${PLUGINS_COMMAND}，布局文件走 ${LAYOUT_GET_COMMAND} 与 ${LAYOUT_SAVE_COMMAND}，整页重载走 ${RELOAD_COMMAND}，桌面走 ${DESKTOP_LIST_COMMAND} / ${DESKTOP_SWITCH_COMMAND} / ${DESKTOP_NEW_COMMAND} / ${DESKTOP_RENAME_COMMAND} / ${DESKTOP_DELETE_COMMAND}，跨插件开窗格走 ${OPEN_PANE_COMMAND}，窗格走 ${PANE_LIST_COMMAND} / ${PANE_FOCUS_COMMAND} / ${PANE_SEND_COMMAND} / ${PANE_CLOSE_COMMAND}；已接管页面根，入口 ${clientEntry}`,
    )
  }

  /** 登记在本插件的 effect 上，本插件卸载时自动注销 */
  private registerCommand(commandBus: GwbCommands, def: Omit<GwbCommandDef, 'plugin'>, handler: (args?: unknown) => unknown): void {
    this.ctx.effect(() => commandBus.register({ ...def, plugin: PACKAGE_NAME }, handler))
  }

  private registerTableCommands(commandBus: GwbCommands): void {
    this.registerCommand(
      commandBus,
      {
        name: PANES_COMMAND,
        description: '此刻注册了哪些窗格',
        usage: "无参数。回 [{ id, title, icon?, client?, style?, kind, entryId, pkg }]，按注册先后；kind 是 'tool'（工具窗格，注册时不说就是它）或 'document'（文档窗格）",
      },
      () => this.paneTable.list(),
    )
    this.registerCommand(commandBus, { name: PLUGINS_COMMAND, description: '此刻有哪些插件报过名字', usage: '无参数' }, () => this.pluginTable.list())
  }

  private registerLayoutCommands(commandBus: GwbCommands): void {
    this.registerCommand(
      commandBus,
      { name: LAYOUT_GET_COMMAND, description: '外壳的布局文件（各桌面的布局、当前桌面、已存布局）', usage: '没存过回 undefined。无参数' },
      () => this.ctx.gwbData.readDoc(LAYOUT_DOC),
    )
    this.registerCommand(
      commandBus,
      { name: LAYOUT_SAVE_COMMAND, description: '整份替换外壳的布局文件', usage: '参数是整份布局文件 { v, active, desktops, saved }（shell.layout.get 回的那个形状）' },
      (args) => {
        // 保存时也校验形状：浏览器侧的 bug 拼出的坏文件不能覆盖磁盘上好的那份
        const doc = parseLayoutDoc(args)
        if (doc === null) return { ok: false, error: '布局文件形状不对，没有写入磁盘' }
        // 返回 promise：命令总线 await 它，写入失败进回执
        return this.ctx.gwbData.writeDoc(LAYOUT_DOC, doc).then(() => undefined)
      },
    )
  }

  private registerEnvCommand(commandBus: GwbCommands): void {
    // Electron 主进程的 process.versions 带 electron / chrome，@types/node 的形状里没有
    const runtimeVersions = process.versions as unknown as RuntimeVersions
    const versions = versionsOf(this.kernel, readFileSync(MANIFEST_URL, 'utf8'), runtimeVersions)
    const envWithoutStartupCss = shellEnvWithoutStartupCss(this.kernel.dataDir, versions)
    this.registerCommand(
      commandBus,
      {
        name: ENV_COMMAND,
        description: '外壳浏览器侧开机要的环境（home、样式表的地址、用户外观样式、版本）',
        usage:
          '回 { home, styles, startupCss?, versions }——startupCss 是 theme.startupCss 此刻的值，主题插件没装或没设置就没有这一项；versions 是 { kernel, launcher?, shell, electron, node, chrome }：kernel 取 gwbKernel.version（内核自己报的），launcher 取 gwbKernel.launcherVersion（安装包的版本，内核从源码启动或安装包早于 0.3.1 时没有这一项），shell 是外壳版本，其余三项是主进程 process.versions。无参数',
      },
      async (): Promise<ShellEnv> => {
        const userStartupCss = await startupCss(commandBus)
        return userStartupCss === undefined ? envWithoutStartupCss : { ...envWithoutStartupCss, startupCss: userStartupCss }
      },
    )
  }

  private registerReloadCommand(commandBus: GwbCommands): void {
    this.registerCommand(
      commandBus,
      {
        name: RELOAD_COMMAND,
        description: '整页重载全部窗口',
        usage: 'BrowserWindow.webContents.reload：装了新插件、热升级之后让页面重取注册表、重新注入 importmap。没有窗口回 ok:false。无参数',
      },
      async () => {
        let deps: ReloadDeps
        try {
          deps = await electronWindows()
        } catch (err: unknown) {
          return { ok: false, error: `拿不到 electron 的窗口列表：${String(err)}` }
        }
        const result = reloadWindows(deps)
        if (result.ok) this.logInfo(`整页重载了 ${String(result.reloaded)} 个窗口`)
        return result
      },
    )
  }

  /** 认不出就回缺省布局文件 */
  private async readLayoutDocOrDefault(): Promise<LayoutDoc> {
    return parseLayoutDoc(await this.ctx.gwbData.readDoc(LAYOUT_DOC)) ?? defaultDoc()
  }

  /** list 读磁盘上的布局文件，其余四条转发给页面执行；回执 ok 只代表转发了 */
  private registerDesktopCommands(commandBus: GwbCommands): void {
    this.registerCommand(
      commandBus,
      { name: DESKTOP_LIST_COMMAND, description: '此刻有哪些桌面', usage: '回 { desktops: [{id,name}], active }（读磁盘上的布局文件，认不出回一张缺省桌面）。无参数' },
      async () => {
        const doc = await this.readLayoutDocOrDefault()
        return { desktops: doc.desktops.map(({ id, name }) => ({ id, name })), active: doc.active }
      },
    )
    this.registerCommand(
      commandBus,
      { name: DESKTOP_SWITCH_COMMAND, description: '切到某张桌面', usage: '参数 { id?, name? }（id 优先，二者给一）。窗格容器在页面上，这条只把动作转发过去，回执 ok 代表转发了不是切完了' },
      (args) => {
        const switchArgs = args as { id?: unknown; name?: unknown } | undefined
        const id = nonEmptyStringOrUndefined(switchArgs?.id)
        const name = nonEmptyStringOrUndefined(switchArgs?.name)
        if (id === undefined && name === undefined) return { ok: false, error: 'id 与 name 至少给一个' }
        this.kernel.emit({ t: DESKTOP_EVENT, action: 'switch', ...(id === undefined ? {} : { id }), ...(name === undefined ? {} : { name }) })
        return { ok: true, relayed: true }
      },
    )
    this.registerCommand(
      commandBus,
      { name: DESKTOP_NEW_COMMAND, description: '新建一张桌面并切过去，新建时为空（不按默认布局打开）', usage: '参数 { name? }（缺省叫「桌面 N」）。同 switch：转发给页面执行，回执 ok 代表转发了' },
      (args) => {
        const newArgs = args as { name?: unknown } | undefined
        const name = typeof newArgs?.name === 'string' && newArgs.name.trim() !== '' ? newArgs.name.trim() : undefined
        this.kernel.emit({ t: DESKTOP_EVENT, action: 'new', ...(name === undefined ? {} : { name }) })
        return { ok: true, relayed: true }
      },
    )
    this.registerCommand(
      commandBus,
      {
        name: DESKTOP_RENAME_COMMAND,
        description: '给一张桌面改名',
        usage: '参数 { id, name }——id 是桌面 id（用 shell.desktop.list 查），name 非空（两头空白去掉）。转发给页面执行，回执 ok 代表转发了',
      },
      async (args) => {
        const parsed = parseRenameArgs(args)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        const doc = await this.readLayoutDocOrDefault()
        if (!doc.desktops.some((desktop) => desktop.id === parsed.id)) return { ok: false, error: `没有桌面 ${parsed.id}——用 shell.desktop.list 查` }
        this.kernel.emit({ t: DESKTOP_EVENT, action: 'rename', id: parsed.id, name: parsed.name })
        return { ok: true, relayed: true }
      },
    )
    this.registerCommand(
      commandBus,
      {
        name: DESKTOP_DELETE_COMMAND,
        description: '删除一张桌面，上面的窗格一起关掉（不弹确认）',
        usage:
          '参数 { id }。上面的窗格逐个关掉（插件照常 dispose）再删桌面；删的是当前桌面就切到左边相邻那张（最左边那张就切到右边）。只剩一张时回错。回 { ok, relayed, closed }——closed 是转发那一刻页面清单里那张桌面上的窗格数。转发给页面执行',
      },
      async (args) => {
        const parsed = parseDeleteArgs(args)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        const doc = await this.readLayoutDocOrDefault()
        if (!doc.desktops.some((desktop) => desktop.id === parsed.id)) return { ok: false, error: `没有桌面 ${parsed.id}——用 shell.desktop.list 查` }
        if (doc.desktops.length < 2) return { ok: false, error: '只剩这一张桌面，删不了' }
        const closedPaneCount = this.paneCache?.entries.filter((entry) => entry.desktop === parsed.id).length ?? 0
        this.kernel.emit({ t: DESKTOP_EVENT, action: 'delete', id: parsed.id })
        return { ok: true, relayed: true, closed: closedPaneCount }
      },
    )
  }

  /** 页面还没推过清单时不检查，照样转发 */
  private paneActionTargetError(action: PaneAction): string | undefined {
    if (this.paneCache === undefined) return undefined
    if (!this.paneCache.entries.some((entry) => entry.instance === action.instance)) {
      return `窗格 ${action.instance} 不在清单里——用 ${PANE_LIST_COMMAND} 查`
    }
    if (action.action === 'send' && action.desktop !== undefined) {
      const targetDesktop = action.desktop
      if (!this.paneCache.desktops.some((desktop) => desktop.id === targetDesktop)) return `没有桌面 ${targetDesktop}——用 shell.desktop.list 查`
    }
    return undefined
  }

  private registerRelayedPaneCommand(commandBus: GwbCommands, name: string, action: 'focus' | 'close' | 'send', description: string, usage: string): void {
    this.registerCommand(commandBus, { name, description, usage }, (args) => {
      const parsed = parsePaneArgs(action, args)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      const targetError = this.paneActionTargetError(parsed.action)
      if (targetError !== undefined) return { ok: false, error: targetError }
      this.kernel.emit(parsed.action)
      return { ok: true, relayed: true }
    })
  }

  /** list 读页面推来的缓存；focus / send / close 先用缓存检查实例与目标桌面，再转发给页面执行 */
  private registerPaneCommands(commandBus: GwbCommands): void {
    this.registerCommand(
      commandBus,
      {
        name: PANE_SYNC_COMMAND,
        description: '页面专用：把所有桌面上开着的窗格推给 node 侧缓存（shell.pane.list 读它）。别调',
        usage: '参数 { entries, desktops, active }——页面每次保存布局时推一份。别的调用方推进来就是改写了 shell.pane.list 的回执',
      },
      (args) => {
        const pushedPaneSync = parsePaneSync(args)
        if (pushedPaneSync === undefined) return { ok: false, error: '清单形状不对，没有接收' }
        this.paneCache = pushedPaneSync
        return { ok: true }
      },
    )
    this.registerCommand(
      commandBus,
      {
        name: PANE_LIST_COMMAND,
        description: '所有桌面上开着的窗格',
        usage:
          "无参数。回 [{ instance, desktop, group, pkg, entryId, paneId, kind, key, title, preview, active }]，按桌面顺序——instance 是窗格的实例 id（pane.instance），kind 是 'tool' / 'document'，key 是此刻装的内容（插件上报过就是上报的那个），active 是它是不是那一组的活动标签。读页面每次保存布局时推来的清单，最多慢 400ms；页面还没推过回空表",
      },
      () => {
        const registeredKindOf = (entryId: string, paneId: string) =>
          this.paneTable.list().find((pane) => pane.entryId === entryId && pane.id === paneId)?.kind ?? 'tool'
        return listRowsOf(this.paneCache?.entries ?? [], registeredKindOf)
      },
    )
    this.registerRelayedPaneCommand(
      commandBus,
      PANE_FOCUS_COMMAND,
      'focus',
      '激活一个窗格；在别的桌面就切过去',
      '参数 { instance }——instance 是 shell.pane.list 回的实例 id。这是显式切桌面的一种。转发给页面执行，回执 ok 代表转发了',
    )
    this.registerRelayedPaneCommand(
      commandBus,
      PANE_SEND_COMMAND,
      'send',
      '把一个窗格送到别的桌面',
      '参数 { instance, desktop?, newDesktop?, follow? }——desktop（已有桌面的 id）与 newDesktop（新桌面的名字，true 或空串用缺省名「桌面 N」）给一个。源桌面关掉它（插件 dispose）、目标桌面按目标组规则开一份正式的（工具窗格目标桌面已有就只激活那一份），插件的状态只靠参数带过去。当前桌面不变；follow: true 送完跟过去。转发给页面执行，回执 ok 代表转发了',
    )
    this.registerRelayedPaneCommand(
      commandBus,
      PANE_CLOSE_COMMAND,
      'close',
      '关掉一个窗格',
      '参数 { instance }。插件照常 dispose，不切桌面。转发给页面执行，回执 ok 代表转发了',
    )
  }

  /** 窗格不在注册表里当场回错，不转发一个注定没动静的动作；在表里也只是转发 */
  private registerOpenPaneCommand(commandBus: GwbCommands): void {
    this.registerCommand(
      commandBus,
      {
        name: OPEN_PANE_COMMAND,
        description: '打开一个窗格（任何插件的）',
        usage:
          "参数 { entryId, paneId, key?, params?, preview?, from?, placement? }——entryId+paneId 是注册表的键（用 shell.panes 查），选项与插件开自己窗格时相同：key 命中当前桌面已开的那份就激活、preview 放进目标组的预览窗格、params 随这一份保存；from 是来源窗格的实例 id（插件手上的 pane.instance），新窗格开在它旁边、它那张桌面上，页面上找不到就当没给；placement 'auto'（缺省，按目标组规则）或 'side'（开到来源旁边，没有来源就是活动组旁边）。从不切桌面。窗格容器在页面上，回执 ok 代表转发了不是开完了",
      },
      (args) => {
        const parsed = parseOpenPaneArgs(args)
        if (!parsed.ok) return { ok: false, error: parsed.error }
        const paneIsRegistered = this.paneTable
          .list()
          .some((pane) => pane.entryId === parsed.action.entryId && pane.id === parsed.action.paneId)
        if (!paneIsRegistered) {
          return {
            ok: false,
            error: `条目 ${parsed.action.entryId} 的窗格 ${parsed.action.paneId} 不在注册表里——用 ${PANES_COMMAND} 查`,
          }
        }
        this.kernel.emit(parsed.action)
        return { ok: true, relayed: true }
      },
    )
  }

  /** 方法里的 `this.ctx` 是调用方的上下文；`fiber.entry` 是 loader 放的，不在 cordis 的类型里，按运行时形状取 */
  private ownerOfCaller(): PaneOwner {
    const fiber = this.ctx.fiber as unknown as { entry?: { id?: unknown; options?: { name?: unknown } } } | undefined
    const entry = fiber?.entry
    const entryId = entry?.id
    const pkg = entry?.options?.name
    if (typeof entryId !== 'string' || entryId === '' || typeof pkg !== 'string' || pkg === '') {
      throw new Error('取不到调用方的身份——ctx.gwbShell 只能在经 cordis.yml 加载的插件里用')
    }
    return { entryId, pkg }
  }

  registerPane(spec: PaneSpec): () => void {
    const owner = this.ownerOfCaller()
    const unregister = this.paneTable.register(owner, spec)
    this.logInfo(`窗格 ${spec.id}（${spec.title}，${spec.kind === 'document' ? '文档窗格' : '工具窗格'}）登记上了（${owner.pkg}）`)
    // 注销登记在调用方的 effect 上，调用方卸载时窗格跟着注销
    this.ctx.effect(() => unregister)
    return unregister
  }

  describeSelf(info: PluginInfo): () => void {
    const owner = this.ownerOfCaller()
    const unregister = this.pluginTable.describe(owner, info)
    this.logInfo(`${owner.pkg} 报了名字：${info.title}`)
    this.ctx.effect(() => unregister)
    return unregister
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

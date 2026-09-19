import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
  type SerializedDockview,
} from 'dockview-react'
import { GwbTab } from './GwbTab.js'
import { StatusBar, type LaunchGroup } from './StatusBar.js'
import { PluginPanel } from './plugin-panel.js'
import { loadStyle } from './asset.js'
import { fetchPanes, fetchPlugins } from './panes.js'
import { wellHub } from './well-hub.js'
import {
  addInstance,
  closeInstance,
  focusInstance,
  launchGoesTo,
  launchSpec,
  openRegisteredPane,
  sendPane,
  TAB_COMPONENT,
} from './open.js'
import { applyStartupCss, GWB_THEME, THEME_CLASSES } from './theme-boot.js'
import { groupForLauncher, listOpenable, specsForDefaults, type OpenableSpec } from '../openable.js'
import { PLUGIN_COMPONENT } from '../panels.js'
import {
  LAYOUT_GET_COMMAND,
  LAYOUT_SAVE_COMMAND,
  LAYOUT_VERSION,
  defaultDoc,
  nextDesktopId,
  parseLayoutDoc,
  upsertSaved,
  type DesktopRow,
  type LayoutDoc,
  type SavedLayout,
} from '../layout.js'
import { afterDelete, defaultDesktopName, isDesktopAction, renameDesktop, resolveDesktop } from '../desktops.js'
import { isOpenPaneAction, openPaneOptionsOf, openPaneSourceOf } from '../open-pane.js'
import { isPaneAction } from '../pane-actions.js'
import { desktopSections, entriesOfLayout } from '../pane-list.js'
import { ENV_COMMAND, PANE_SYNC_COMMAND, type ShellEnv, type Versions } from '../protocol.js'
import { visibilityHub } from './visibility.js'
import { mountWhenReady, type MountedTree, type Prepare } from './shell-mount.js'
import { DESKTOP_ATTR } from './desktop-context.js'
import type { HostBridge, ShellArgs } from './types.js'

/**
 * 外壳浏览器半的装配：内核契约入口（`mountShell`）、boot（取环境、注样式表、起 React
 * 树）与 App。开格执行在 `open.ts`、页面级状态在 `well-hub`、面板与标签在
 * `plugin-panel` / `GwbTab`、状态栏在 `StatusBar`、外观装配在 `theme-boot`。
 */

const SELF = '@godcreator/gwb-shell'

/** 布局落盘的防抖窗口：一阵拖拽 / 开关格合并成一次写。母仓量下来的一档 */
const SAVE_DEBOUNCE_MS = 400

/** 状态栏那句「… · 切过去」亮多久 */
const NOTICE_MS = 10_000

/** 切完桌面隔多久扫 body：等点出这次切换的状态栏浮层走完退场动画（见 sweepBodyPortals） */
const SWEEP_DELAY_MS = 500

/** 把所有桌面上开着的窗格推给 node 半缓存（`shell.pane.sync`）。推不上只记一句，不拦别的 */
function pushPanes(host: HostBridge, rows: readonly DesktopRow[], active: string): void {
  const sync = { entries: wellHub.entries(), desktops: rows.map(({ id, name }) => ({ id, name })), active }
  void host.call(PANE_SYNC_COMMAND, sync).catch((err: unknown) => {
    console.warn(`[shell] ${PANE_SYNC_COMMAND} 推不上：${String(err)}`)
  })
}

/**
 * 面板组件表。**必须是模块级常量**：dockview 拿它的引用做比对，每轮渲染换一个新对象
 * 会让它把所有格拆了重建。标签表同理——同一个理由，同一个待遇。
 */
const COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  [PLUGIN_COMPONENT]: PluginPanel,
}

/** 标签一律走自己的 pill 组件：图标 + 标题 + 关闭叉，形状与四态见 GwbTab 头注 */
const TAB_COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelHeaderProps>> = {
  [TAB_COMPONENT]: GwbTab,
}

/**
 * 切换后扫一眼 body：**探雷器，不是灭火器**。件的浮层若没把 radix Portal 的 container
 * 指到 `args.shell.portal`，它就挂在 body 上、不跟任何桌面走——藏掉桌面也藏不掉它。
 * 扫到只点名（console.warn），
 * **不删别人的 DOM**。状态栏自己的菜单、面板、确认框也挂 body——它们在桌面体系之外，应该常驻。
 *
 * **切完隔一会儿再扫**（`SWEEP_DELAY_MS`）：切桌面常常就是在状态栏的面板、菜单、确认框里点出来的，
 * 切换那一刻它们还没关（关还要走一段退场动画），当场扫就把状态栏自己点成「漏接线」——实机日志里
 * 从桌面菜单、切换器、删当前桌面的确认框切过去，回回都报。真漏接线的件浮层藏不掉、隔一会儿照样在。
 * radix 的**焦点护栏**（`data-radix-focus-guard` 的两个 span，模态菜单开着时挂在 body 首尾）也不算；
 * 标了 `data-gwb-status-layer` 的状态栏浮层（「桌面」面板，切完桌面它可能还开着）也不算。
 */
function sweepBodyPortals(activeName: string): void {
  const strays: string[] = []
  for (const el of document.body.children) {
    // 根节点、三类非浮层的常态节点、radix 的焦点护栏、状态栏自己的浮层不算
    if (el.id === 'root' || /^(STYLE|SCRIPT|LINK|NOSCRIPT)$/.test(el.tagName)) continue
    if (el.hasAttribute('data-radix-focus-guard')) continue
    if (el.matches('[data-gwb-status-layer]') || el.querySelector('[data-gwb-status-layer]') !== null) continue
    const cls = el.getAttribute('class') ?? ''
    strays.push(`<${el.tagName.toLowerCase()}${cls === '' ? '' : ` class="${cls}"`}>`)
  }
  if (strays.length > 0) {
    console.warn(
      `[shell] 切到「${activeName}」时 body 上还挂着 ${strays.length} 个节点（多半是哪个件的浮层没跟着自己桌面走——radix Portal 的挂载点该指到 args.shell.portal）：${strays.join('、')}`,
    )
  }
}

/**
 * 多桌面 App：一口桌面一个 section 叠在主区里，非活动的只是不显示
 * （visibility:hidden + pointer-events:none + inert），DOM 与订阅全活着；开机只挂
 * 活动那口，首切冷挂、挂上常驻。每口井各自防抖落盘。**切换顺序是机制的一部分**：
 * 记账 → flush → 显隐 → 可见性通知 → 焦点接管 → body 探雷。
 */
function App({
  specs,
  home,
  versions,
  initialDoc,
}: {
  specs: OpenableSpec[]
  home: string
  versions: Versions
  /** 盘上的档（已并好缺省：第一次开机或档废了就是 defaultDoc()，v2 在解析那层已迁成 v3） */
  initialDoc: LayoutDoc
}): ReactElement {
  /** 每口挂着的井各自的 api。井常驻（保活），挂上就不拆——「活动的那口」只是其中之一 */
  const [apis, setApis] = useState<Record<string, DockviewApi>>({})
  /** 已挂井的桌面 id。开机只挂 active 那口，别的桌面第一次切到才挂（冷挂）、挂上常驻 */
  const [mountedIds, setMountedIds] = useState<string[]>(() => [initialDoc.active])
  const [desktops, setDesktops] = useState<DesktopRow[]>(initialDoc.desktops)
  const [activeId, setActiveId] = useState(initialDoc.active)
  /** 人起名存下来的布局清单，档里那半 */
  const [saved, setSaved] = useState<SavedLayout[]>(initialDoc.saved)
  const [saveFailed, setSaveFailed] = useState(false)
  /**
   * 窗格清单变了几回：每次落盘（防抖之后）加一。「桌面」面板开着时拿它重摘清单——面板开着的时候
   * 别处开了、关了窗格（命令、插件、标签上的 ✕），不重摘就一直列着旧的
   */
  const [panesTick, setPanesTick] = useState(0)

  // 回调读的都走 ref：防抖保存醒来时要读「当下」，不能读进闭包那一刻的旧账
  const apisRef = useRef(apis)
  apisRef.current = apis
  const mountedRef = useRef(mountedIds)
  mountedRef.current = mountedIds
  const rowsRef = useRef(desktops)
  rowsRef.current = desktops
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  // 枢纽里的活动桌面（开格链拿它挑「当前桌面」），跟 ref 同一步走——switchTo 里另有一处同步
  // 赋值，保证切完的那一拍里开格就落在新桌面上
  wellHub.setActiveDesktop(activeId)
  const savedRef = useRef(saved)
  savedRef.current = saved
  const timerRef = useRef<number | undefined>(undefined)
  /** 每口井的订阅（布局变化、组激活、拖放落组）。井常驻，跟着 App 卸载一起拆 */
  const wellSubsRef = useRef(new Map<string, { dispose(): void }>())
  /**
   * 运行时新建、还没把出生空快照落盘的那几口（判据见轨迹卡 2026-09-13-desktop-born-empty）。
   * onWellReady 消费即删：井一挂上就 flush 一次，让活井的空 toJSON 顶掉档里的 null——
   * 空井不触发布局事件，null 留在档里的话重启会被「null → 铺默认」复原成满的
   */
  const bornEmptyRef = useRef(new Set<string>())
  /** 等某口井挂上的那几位（`ensureMounted` 排的队）。onWellReady 挂好井就叫醒它们 */
  const readyWaitersRef = useRef(new Map<string, ((api: DockviewApi) => void)[]>())

  const activeApi = apis[activeId] ?? null

  const flushSave = useCallback((): void => {
    window.clearTimeout(timerRef.current)
    const host = wellHub.host()
    if (host === undefined) return
    // **整档为写单位**：desktops 逐口问井自己（活着的那份才是真相；还没挂井的桌面用它
    // 那条存着的），saved 用清单原文。迟到的旧定时器走不到这儿——schedule 每次重排，
    // 醒来的一定是最新这份
    const doc: LayoutDoc = {
      v: LAYOUT_VERSION,
      active: activeIdRef.current,
      desktops: rowsRef.current.map((row) => {
        const api = apisRef.current[row.id]
        return api === undefined ? row : { ...row, layout: api.toJSON() as unknown as Record<string, unknown> }
      }),
      saved: savedRef.current,
    }
    void host.call(LAYOUT_SAVE_COMMAND, doc).then(
      (reply) => {
        const typed = reply as { ok?: boolean; error?: string }
        setSaveFailed(typed.ok !== true)
        if (typed.ok !== true) console.error(`[shell] 布局没存上：${typed.error ?? '没说原因'}`)
      },
      (err: unknown) => {
        setSaveFailed(true)
        console.error(`[shell] 布局没存上：${String(err)}`)
      },
    )
    // 顺手把窗格清单推给 node 半（`shell.pane.list` 读它）：跟落盘同一个节律，最多慢一个防抖窗口；
    // 「桌面」面板开着的话也跟着重摘
    pushPanes(host, rowsRef.current, activeIdRef.current)
    setPanesTick((n) => n + 1)
  }, [])

  const scheduleSave = useCallback((): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
  }, [flushSave])

  // 拆树前抢一把 flush（bootShell 的 dispose 经枢纽的钩子够到它）
  useEffect(() => {
    wellHub.setFlusher(flushSave)
    return () => {
      wellHub.setFlusher(undefined)
    }
  }, [flushSave])

  // 井常驻，订阅与注册表也常驻——App 卸载那趟统一拆
  useEffect(() => {
    const subs = wellSubsRef.current
    return () => {
      for (const sub of subs.values()) sub.dispose()
      subs.clear()
      wellHub.clearWells()
    }
  }, [])

  /**
   * 给这张桌面铺默认布局。走跟 openPane 同一条路：算唯一 id 再开。裸 addPanel 的话，specs 里万一
   * 出现两条同 id，第二条会同步抛、异常冲出 onReady，**整口井起不来**而不是少开一格。
   *
   * **工具窗格全页一份**：别的桌面上已经开着的不再铺（`specsForDefaults`）。整页开着什么按桌面清单
   * 递给枢纽现摘——开机那一下 onReady 比桌面操作的注入早；这张桌面自己那份（铺之前刚清空，或者存档
   * 恢复不了）不算
   */
  const openDefaults = (target: DockviewApi, desktop: string): void => {
    const open = wellHub.entries(rowsRef.current).filter((e) => e.desktop !== desktop)
    for (const spec of specsForDefaults(specs, open)) addInstance(target, spec)
  }

  /**
   * 把一张桌面的井挂上：已经挂着就直接回；没挂过就排进 mountedIds（在后台冷挂、不显示），
   * 等 onWellReady 挂好再回。桌面不存在回 undefined。面板里点没挂过的桌面上的窗格、送到还没去过的桌面
   * 都靠它——**挂井不等于切过去**
   */
  const ensureMounted = useCallback((id: string): Promise<DockviewApi | undefined> => {
    const api = apisRef.current[id]
    if (api !== undefined) return Promise.resolve(api)
    if (!rowsRef.current.some((r) => r.id === id)) return Promise.resolve(undefined)
    return new Promise((resolve) => {
      const waiters = readyWaitersRef.current.get(id) ?? []
      waiters.push(resolve)
      readyWaitersRef.current.set(id, waiters)
      if (!mountedRef.current.includes(id)) {
        mountedRef.current = [...mountedRef.current, id]
        setMountedIds(mountedRef.current)
      }
    })
  }, [])

  /** 一口井挂上（冷挂那一刻）：按它那条档恢复，或铺默认，或（运行时新建的）出生为空；
   * 订阅布局变化。井常驻，只走一次 */
  const onWellReady = (id: string, event: DockviewReadyEvent): void => {
    const row = rowsRef.current.find((r) => r.id === id)
    let restored = false
    if (row?.layout != null) {
      try {
        event.api.fromJSON(row.layout as unknown as SerializedDockview)
        restored = true
      } catch (err) {
        // 这口桌面存着的井恢复不了（存档坏了 / dockview 升了版本）：回默认，不拦井起
        console.warn(`[shell] 桌面「${row.name}」的布局恢复不了，回默认：${String(err)}`)
      }
    }
    // 运行时新建的那口不铺默认——注册表里有几格与它无关（判据见轨迹卡）。首开（defaultDoc）、
    // v2 迁移出的 null、存档恢复失败，这三条照旧走 openDefaults
    const bornEmpty = bornEmptyRef.current.delete(id)
    if (!restored && !bornEmpty) openDefaults(event.api, id)
    wellHub.addWell(id, event.api)
    apisRef.current[id] = event.api
    setApis({ ...apisRef.current })
    // 井一变就落盘（**换 params 也在这条上**——dockview 8.2.0 把每一组的
    // onDidPanelParametersChange 接进了 onDidLayoutChange）。
    // 组被激活、拖放落进哪一组，记进「最近用过的组」——订在恢复之后，重载后的账从空开始
    const layoutSub = event.api.onDidLayoutChange(() => scheduleSave())
    const activeSub = event.api.onDidActiveGroupChange((group) => {
      if (group !== undefined) wellHub.noteActiveGroup(id, group.id)
    })
    const moveSub = event.api.onDidMovePanel(({ panel }) => wellHub.noteActiveGroup(id, panel.group.id))
    wellSubsRef.current.set(id, {
      dispose() {
        layoutSub.dispose()
        activeSub.dispose()
        moveSub.dispose()
      },
    })
    if (bornEmpty) flushSave()
    // 等这口井的那几位（后台冷挂）这时才叫醒：井已经在枢纽里、布局已经恢复
    const waiters = readyWaitersRef.current.get(id) ?? []
    readyWaitersRef.current.delete(id)
    for (const wake of waiters) wake(event.api)
    // 冷挂的这口井进了清单（开机那口由桌面操作那条 effect 推）
    const host = wellHub.host()
    if (host !== undefined && wellHub.deskOps() !== undefined) pushPanes(host, rowsRef.current, activeIdRef.current)
  }

  /** 切桌面。顺序是机制的一部分：先记账再 flush（档里的 active 跟这一趟走），显隐交给
   * React，可见性通知与焦点接管跟在后面。 */
  const switchTo = useCallback(
    (id: string): void => {
      if (id === activeIdRef.current) return
      const row = rowsRef.current.find((r) => r.id === id)
      if (row === undefined) return
      const prev = activeIdRef.current
      activeIdRef.current = id
      // 枢纽同一拍看到新活动桌面（开格链挑「当前桌面」读它）
      wellHub.setActiveDesktop(id)
      if (!mountedRef.current.includes(id)) setMountedIds((list) => [...list, id])
      flushSave()
      setActiveId(id)
      visibilityHub.notify(prev, false)
      visibilityHub.notify(id, true)
      // 键盘焦点从被藏的那口里被吐出来（visibility:hidden 不可聚焦）。接住：给新那口
      // 焦点，切回时人不用先点一下才能用键盘。rAF 等新那口真上了屏再找它
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[${DESKTOP_ATTR}="${id}"]`)?.focus({ preventScroll: true })
      })
      window.setTimeout(() => sweepBodyPortals(row.name), SWEEP_DELAY_MS)
    },
    [flushSave],
  )

  /**
   * 新建一口桌面，回它的 id。名字缺省「桌面 N」；出生为空（井挂上时落盘空快照，见 bornEmptyRef）。
   * 缺省切过去（状态栏「新建桌面…」、`shell.desktop.new`）；「送到新桌面」不切（`follow: false`），
   * 井也不挂——送的那一趟自己 `ensureMounted`
   */
  const createDesktop = useCallback(
    (name?: string, follow = true): string => {
      const id = nextDesktopId(rowsRef.current)
      const trimmed = name?.trim()
      bornEmptyRef.current.add(id)
      rowsRef.current = [
        ...rowsRef.current,
        { id, name: trimmed === undefined || trimmed === '' ? defaultDesktopName(id) : trimmed, layout: null },
      ]
      setDesktops(rowsRef.current)
      // 不切过去时也不落盘：档里这会儿写的会是 null，重启就被「null → 铺默认」铺满（轨迹卡
      // desktop-born-empty 那个病）。送的那一趟紧接着挂井，出生为空那次 flush 会把空快照写进去
      if (follow) switchTo(id)
      return id
    },
    [switchTo],
  )

  /** 改名：空名不改 */
  const renameDesk = useCallback(
    (id: string, name: string): void => {
      const next = renameDesktop(rowsRef.current, id, name)
      if (next === undefined) return
      rowsRef.current = next
      setDesktops(next)
      flushSave()
    },
    [flushSave],
  )

  /**
   * 删掉一张桌面，上面的窗格一起关掉（插件照常 dispose），回关掉了几个。只剩一张时什么都不做。
   * 删的是当前桌面就先切到左边相邻那张（最左边那张就右边那张）。没挂过的桌面上的窗格从没挂上过
   * 插件，直接连同落盘布局一起丢
   */
  const deleteDesk = useCallback(
    (id: string): number => {
      const next = afterDelete(rowsRef.current, id)
      if (next === undefined) return 0
      if (id === activeIdRef.current) switchTo(next)
      const api = apisRef.current[id]
      const row = rowsRef.current.find((r) => r.id === id)
      let closed = 0
      if (api !== undefined) {
        // `api.panels` 每读一次都是现拼的新数组，边关边走不会漏
        for (const panel of api.panels) {
          panel.api.close()
          closed += 1
        }
      } else {
        closed = entriesOfLayout(id, row?.layout ?? null).length
      }
      wellSubsRef.current.get(id)?.dispose()
      wellSubsRef.current.delete(id)
      wellHub.removeWell(id)
      delete apisRef.current[id]
      setApis({ ...apisRef.current })
      mountedRef.current = mountedRef.current.filter((m) => m !== id)
      setMountedIds(mountedRef.current)
      rowsRef.current = rowsRef.current.filter((r) => r.id !== id)
      setDesktops(rowsRef.current)
      flushSave()
      return closed
    },
    [switchTo, flushSave],
  )

  /**
   * 状态栏那句「<text> · 切过去」：送到别的桌面之后（「已送到『X』」）、件与命令开的工具窗格在别的
   * 桌面上时（「『插件管理』在『X』」）亮一阵，点它切过去
   */
  const [notice, setNotice] = useState<{ desktop: string; text: string } | null>(null)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const notify = useCallback((desktop: string, text: string): void => {
    setNotice({ desktop, text })
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  // 桌面操作经枢纽交给面板组件、标签菜单与开格链（它们够不着 App 的闭包）
  useEffect(() => {
    wellHub.setDeskOps({
      switchTo,
      ensureMounted,
      rows: () => rowsRef.current,
      createDesktop: (name) => createDesktop(name, false),
      notify,
    })
    // 开机那一份清单：井的 onReady 比这条 effect 早，那会儿枢纽还摘不出清单
    const host = wellHub.host()
    if (host !== undefined) pushPanes(host, rowsRef.current, activeIdRef.current)
    return () => {
      wellHub.setDeskOps(undefined)
    }
  }, [switchTo, ensureMounted, createDesktop, notify])

  /** 启动器的清单：现取注册表与件名表，按插件分组，每一格点下去去哪（开着的工具窗格：本桌 / 别的桌面） */
  const launchList = async (): Promise<LaunchGroup[]> => {
    const host = wellHub.host()
    if (host === undefined) return []
    const [panes, plugins] = await Promise.all([fetchPanes(host), fetchPlugins(host)])
    return groupForLauncher(listOpenable(panes), plugins).map((group) => ({
      entryId: group.entryId,
      title: group.title,
      rows: group.specs.map((spec) => {
        const goesTo = launchGoesTo(spec)
        return goesTo === undefined ? { spec } : { spec, goesTo }
      }),
    }))
  }

  // node 半转来的桌面动作（shell.desktop.switch / new）：井在页面这半，命令只是转发
  useEffect(() => {
    const off = window.gwb.on((payload) => {
      if (!isDesktopAction(payload)) return
      if (payload.action === 'switch') {
        const row = resolveDesktop(rowsRef.current, { id: payload.id, name: payload.name })
        if (row === undefined) {
          console.warn(
            `[shell] 要切的桌面认不出：${JSON.stringify({ id: payload.id, name: payload.name })}——盘上的档可能比这条命令旧，shell.desktop.list 现查`,
          )
          return
        }
        switchTo(row.id)
      } else if (payload.action === 'new') {
        createDesktop(typeof payload.name === 'string' ? payload.name : undefined)
      } else if (payload.action === 'rename' && typeof payload.id === 'string' && typeof payload.name === 'string') {
        renameDesk(payload.id, payload.name)
      } else if (payload.action === 'delete' && typeof payload.id === 'string') {
        // 命令不弹确认：调用方已经决定了
        deleteDesk(payload.id)
      }
    })
    return off
  }, [switchTo, createDesktop, renameDesk, deleteDesk])

  // node 半转来的窗格动作（shell.pane.focus / send / close）：同一条执行链，focus 在别的桌面就切过去
  useEffect(() => {
    const off = window.gwb.on((payload) => {
      if (!isPaneAction(payload) || typeof payload.instance !== 'string') return
      const instance = payload.instance
      const row = wellHub.entries().find((e) => e.instance === instance)
      if (row === undefined) {
        console.warn(`[shell] 窗格动作认不出实例 ${instance}——shell.pane.list 现查`)
        return
      }
      if (payload.action === 'focus') void focusInstance(row.desktop, instance)
      else if (payload.action === 'close') void closeInstance(row.desktop, instance)
      else if (payload.action === 'send') {
        const to =
          typeof payload.desktop === 'string'
            ? { desktop: payload.desktop }
            : { newDesktop: typeof payload.newDesktop === 'string' ? payload.newDesktop : '' }
        void sendPane(instance, to, payload.follow === true)
      }
    })
    return off
  }, [])

  // node 半转来的开格动作（shell.openPane，跨件开格）：与件开自己格的同一条执行链
  // （openRegisteredPane——注册表现取，判断照旧 planOpen，来源是命令带的 from）。
  // 身份两样得是字符串：事件口上什么件的载荷都有，认不出当没这条
  useEffect(() => {
    const off = window.gwb.on((payload) => {
      if (!isOpenPaneAction(payload)) return
      const { entryId, paneId } = payload
      if (typeof entryId !== 'string' || typeof paneId !== 'string') return
      const host = wellHub.host()
      if (host === undefined) return
      void openRegisteredPane(host, { entryId, paneId }, openPaneOptionsOf(payload), openPaneSourceOf(payload)).catch(
        (err: unknown) => {
          console.error(`[shell] 开 ${entryId} 的 ${paneId} 失败：${String(err)}`)
        },
      )
    })
    return off
  }, [])

  /** 点开哪套已存布局，就把哪套铺回**活动那口井**上。变化照常走防抖落盘。照片是模板，
   * 铺开即弃——它跟桌面是两回事（桌面各自自动存），判据见文档站 decisions */
  const applySaved = (row: SavedLayout): void => {
    if (activeApi === null) return
    try {
      activeApi.fromJSON(row.layout as unknown as SerializedDockview)
    } catch (err) {
      // 只报不回默认：人点名要的是这一套，铺不回去得让他知道是这套的存档坏了，
      // 而不是悄悄换回默认布局装没事
      console.warn(`[shell] 布局「${row.name}」铺不回去（存档是坏的？）：${String(err)}`)
    }
  }

  /** 把**活动那口井**起名存进清单。**同名覆盖**（名字就是钥匙），空名不存 */
  const saveCurrent = (name: string): void => {
    if (activeApi === null || name === '') return
    setSaved((prev) => upsertSaved(prev, name, activeApi.toJSON() as unknown as Record<string, unknown>))
    scheduleSave()
  }

  const removeSaved = (id: string): void => {
    setSaved((prev) => prev.filter((s) => s.id !== id))
    scheduleSave()
  }

  /** 重置**活动那口**：清掉井，照「表里有几格开几格」重铺（别的桌面上开着的工具窗格不铺）。逐格关，
   * **不走 `api.clear()`**——它内部账对不上时会抛（母仓撞过），而这儿用不着它：关完重开，id 查重
   * 问的是当下真有哪些 */
  const resetLayout = (): void => {
    if (activeApi === null) return
    for (const panel of activeApi.panels) activeApi.removePanel(panel)
    openDefaults(activeApi, activeIdRef.current)
  }

  // fixed inset-0 而不是 h-screen：#root 没有高度样式，而外壳不该去改宿主那张 html。
  // 主区那格 **min-h-0 少不了**:flex 子项默认 min-height:auto,内容一高就把状态栏挤出屏幕。
  //
  // **桌面那一节上绝不加 transform / filter / perspective / will-change**：fixed 浮层的
  // 定位基准一旦从视口改成这层，户口迁进本桌的浮层坐标全漂——这条是 CSS 的硬规矩，
  // 不是风格偏好。
  return (
    <div className="shell:fixed shell:inset-0 shell:flex shell:flex-col">
      <div className="shell:relative shell:min-h-0 shell:flex-1">
        {mountedIds.map((id) => {
          const on = id === activeId
          return (
            <section
              key={id}
              data-gwb-desktop={id}
              tabIndex={-1}
              aria-hidden={!on}
              inert={!on}
            className={
              on
                ? 'shell:absolute shell:inset-0 shell:visible shell:pointer-events-auto'
                : 'shell:absolute shell:inset-0 shell:invisible shell:pointer-events-none'
            }
            >
              <div className="shell:absolute shell:inset-0">
                <DockviewReact
                  components={COMPONENTS}
                  tabComponents={TAB_COMPONENTS}
                  theme={GWB_THEME}
                  onReady={(event) => onWellReady(id, event)}
                />
              </div>
              {/* 这口桌面的浮层户口：件里 radix Portal 的 container 指到它（args.shell.portal）。
                  自身不挡鼠标（pointer-events-none），radix 内容自己带 auto；**不带 z 轴**——
                  让 radix 内容的 z-50 直接参与根层叠，状态栏（z 更高）才压得住模态遮罩 */}
              <div className={`gwb-portal-host shell:pointer-events-none shell:absolute shell:inset-0`} />
            </section>
          )
        })}
      </div>
      <StatusBar
        onLaunchList={launchList}
        onLaunch={launchSpec}
        onSections={() => desktopSections(rowsRef.current, activeIdRef.current, wellHub.entries())}
        panesTick={panesTick}
        onFocusPane={(desktop, instance) => void focusInstance(desktop, instance)}
        onSendPane={(instance, to, follow) => sendPane(instance, to, follow)}
        notice={notice}
        onFollowNotice={(desktop) => {
          setNotice(null)
          switchTo(desktop)
        }}
        onRenameDesktop={renameDesk}
        onDeleteDesktop={deleteDesk}
        home={home}
        versions={versions}
        desktops={desktops}
        activeDesktopId={activeId}
        savedLayouts={saved}
        saveFailed={saveFailed}
        onSwitchDesktop={(id) => switchTo(id)}
        onNewDesktop={(name) => {
          createDesktop(name)
        }}
        onApplyLayout={applySaved}
        onSaveLayout={saveCurrent}
        onDeleteLayout={removeSaved}
        onResetLayout={resetLayout}
        onRetrySave={() => flushSave()}
      />
    </div>
  )
}

/**
 * 取盘上的布局档。**取不到 / 取不回一律回 null**：第一次开机本来就没有档（`readDoc`
 * 对没有的文档回 undefined，**这不是错、不出声**）；data 件没装时这条命令回不了 ok
 * ——外壳照样起，只是不带记忆，落盘那条也会一样失败（状态栏会亮「布局没存上」）。
 * 档认不出（人手改坏、多桌面时代的 v1、将来升了版本）也走 null，当没有。
 */
async function fetchLayoutDoc(host: HostBridge): Promise<LayoutDoc | null> {
  try {
    const reply = (await host.call(LAYOUT_GET_COMMAND)) as { ok?: boolean; data?: unknown; error?: string }
    if (reply.ok !== true) {
      console.warn(`[shell] ${LAYOUT_GET_COMMAND} 没回档：${reply.error ?? '命令不在（data 件没装？）'}`)
      return null
    }
    if (reply.data === undefined || reply.data === null) return null
    const doc = parseLayoutDoc(reply.data)
    if (doc === null) console.warn('[shell] 盘上的布局档认不出，当没有处理（回默认布局）')
    return doc
  } catch (err) {
    console.error(`[shell] ${LAYOUT_GET_COMMAND} 调不通：${String(err)}`)
    return null
  }
}

/**
 * 开机的异步那半：样式表、外观、注册表、布局档全到手，回落树那一段（同步）。页面上的
 * 副作用（html 上的类、根上的身份标记、枢纽的命令口）一律放进落树那段——准备途中被拆了，
 * 它们就一样都不发生。
 */
async function prepareShell(args: ShellArgs, root: HTMLElement): Promise<() => MountedTree> {
  // 三张表都等到位再渲染：令牌是值的来源（页面级，件不用自己注）、dockview 那张管的是
  // `.dv-*` 与 `.dockview-theme-gwb`（类名不经我们的手）、外壳自己那张类名一律带
  // `shell:` 前缀——三张都全页有效，谁也不靠祖先关系围栏
  await Promise.all(args.styles.map((href) => loadStyle(href)))
  // 第四样：用户自己的外观样式（gwb-theme 件的字体覆盖 + 自定义 CSS）。它要压过令牌
  // 默认值，所以排在这三张 link 之后；theme 没装时 env 里没有这一项
  applyStartupCss(args.startupCss)

  const panes = await fetchPanes(args.host)
  const specs = listOpenable(panes)
  // 档赶在首帧之前到手——先铺默认再跳恢复，闪的那一下藏不住。没有档（第一次开机 /
  // 档废了）就地取缺省：一口「桌面 1」
  const initialDoc = (await fetchLayoutDoc(args.host)) ?? defaultDoc()
  const activeRow = initialDoc.desktops.find((d) => d.id === initialDoc.active)
  console.log(
    `[shell] 表里 ${specs.length} 格可开：${specs.map((s) => s.id).join('、') || '（表是空的）'}；` +
      `${initialDoc.desktops.length} 口桌面（活动：「${activeRow?.name ?? initialDoc.active}」），` +
      `存着 ${initialDoc.saved.length} 套布局`,
  )

  return () => {
    wellHub.setHost(args.host)
    document.documentElement.classList.add(...THEME_CLASSES)
    // 深色是默认态：令牌的 .dark 那套在这儿挂上，状态栏的开关之后随时摘。拆树不摘
    // ——亮暗是页面级选择，热换外壳时新壳落树会再挂，这头摘了反而闪一下亮色
    document.documentElement.classList.add('dark')
    // **只是身份标记**：围栏是类名前缀（外壳那张表里的类一律 `shell:` 开头），这个属性
    // 不参与任何选择器。挂它是为了 devtools 里一眼认得出这棵树是谁的——井里每一格的件
    // 容器另挂它自己的那个，同样只作身份用
    root.setAttribute('data-gwb-plugin', SELF)
    const reactRoot = createRoot(root)
    reactRoot.render(<App specs={specs} home={args.home} versions={args.versions} initialDoc={initialDoc} />)
    return {
      unmount() {
        // 布局还有没落盘的那半拍，拆树前抢着写一把——赶不上也就丢最后 400ms 的挪动
        wellHub.flush()
        // 同步拆完：内核页面根在 dispose 之后紧接着清空 #root
        reactRoot.unmount()
        document.documentElement.classList.remove(...THEME_CLASSES)
        root.removeAttribute('data-gwb-plugin')
        // **只清自己那份**：不判身份的话旧句柄会把新外壳的那份清掉，全井的件当场报「缺 params」
        wellHub.releaseHost(args.host)
      },
    }
  }
}

/** 挂载与拆除的共同收口：起不来就在根上写一句，拆的时候连那句一起清掉 */
function shellHandle(root: HTMLElement, prepare: Prepare): { dispose(): void } {
  const handle = mountWhenReady(prepare, (err) => {
    root.textContent = `外壳起不来：${String(err)}`
  })
  return {
    dispose() {
      handle.dispose()
      root.textContent = ''
    },
  }
}

/** 环境已经在手时的入口（默认导出问完 `shell.env` 走的是同一条路）。**回一个 `{ dispose }`**：热换外壳时页面上这棵树得有人拆 */
export function bootShell(args: ShellArgs, root: HTMLElement): { dispose(): void } {
  return shellHandle(root, () => prepareShell(args, root))
}

/** 页面的公共面里本件用得着的两条。按形状收，正本在内核的词汇表包 */
declare global {
  interface Window {
    gwb: {
      command(command: string, args?: unknown): Promise<unknown>
      /** 内核事件口的页面那半：node 半 gwbKernel.emit 推的载荷全从这儿出（logger 推日志同一条路） */
      on(listener: (payload: unknown) => void): () => void
    }
  }
}

/**
 * 内核契约的那一个默认导出：拿走 `#root`，回 `{ dispose }`。
 * 环境（home、样式表地址）问 node 半的 `shell.env`；importmap 内核在 import 本模块之前已经注好，
 * 所以本文件顶层的 react 裸名解析得到。
 */
export default function mountShell(root: HTMLElement): { dispose(): void } {
  return shellHandle(root, async (alive) => {
    const reply = (await window.gwb.command(ENV_COMMAND)) as {
      ok?: boolean
      data?: ShellEnv
      error?: string
    }
    if (reply.ok !== true || reply.data === undefined) {
      throw new Error(`${ENV_COMMAND} 没回环境：${reply.error ?? '没说原因'}`)
    }
    if (!alive()) return undefined
    const { home, styles, startupCss, versions } = reply.data
    return prepareShell(
      { host: { call: (command, args) => window.gwb.command(command, args) }, home, styles, startupCss, versions },
      root,
    )
  })
}

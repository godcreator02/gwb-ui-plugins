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

const SELF = '@godcreator/gwb-shell'

/** 保存布局的防抖窗口：一阵拖拽、开关窗格合并成一次写入 */
const SAVE_DEBOUNCE_MS = 400

/** 状态栏「… · 切过去」显示多久 */
const NOTICE_MS = 10_000

/** 切完桌面隔多久检查 body：等状态栏浮层走完退场动画 */
const SWEEP_DELAY_MS = 500

/** 推给 node 侧缓存（`shell.pane.sync`）；推不上只记一条 warn */
function pushPanes(host: HostBridge, rows: readonly DesktopRow[], active: string): void {
  const sync = { entries: wellHub.entries(), desktops: rows.map(({ id, name }) => ({ id, name })), active }
  void host.call(PANE_SYNC_COMMAND, sync).catch((err: unknown) => {
    console.warn(`[shell] ${PANE_SYNC_COMMAND} 推不上：${String(err)}`)
  })
}

/** 面板组件表与标签组件表必须是模块级常量：dockview 按引用比对，换一个新对象会重建全部窗格 */
const COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelProps>> = {
  [PLUGIN_COMPONENT]: PluginPanel,
}

const TAB_COMPONENTS: Record<string, React.FunctionComponent<IDockviewPanelHeaderProps>> = {
  [TAB_COMPONENT]: GwbTab,
}

/** 找挂在 body 上、没接到 `args.shell.portal` 的插件浮层，只报告不删除 */
function sweepBodyPortals(activeName: string): void {
  const strays: string[] = []
  for (const el of document.body.children) {
    // 根节点、非浮层的常规节点、radix 的焦点护栏、状态栏自己的浮层不算
    if (el.id === 'root' || /^(STYLE|SCRIPT|LINK|NOSCRIPT)$/.test(el.tagName)) continue
    if (el.hasAttribute('data-radix-focus-guard')) continue
    if (el.matches('[data-gwb-status-layer]') || el.querySelector('[data-gwb-status-layer]') !== null) continue
    const cls = el.getAttribute('class') ?? ''
    strays.push(`<${el.tagName.toLowerCase()}${cls === '' ? '' : ` class="${cls}"`}>`)
  }
  if (strays.length > 0) {
    console.warn(
      `[shell] 切到「${activeName}」时 body 上还挂着 ${strays.length} 个节点（多半是哪个插件的浮层没跟着自己桌面走——radix Portal 的挂载点该指到 args.shell.portal）：${strays.join('、')}`,
    )
  }
}

/** 一张桌面一个 section，非活动的只是不显示；开机只挂载活动那张，其余第一次切到时挂载、之后常驻 */
function App({
  specs,
  home,
  versions,
  initialDoc,
}: {
  specs: OpenableSpec[]
  home: string
  versions: Versions
  /** 磁盘上的布局文件；第一次开机或认不出时是 defaultDoc() */
  initialDoc: LayoutDoc
}): ReactElement {
  /** 已挂载的各容器的 api，挂载后常驻 */
  const [apis, setApis] = useState<Record<string, DockviewApi>>({})
  /** 已挂载容器的桌面 id */
  const [mountedIds, setMountedIds] = useState<string[]>(() => [initialDoc.active])
  const [desktops, setDesktops] = useState<DesktopRow[]>(initialDoc.desktops)
  const [activeId, setActiveId] = useState(initialDoc.active)
  const [saved, setSaved] = useState<SavedLayout[]>(initialDoc.saved)
  const [saveFailed, setSaveFailed] = useState(false)
  /** 每保存一次加一；「桌面」面板开着时据此重新读取清单 */
  const [panesTick, setPanesTick] = useState(0)

  // 回调一律读 ref：防抖保存触发时要读当下的值，不能读闭包创建那一刻的
  const apisRef = useRef(apis)
  apisRef.current = apis
  const mountedRef = useRef(mountedIds)
  mountedRef.current = mountedIds
  const rowsRef = useRef(desktops)
  rowsRef.current = desktops
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  // switchTo 里另有一处同步赋值，保证刚切完就打开的窗格落在新桌面上
  wellHub.setActiveDesktop(activeId)
  const savedRef = useRef(saved)
  savedRef.current = saved
  const timerRef = useRef<number | undefined>(undefined)
  /** 每个容器的订阅（布局变化、组激活、拖放落组），随 App 卸载一起注销 */
  const wellSubsRef = useRef(new Map<string, { dispose(): void }>())
  /** 运行时新建、空快照还没保存的桌面；容器挂载时 flush 一次，用空快照替换文件里的 null */
  const bornEmptyRef = useRef(new Set<string>())
  /** `ensureMounted` 排队等容器挂载的回调，onWellReady 里逐个唤醒 */
  const readyWaitersRef = useRef(new Map<string, ((api: DockviewApi) => void)[]>())

  const activeApi = apis[activeId] ?? null

  const flushSave = useCallback((): void => {
    window.clearTimeout(timerRef.current)
    const host = wellHub.host()
    if (host === undefined) return
    // 整份写入：已挂载的桌面读容器当下的 toJSON，没挂载的用它保存着的那条
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
    // 窗格清单跟保存同一节律推给 node 侧
    pushPanes(host, rowsRef.current, activeIdRef.current)
    setPanesTick((n) => n + 1)
  }, [])

  const scheduleSave = useCallback((): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(flushSave, SAVE_DEBOUNCE_MS)
  }, [flushSave])

  // bootShell 的 dispose 卸载 React 树前经 wellHub 调它
  useEffect(() => {
    wellHub.setFlusher(flushSave)
    return () => {
      wellHub.setFlusher(undefined)
    }
  }, [flushSave])

  // 容器常驻，订阅也常驻，App 卸载时统一注销
  useEffect(() => {
    const subs = wellSubsRef.current
    return () => {
      for (const sub of subs.values()) sub.dispose()
      subs.clear()
      wellHub.clearWells()
    }
  }, [])

  /**
   * 经 addInstance 先算唯一 id 再开：同 id 的 addPanel 会同步抛错，冲出 onReady 整个容器起不来。
   * 桌面清单直接传给 wellHub：开机时 onReady 比桌面操作的注入早
   */
  const openDefaults = (target: DockviewApi, desktop: string): void => {
    const open = wellHub.entries(rowsRef.current).filter((e) => e.desktop !== desktop)
    for (const spec of specsForDefaults(specs, open)) addInstance(target, spec)
  }

  /** 挂载容器不等于切过去：没挂载过的在后台挂载，onWellReady 之后才 resolve；桌面不存在回 undefined */
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

  /** 每个容器只执行一次：恢复保存的布局，或打开默认布局，或（运行时新建的）保持为空 */
  const onWellReady = (id: string, event: DockviewReadyEvent): void => {
    const row = rowsRef.current.find((r) => r.id === id)
    let restored = false
    if (row?.layout != null) {
      try {
        event.api.fromJSON(row.layout as unknown as SerializedDockview)
        restored = true
      } catch (err) {
        // 保存的布局坏了或 dockview 升了版本：回默认布局，不阻止容器启动
        console.warn(`[shell] 桌面「${row.name}」的布局恢复不了，回默认：${String(err)}`)
      }
    }
    // 运行时新建的桌面不打开默认布局；第一次开机、v2 迁移出的 null、恢复失败这三种才打开
    const bornEmpty = bornEmptyRef.current.delete(id)
    if (!restored && !bornEmpty) openDefaults(event.api, id)
    wellHub.addWell(id, event.api)
    apisRef.current[id] = event.api
    setApis({ ...apisRef.current })
    // 换 params 也会触发 onDidLayoutChange（dockview 8.2.0 把各组的参数变化接了进来）。
    // 最近激活顺序在恢复之后才开始记
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
    // 此时容器已在 wellHub 里、布局已恢复
    const waiters = readyWaitersRef.current.get(id) ?? []
    readyWaitersRef.current.delete(id)
    for (const wake of waiters) wake(event.api)
    // 开机那个容器由注入桌面操作的 effect 推送
    const host = wellHub.host()
    if (host !== undefined && wellHub.deskOps() !== undefined) pushPanes(host, rowsRef.current, activeIdRef.current)
  }

  /** 顺序是机制的一部分：先改 active 再 flush，显隐交给 React，之后可见性通知、焦点接管、检查 body */
  const switchTo = useCallback(
    (id: string): void => {
      if (id === activeIdRef.current) return
      const row = rowsRef.current.find((r) => r.id === id)
      if (row === undefined) return
      const prev = activeIdRef.current
      activeIdRef.current = id
      // 当场生效：开窗格流程按它挑当前桌面
      wellHub.setActiveDesktop(id)
      if (!mountedRef.current.includes(id)) setMountedIds((list) => [...list, id])
      flushSave()
      setActiveId(id)
      visibilityHub.notify(prev, false)
      visibilityHub.notify(id, true)
      // visibility:hidden 的元素不可聚焦，焦点会丢；等新桌面显示出来后把焦点给它
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[${DESKTOP_ATTR}="${id}"]`)?.focus({ preventScroll: true })
      })
      window.setTimeout(() => sweepBodyPortals(row.name), SWEEP_DELAY_MS)
    },
    [flushSave],
  )

  /** 新建时为空；「送到新桌面」传 `follow: false`，不切过去也不挂载，由送的流程自己 `ensureMounted` */
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
      // 不切过去时也不保存：这时写进去的是 null，重启会按默认布局打开；挂载时那次 flush 会写空快照
      if (follow) switchTo(id)
      return id
    },
    [switchTo],
  )

  /** 空名不改 */
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

  /** 回关掉了几个窗格；只剩一张时什么都不做。没挂载过的桌面上的窗格从没加载过插件，连同保存的布局一起丢弃 */
  const deleteDesk = useCallback(
    (id: string): number => {
      const next = afterDelete(rowsRef.current, id)
      if (next === undefined) return 0
      if (id === activeIdRef.current) switchTo(next)
      const api = apisRef.current[id]
      const row = rowsRef.current.find((r) => r.id === id)
      let closed = 0
      if (api !== undefined) {
        // `api.panels` 每次读都是新数组，边遍历边关不会漏
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

  /** 状态栏「<text> · 切过去」，显示 NOTICE_MS 后消失 */
  const [notice, setNotice] = useState<{ desktop: string; text: string } | null>(null)
  const noticeTimerRef = useRef<number | undefined>(undefined)
  const notify = useCallback((desktop: string, text: string): void => {
    setNotice({ desktop, text })
    window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  // 面板组件、标签菜单与开窗格流程访问不到 App 的闭包，桌面操作经 wellHub 交给它们
  useEffect(() => {
    wellHub.setDeskOps({
      switchTo,
      ensureMounted,
      rows: () => rowsRef.current,
      createDesktop: (name) => createDesktop(name, false),
      notify,
    })
    // 开机时容器的 onReady 比这个 effect 早，那时还推不出清单
    const host = wellHub.host()
    if (host !== undefined) pushPanes(host, rowsRef.current, activeIdRef.current)
    return () => {
      wellHub.setDeskOps(undefined)
    }
  }, [switchTo, ensureMounted, createDesktop, notify])

  /** 当场取注册表与插件名表，按插件分组，每一行带上点下去会去哪 */
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

  // node 侧转来的桌面动作（shell.desktop.*）
  useEffect(() => {
    const off = window.gwb.on((payload) => {
      if (!isDesktopAction(payload)) return
      if (payload.action === 'switch') {
        const row = resolveDesktop(rowsRef.current, { id: payload.id, name: payload.name })
        if (row === undefined) {
          console.warn(
            `[shell] 要切的桌面认不出：${JSON.stringify({ id: payload.id, name: payload.name })}——磁盘上的布局文件可能比这条命令旧，用 shell.desktop.list 查`,
          )
          return
        }
        switchTo(row.id)
      } else if (payload.action === 'new') {
        createDesktop(typeof payload.name === 'string' ? payload.name : undefined)
      } else if (payload.action === 'rename' && typeof payload.id === 'string' && typeof payload.name === 'string') {
        renameDesk(payload.id, payload.name)
      } else if (payload.action === 'delete' && typeof payload.id === 'string') {
        deleteDesk(payload.id)
      }
    })
    return off
  }, [switchTo, createDesktop, renameDesk, deleteDesk])

  // node 侧转来的窗格动作（shell.pane.focus / send / close）
  useEffect(() => {
    const off = window.gwb.on((payload) => {
      if (!isPaneAction(payload) || typeof payload.instance !== 'string') return
      const instance = payload.instance
      const row = wellHub.entries().find((e) => e.instance === instance)
      if (row === undefined) {
        console.warn(`[shell] 窗格动作认不出实例 ${instance}——用 shell.pane.list 查`)
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

  // node 侧转来的 shell.openPane，与插件开自己窗格走同一条流程；事件入口上什么插件的事件都有，认不出就忽略
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

  /** 应用到活动那个容器上；已存布局是模板，应用后即弃，之后照常自动保存 */
  const applySaved = (row: SavedLayout): void => {
    if (activeApi === null) return
    try {
      activeApi.fromJSON(row.layout as unknown as SerializedDockview)
    } catch (err) {
      // 只报错、不回默认：人明确要的是这一套
      console.warn(`[shell] 布局「${row.name}」应用不上（保存的布局坏了？）：${String(err)}`)
    }
  }

  /** 存活动那个容器；同名覆盖，空名不存 */
  const saveCurrent = (name: string): void => {
    if (activeApi === null || name === '') return
    setSaved((prev) => upsertSaved(prev, name, activeApi.toJSON() as unknown as Record<string, unknown>))
    scheduleSave()
  }

  const removeSaved = (id: string): void => {
    setSaved((prev) => prev.filter((s) => s.id !== id))
    scheduleSave()
  }

  /** 逐个关掉活动容器里的窗格再打开默认布局；不用 `api.clear()`，它内部状态对不上时会抛错 */
  const resetLayout = (): void => {
    if (activeApi === null) return
    for (const panel of activeApi.panels) activeApi.removePanel(panel)
    openDefaults(activeApi, activeIdRef.current)
  }

  // fixed inset-0 而不是 h-screen：#root 没有高度样式，外壳不改宿主的 html。
  // 主区的 min-h-0 少不了：flex 子项默认 min-height:auto，内容一高就把状态栏挤出屏幕。
  // 桌面 section 上不许加 transform / filter / perspective / will-change：fixed 浮层的定位基准会从视口变成它，坐标全错
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
                  onReady={(event: DockviewReadyEvent) => onWellReady(id, event)}
                />
              </div>
              {/* 这张桌面的浮层挂载点（args.shell.portal）。不设 z-index：radix 内容的 z-50 直接参与根层叠，状态栏才压得住模态遮罩 */}
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

/** 没有、取不到、认不出都回 null（按默认布局启动）；第一次开机没有文件不算错、不告警 */
async function fetchLayoutDoc(host: HostBridge): Promise<LayoutDoc | null> {
  try {
    const reply = (await host.call(LAYOUT_GET_COMMAND)) as { ok?: boolean; data?: unknown; error?: string }
    if (reply.ok !== true) {
      console.warn(`[shell] ${LAYOUT_GET_COMMAND} 没回布局文件：${reply.error ?? '命令不在（数据插件没装？）'}`)
      return null
    }
    if (reply.data === undefined || reply.data === null) return null
    const doc = parseLayoutDoc(reply.data)
    if (doc === null) console.warn('[shell] 磁盘上的布局文件认不出，当没有处理（回默认布局）')
    return doc
  } catch (err) {
    console.error(`[shell] ${LAYOUT_GET_COMMAND} 调不通：${String(err)}`)
    return null
  }
}

/** 异步准备完回同步的挂载那段；页面上的副作用都放在挂载那段里，准备途中被 dispose 就一样都不发生 */
async function prepareShell(args: ShellArgs, root: HTMLElement): Promise<() => MountedTree> {
  // 三张表都加载完才渲染
  await Promise.all(args.styles.map((href) => loadStyle(href)))
  applyStartupCss(args.startupCss)

  const panes = await fetchPanes(args.host)
  const specs = listOpenable(panes)
  // 布局文件要在第一帧之前取到，否则先显示默认布局再跳到恢复的，会闪一下
  const initialDoc = (await fetchLayoutDoc(args.host)) ?? defaultDoc()
  const activeRow = initialDoc.desktops.find((d) => d.id === initialDoc.active)
  console.log(
    `[shell] 表里 ${specs.length} 个窗格可开：${specs.map((s) => s.id).join('、') || '（表是空的）'}；` +
      `${initialDoc.desktops.length} 张桌面（活动：「${activeRow?.name ?? initialDoc.active}」），` +
      `存着 ${initialDoc.saved.length} 套布局`,
  )

  return () => {
    wellHub.setHost(args.host)
    document.documentElement.classList.add(...THEME_CLASSES)
    // 深色是默认；卸载时不移除，换外壳时新外壳会再加上，移除反而闪一下亮色
    document.documentElement.classList.add('dark')
    // 只是身份标记，不参与任何选择器；样式隔离靠类名前缀
    root.setAttribute('data-gwb-plugin', SELF)
    const reactRoot = createRoot(root)
    reactRoot.render(<App specs={specs} home={args.home} versions={args.versions} initialDoc={initialDoc} />)
    return {
      unmount() {
        // 卸载前立刻保存一次，最多丢最后 400ms 的挪动
        wellHub.flush()
        // 同步卸载完：内核页面根在 dispose 之后紧接着清空 #root
        reactRoot.unmount()
        document.documentElement.classList.remove(...THEME_CLASSES)
        root.removeAttribute('data-gwb-plugin')
        // 只清自己那份：换外壳时新外壳先 boot，不判身份会把新外壳的那份清掉
        wellHub.releaseHost(args.host)
      },
    }
  }
}

/** 启动失败在根节点上写一句，dispose 时连那句一起清掉 */
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

/** 已有环境时的入口；默认导出问完 `shell.env` 也走这里 */
export function bootShell(args: ShellArgs, root: HTMLElement): { dispose(): void } {
  return shellHandle(root, () => prepareShell(args, root))
}

/** 页面上 `window.gwb` 里用到的两个方法，按形状声明 */
declare global {
  interface Window {
    gwb: {
      command(command: string, args?: unknown): Promise<unknown>
      /** node 侧 gwbKernel.emit 推的事件都从这里收 */
      on(listener: (payload: unknown) => void): () => void
    }
  }
}

/**
 * 内核契约的默认导出：拿走 `#root`，回 `{ dispose }`。环境问 node 侧的 `shell.env`；
 * 内核在 import 本模块之前已注入 importmap，所以顶层的 react 裸名解析得到
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

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  DockviewReact,
  type DockviewApi,
  type DockviewReadyEvent,
  type IDockviewPanelHeaderProps,
  type IDockviewPanelProps,
  type SerializedDockview,
} from 'dockview-react'
import { GwbTab } from './GwbTab.js'
import { StatusBar } from './StatusBar.js'
import { PluginPanel } from './plugin-panel.js'
import { loadStyle } from './asset.js'
import { fetchPanes } from './panes.js'
import { wellHub } from './well-hub.js'
import { addInstance, openSpec, willFocus, TAB_COMPONENT } from './open.js'
import { applyThemeStyle, GWB_THEME, THEME_CLASSES } from './theme-boot.js'
import {
  listOpenable,
  type OpenableSpec,
} from '../openable.js'
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
import { defaultDesktopName, isDesktopAction, resolveDesktop } from '../desktops.js'
import { ENV_COMMAND } from '../protocol.js'
import { visibilityHub } from './visibility.js'
import { DESKTOP_ATTR } from './desktop-context.js'
import type { HostBridge, ShellArgs } from './types.js'

/**
 * 外壳浏览器半的装配：内核契约入口（`mountShell`）、boot（取环境、注样式表、起 React
 * 树）与 App。开格执行在 `open.ts`、页面级状态在 `well-hub`、面板与标签在
 * `plugin-panel` / `GwbTab`、状态栏在 `StatusBar`、外观装配在 `theme-boot`。
 */

const SELF = '@godcreator02/gwb-shell'

/** 布局落盘的防抖窗口：一阵拖拽 / 开关格合并成一次写。母仓量下来的一档 */
const SAVE_DEBOUNCE_MS = 400

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
 * **不删别人的 DOM**。状态栏自己的菜单也挂 body——它在桌面体系之外，应该常驻；radix
 * 的菜单在焦点离开时自己关，所以扫到的多半是没接容器那半的残影。
 */
function sweepBodyPortals(activeName: string): void {
  const strays: string[] = []
  for (const el of document.body.children) {
    // 根节点与三类非浮层的常态节点不算
    if (el.id === 'root' || /^(STYLE|SCRIPT|LINK|NOSCRIPT)$/.test(el.tagName)) continue
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
  initialDoc,
}: {
  specs: OpenableSpec[]
  home: string
  /** 盘上的档（已并好缺省：第一次开机或档废了就是 defaultDoc()，v2 在解析那层已迁成 v3） */
  initialDoc: LayoutDoc
}): ReactElement {
  /** 每口挂着的井各自的 api。井常驻（保活），挂上就不拆——「活动的那口」只是其中之一 */
  const [apis, setApis] = useState<Record<string, DockviewApi>>({})
  /** 已挂井的桌面 id。开机只挂 active 那口，别的桌面第一次切到才挂（冷挂）、挂上常驻 */
  const [mountedIds, setMountedIds] = useState<string[]>(() => [initialDoc.active])
  const [desktops, setDesktops] = useState<DesktopRow[]>(initialDoc.desktops)
  const [activeId, setActiveId] = useState(initialDoc.active)
  /** 状态栏那张表上点了会走成聚焦的那几条（spec 的基名）。判据归 `willFocus`，只看活动那口井 */
  const [focusIds, setFocusIds] = useState<string[]>([])
  /** 人起名存下来的布局清单，档里那半 */
  const [saved, setSaved] = useState<SavedLayout[]>(initialDoc.saved)
  const [saveFailed, setSaveFailed] = useState(false)

  // 回调读的都走 ref：防抖保存醒来时要读「当下」，不能读进闭包那一刻的旧账
  const apisRef = useRef(apis)
  apisRef.current = apis
  const mountedRef = useRef(mountedIds)
  mountedRef.current = mountedIds
  const rowsRef = useRef(desktops)
  rowsRef.current = desktops
  const activeIdRef = useRef(activeId)
  activeIdRef.current = activeId
  // 枢纽里的活动桌面（面板组件的开格链读它），跟 ref 同一步走——switchTo 里另有一处同步赋值，
  // 保证聚焦分派在同一拍里看到新值
  wellHub.setActiveDesktop(activeId)
  const savedRef = useRef(saved)
  savedRef.current = saved
  const timerRef = useRef<number | undefined>(undefined)
  /** 每口井的 onDidLayoutChange 订阅。井常驻，跟着 App 卸载一起拆 */
  const wellSubsRef = useRef(new Map<string, { dispose(): void }>())

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

  const openDefaults = (target: DockviewApi): void => {
    // 走跟 openPane 同一条路：算唯一 id 再开。裸 addPanel 的话，specs 里万一出现
    // 两条同 id，第二条会同步抛、异常冲出 onReady，**整口井起不来**而不是少开一格
    for (const spec of specs) addInstance(target, spec)
  }

  /** 状态栏「已开」记号重算：问的是**全局表**的 `planOpen` 判据（别桌已开的也算，点它切过去） */
  const syncFocus = useCallback((): void => {
    setFocusIds(specs.filter((spec) => willFocus(spec)).map((spec) => spec.id))
  }, [specs])

  /** 一口井挂上（冷挂那一刻）：按它那条档恢复，或铺默认；订阅布局变化。井常驻，只走一次 */
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
    if (!restored) openDefaults(event.api)
    wellHub.addWell(id, event.api)
    apisRef.current[id] = event.api
    setApis({ ...apisRef.current })
    // 井一变：活动的那口顺带重算「已开」记号（**换 params 也在这条上**——dockview 8.2.0
    // 把每一组的 onDidPanelParametersChange 接进了 onDidLayoutChange）；哪口变了都要落盘
    wellSubsRef.current.set(
      id,
      event.api.onDidLayoutChange(() => {
        if (activeIdRef.current === id) syncFocus()
        scheduleSave()
      }),
    )
  }

  // 切到一口已挂井的桌面时记号也得重算（那口井没有新事件）
  useEffect(() => {
    syncFocus()
  }, [activeApi, syncFocus])

  /** 切桌面。顺序是机制的一部分：先记账再 flush（档里的 active 跟这一趟走），显隐交给
   * React，可见性通知与焦点接管跟在后面。 */
  const switchTo = useCallback(
    (id: string): void => {
      if (id === activeIdRef.current) return
      const row = rowsRef.current.find((r) => r.id === id)
      if (row === undefined) return
      const prev = activeIdRef.current
      activeIdRef.current = id
      // 枢纽同一拍看到新活动桌面（focusAcross 的聚焦分派跟着切换走）
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
      sweepBodyPortals(row.name)
    },
    [flushSave],
  )

  /** 新建一口桌面并切过去。名字缺省「桌面 N」；layout 留 null（第一次切到铺默认） */
  const createDesktop = useCallback(
    (name?: string): void => {
      const id = nextDesktopId(rowsRef.current)
      const trimmed = name?.trim()
      rowsRef.current = [
        ...rowsRef.current,
        { id, name: trimmed === undefined || trimmed === '' ? defaultDesktopName(id) : trimmed, layout: null },
      ]
      setDesktops(rowsRef.current)
      switchTo(id)
    },
    [switchTo],
  )

  // 跨井聚焦的切桌分派（focusAcross 经枢纽够到 switchTo，跟落盘钩子同一个路子）
  useEffect(() => {
    wellHub.setSwitcher(switchTo)
    return () => {
      wellHub.setSwitcher(undefined)
    }
  }, [switchTo])

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
      }
    })
    return off
  }, [switchTo, createDesktop])

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

  /** 重置**活动那口**：清掉井，照「表里有几格开几格」重铺。逐格关，**不走 `api.clear()`**
   * ——它内部账对不上时会抛（母仓撞过），而这儿用不着它：关完重开，id 查重问的是当下真有哪些 */
  const resetLayout = (): void => {
    if (activeApi === null) return
    for (const panel of activeApi.panels) activeApi.removePanel(panel)
    openDefaults(activeApi)
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
        specs={specs}
        focusIds={focusIds}
        home={home}
        desktops={desktops}
        activeDesktopId={activeId}
        savedLayouts={saved}
        saveFailed={saveFailed}
        onOpen={openSpec}
        onSwitchDesktop={(id) => switchTo(id)}
        onNewDesktop={(name) => createDesktop(name)}
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

async function boot(args: ShellArgs, root: HTMLElement): Promise<Root> {
  wellHub.setHost(args.host)
  // 三张表都等到位再渲染：令牌是值的来源（页面级，件不用自己注）、dockview 那张管的是
  // `.dv-*` 与 `.dockview-theme-gwb`（类名不经我们的手）、外壳自己那张类名一律带
  // `shell:` 前缀——三张都全页有效，谁也不靠祖先关系围栏
  await Promise.all(args.styles.map((href) => loadStyle(href)))
  // 第四样：用户自己的外观样式（gwb-theme 件的字体覆盖 + 自定义 CSS）。它要压过令牌
  // 默认值，所以排在这三张 link 之后；theme 没装时这儿是个空操作
  await applyThemeStyle(args.host)
  document.documentElement.classList.add(...THEME_CLASSES)
  // 深色是默认态：令牌的 .dark 那套在这儿挂上，状态栏的开关之后随时摘。dispose 不摘
  // ——亮暗是页面级选择，热换外壳时新壳 boot 会再挂，这头摘了反而闪一下亮色
  document.documentElement.classList.add('dark')
  // **只是身份标记**：围栏是类名前缀（外壳那张表里的类一律 `shell:` 开头），这个属性
  // 不参与任何选择器。挂它是为了 devtools 里一眼认得出这棵树是谁的——井里每一格的件
  // 容器另挂它自己的那个，同样只作身份用
  root.setAttribute('data-gwb-plugin', SELF)

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

  const reactRoot = createRoot(root)
  reactRoot.render(<App specs={specs} home={args.home} initialDoc={initialDoc} />)
  return reactRoot
}

/** 内核 import 本模块后调的是默认导出（见文件末尾），它问完环境再调这个。**回一个 `{ dispose }`**：热换外壳时页面上这棵树得有人拆 */
export function bootShell(args: ShellArgs, root: HTMLElement): { dispose(): void } {
  const mounted = boot(args, root).catch((err: unknown) => {
    root.textContent = `外壳起不来：${String(err)}`
    return undefined
  })
  return {
    dispose() {
      // 布局还有没落盘的那半拍，拆树前抢着写一把——赶不上也就丢最后 400ms 的挪动
      wellHub.flush()
      // 挂载是异步的：dispose 可能赶在它之前，所以接在同一条链上而不是拿个变量去猜
      void mounted.then((reactRoot) => reactRoot?.unmount())
      document.documentElement.classList.remove(...THEME_CLASSES)
      root.removeAttribute('data-gwb-plugin')
      root.textContent = ''
      // **只清自己那份**：热换外壳的自然顺序是「新的先 boot、旧的后 dispose」，
      // 不判身份的话旧句柄会把新外壳的那份清掉,全井的件当场报「缺 params」——
      // 而外壳没有 bug,是 dispose 越了界
      wellHub.releaseHost(args.host)
    },
  }
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
  let inner: { dispose(): void } | undefined
  let disposed = false
  ;(async () => {
    const reply = (await window.gwb.command(ENV_COMMAND)) as {
      ok?: boolean
      data?: { home: string; styles: string[] }
      error?: string
    }
    if (reply.ok !== true || reply.data === undefined) {
      throw new Error(`${ENV_COMMAND} 没回环境：${reply.error ?? '没说原因'}`)
    }
    if (disposed) return
    inner = bootShell(
      { host: { call: (command, args) => window.gwb.command(command, args) }, home: reply.data.home, styles: reply.data.styles },
      root,
    )
  })().catch((err: unknown) => {
    root.textContent = `外壳起不来：${String(err)}`
  })
  return {
    dispose() {
      disposed = true
      inner?.dispose()
    },
  }
}

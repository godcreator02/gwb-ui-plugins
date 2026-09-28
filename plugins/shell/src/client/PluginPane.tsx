import { useEffect, useRef, useState, type ReactElement } from 'react'
import { loadStyle } from './asset.js'
import { fetchPanes, paneTargetIn } from './panes.js'
import { desktopIdOf, portalHostOf } from './desktop-context.js'
import {
  describeHandle,
  disposeOutsideCommit,
  pickDispose,
  pickMountPane,
  pickRetarget,
  type MountLike,
} from './mount-handle.js'
import { contentUpdateOf, paramsKeyOf, parsePaneContent, pluginParamsIn } from '../panels.js'
import { visibilityHub } from './visibility.js'
import type { HostBridge, ShellBridge } from './types.js'

/** 缺 `mountPane` 导出或它不是函数都抛错 */
async function importMountPane(url: string, who: string): Promise<MountLike> {
  await window.gwb.prepareImports()
  const mod: unknown = await import(/* @vite-ignore */ url)
  const mount = pickMountPane(mod)
  if (mount === undefined) throw new Error(`${who} 的 client.js 没有 mountPane 导出——那是窗格插件的入口名`)
  return mount
}

export function PluginPane({
  pluginKey,
  entryId,
  paneId,
  panelId,
  paneParams,
  host,
  openPane,
  setTitle,
  keepPane,
  updateParams,
}: {
  /** 完整包名 */
  pluginKey: string
  /** 取注册表里这一条的键；`openPane` 只开得了这条条目的窗格也靠它 */
  entryId: string
  /** 注册时给的窗格 id */
  paneId: string
  /** 这一份的实例 id（dockview 的 panel id） */
  panelId: string
  /** 插件自己的那部分参数，保留键已移除 */
  paneParams: Record<string, unknown> | undefined
  host: HostBridge
  /** entryId 已由上层绑定，插件开不了别人的窗格 */
  openPane: ShellBridge['openPane']
  /** 绑的是这一份自己的 panel api */
  setTitle: ShellBridge['setPaneTitle']
  /** 转成正式窗格；同样绑这一份自己的 panel api */
  keepPane: ShellBridge['keepPane']
  /** 合并进这一份的面板 params（dockview 的 updateParameters），上报内容用它 */
  updateParams: (update: Record<string, unknown>) => void
}): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  // 经 ref 读、不进依赖数组：这几个函数每轮渲染都是新闭包，进依赖会让插件被反复卸载后重新挂载
  const openPaneRef = useRef(openPane)
  openPaneRef.current = openPane
  const setTitleRef = useRef(setTitle)
  setTitleRef.current = setTitle
  const keepPaneRef = useRef(keepPane)
  keepPaneRef.current = keepPane
  const updateParamsRef = useRef(updateParams)
  updateParamsRef.current = updateParams
  // 同样经 ref：每轮渲染都是新对象；换内容由下面那个 effect 按稳定序列化比对
  const paneParamsRef = useRef(paneParams)
  paneParamsRef.current = paneParams
  /** 插件给的 `retarget`（原地换内容）；没给（卸载后重新挂载）就一直是 undefined */
  const retargetRef = useRef<((params: Record<string, unknown>) => void) | undefined>(undefined)
  /** 没挂载完成时换 params 什么都不做：挂载流程读的就是最新那份 */
  const mountedRef = useRef(false)
  /** 插件手上此刻是哪份参数（稳定序列化）；面板 params 换成插件自己上报的那份时，换内容的 effect 据此什么都不做 */
  const heldRef = useRef<string | undefined>(undefined)
  /** 加一就让挂载 effect 重跑，即卸载后重新挂载 */
  const [remounts, setRemounts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = hostRef.current
    if (container === null) return
    let disposed = false
    let dispose: (() => void) | undefined
    // portal 用 getter 在插件用它时才查：挂载那一刻面板 DOM 可能还不在桌面 section 里，提前算会退回 body、切桌面藏不掉
    const shell: ShellBridge = {
      openPane: (target, options) => openPaneRef.current(target, options),
      setPaneTitle: (title) => setTitleRef.current(title),
      keepPane: () => keepPaneRef.current(),
      setPaneContent: (raw) => {
        const parsed = parsePaneContent(raw)
        if (!parsed.ok) {
          console.warn(`[shell] ${pluginKey} 的窗格 ${paneId}：${parsed.error}，这次上报不生效`)
          return
        }
        const { content } = parsed
        const { update, notice } = contentUpdateOf(paneParamsRef.current, content)
        if (notice !== undefined) console.warn(`[shell] ${pluginKey} 的窗格 ${paneId}：${notice}`)
        if (content.params !== undefined) {
          // 先记下插件手上已是这份，再改面板：params 一变换内容的 effect 就会运行
          const mine = pluginParamsIn(content.params)
          heldRef.current = paramsKeyOf(mine)
          // 连着上报两次、中间没重渲染时，第二次要按第一次之后的参数算删哪些键
          paneParamsRef.current = mine
        }
        updateParamsRef.current(update)
        if (content.title !== undefined) setTitleRef.current(content.title)
      },
      get portal() {
        return portalHostOf(container)
      },
      onVisibility: (listener) => visibilityHub.subscribe(desktopIdOf(container), listener),
    }
    setError(null)
    setReady(false)

    void (async () => {
      try {
        const target = paneTargetIn(await fetchPanes(host), entryId, paneId)
        // 身份标记取注册表里此刻的包名：面板 params 里的 pluginKey 是开窗格那一刻存进布局文件的，包改名后还是旧名
        container.setAttribute('data-gwb-plugin', target.pkg)
        if (target.style !== undefined && !(await loadStyle(target.style))) {
          throw new Error(`${target.pkg} 注册窗格 ${paneId} 时报的样式表加载不了：${target.style}`)
        }
        if (disposed) return
        const mountPane = await importMountPane(target.client, target.pkg)
        if (disposed) return
        // 没传参数就不给这一项，插件据 `pane.params === undefined` 判断
        const openParams = paneParamsRef.current
        const pane = {
          id: paneId,
          instance: panelId,
          kind: target.kind,
          ...(openParams === undefined ? {} : { params: openParams }),
        }
        const handle = mountPane({ host, shell, pane }, container)
        dispose = pickDispose(handle)
        // retarget 可选：取不到就卸载后重新挂载，不是契约不符
        retargetRef.current = pickRetarget(handle)
        heldRef.current = paramsKeyOf(openParams)
        mountedRef.current = true
        if (dispose === undefined) {
          setError(
            `${pluginKey} 的 mountPane 没按契约回 { dispose() }，回的是${describeHandle(handle)}——关掉窗格时清理不了`,
          )
          return
        }
        if (!disposed) setReady(true)
      } catch (err) {
        if (!disposed) setError(String(err))
      }
    })()

    return () => {
      disposed = true
      mountedRef.current = false
      retargetRef.current = undefined
      // 卸载路径上的异常没有别的出口，必须记下来
      disposeOutsideCommit(dispose, (err) => {
        console.error(`[shell] ${pluginKey} 的 dispose 抛了：`, err)
      })
    }
    // paneParams 故意不在依赖里：每轮渲染都是新对象；换内容走下面的 effect，卸载后重新挂载靠 remounts
  }, [pluginKey, entryId, paneId, panelId, host, remounts])

  /** 外壳换了面板 params：插件给了 `retarget` 就调它原地换内容，没给就卸载后重新挂载；比稳定序列化，不比引用；没挂载完成时什么都不做 */
  const paramsKey = paramsKeyOf(paneParams)
  useEffect(() => {
    if (!mountedRef.current) return
    // 插件手上本来就是这份（自己上报的，或挂载时就是它）
    if (paramsKey === heldRef.current) return
    heldRef.current = paramsKey
    const retarget = retargetRef.current
    if (retarget === undefined) {
      setRemounts((n) => n + 1)
      return
    }
    try {
      retarget(paneParamsRef.current ?? {})
    } catch (err) {
      // 插件的 retarget 抛错时窗格还显示上一份内容，人看到的是点了没反应
      console.error(`[shell] ${pluginKey} 的 retarget 抛了：`, err)
    }
    // 只依赖 paramsKey（pluginKey 只用在报错里），别的都经 ref 读
  }, [paramsKey, pluginKey])

  if (error !== null) {
    return <p className="shell:text-destructive shell:m-0 shell:p-3 shell:text-sm">加载失败：{error}</p>
  }

  return (
    <div className="shell:relative shell:h-full">
      {/* `@container` 让窗格成为容器查询的根，插件的 `@md:` 按窗格宽度判；身份标记 `data-gwb-plugin` 由挂载 effect 按注册表写上，不参与选择器 */}
      <div ref={hostRef} className="shell:@container shell:h-full shell:overflow-auto" />
      {!ready && (
        <p className="shell:text-muted-foreground shell:pointer-events-none shell:absolute shell:inset-x-0 shell:top-2 shell:m-0 shell:text-center shell:text-sm">
          加载中…
        </p>
      )}
    </div>
  )
}

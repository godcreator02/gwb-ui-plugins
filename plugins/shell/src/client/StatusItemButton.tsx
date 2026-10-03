import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { loadStyle } from './asset.js'
import { describeHandle, disposeOutsideCommit, pickDispose, pickMountStatusItem } from './mount-handle.js'
import { iconFor } from './icon.js'
import type { HostBridge, StatusItemArgs, StatusItemRow } from './types.js'

/**
 * 浮层打开时挂载插件、关上时 dispose（radix 关上浮层就卸载内容）；挂载失败把原因写在浮层里。
 * 依赖只列按钮的身份与地址：按钮表重新取回来时行对象换了，浮层开着也不重新挂载
 */
function StatusItemBody({ item, host }: { item: StatusItemRow; host: HostBridge }): ReactElement {
  const { pkg, id, client, style } = item
  const containerRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const portal = portalRef.current
    if (container === null || portal === null) return
    let disposed = false
    let dispose: (() => void) | undefined
    container.setAttribute('data-gwb-plugin', pkg)

    void (async () => {
      try {
        if (style !== undefined && !(await loadStyle(style))) {
          throw new Error(`${pkg} 登记状态栏按钮 ${id} 时报的样式表加载不了：${style}`)
        }
        await window.gwb.prepareImports()
        const mod: unknown = await import(/* @vite-ignore */ client)
        if (disposed) return
        const mount = pickMountStatusItem(mod)
        if (mount === undefined) throw new Error(`${pkg} 的 client.js 没有 mountStatusItem 导出——那是状态栏按钮的入口名`)
        const args: StatusItemArgs = { host, item: { id }, portal }
        const handle = mount(args, container)
        dispose = pickDispose(handle)
        if (dispose === undefined) throw new Error(`${pkg} 的 mountStatusItem 没按契约回 { dispose() }，回的是${describeHandle(handle)}`)
        if (!disposed) setReady(true)
      } catch (err) {
        if (!disposed) setError(String(err))
      }
    })()

    return () => {
      disposed = true
      disposeOutsideCommit(dispose, (err) => {
        console.error(`[shell] ${pkg} 的状态栏按钮 ${id} 的 dispose 抛了：`, err)
      })
    }
  }, [pkg, id, client, style, host])

  return (
    <>
      {error !== null && <p className="shell:text-destructive shell:m-0 shell:max-w-80 shell:text-sm">加载失败：{error}</p>}
      {error === null && !ready && <p className="shell:text-muted-foreground shell:m-0 shell:text-sm">加载中…</p>}
      <div ref={containerRef} />
      <div ref={portalRef} />
    </>
  )
}

/** 状态栏上插件登记的一个按钮：点它在上方弹出浮层，内容由插件画 */
export function StatusItemButton({ item, host }: { item: StatusItemRow; host: HostBridge }): ReactElement {
  const Icon = iconFor(item.icon)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="xs" data-gwb-status-item={`${item.entryId}:${item.id}`} title={item.title}>
          <Icon />
          {item.title}
        </Button>
      </PopoverTrigger>
      {/* 状态栏自己的浮层挂在 body 上，切桌面后的 body 检查（sweepBodyPortals）据此跳过它 */}
      <PopoverContent side="top" align="start" className="shell:w-auto shell:p-2" data-gwb-status-layer="">
        <StatusItemBody item={item} host={host} />
      </PopoverContent>
    </Popover>
  )
}

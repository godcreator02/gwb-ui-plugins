/** 契约：`mountPane(args, container): { dispose(): void; retarget?(params): void }`，同步返回对象 */

/** 只看能不能调；返回值再经 pickDispose 收窄 */
export type MountLike = (...args: unknown[]) => unknown

/** 缺了或不是函数回 undefined */
export function pickMountPane(mod: unknown): MountLike | undefined {
  if (mod === null || (typeof mod !== 'object' && typeof mod !== 'function')) return undefined
  const mountPane = (mod as { mountPane?: unknown }).mountPane
  return typeof mountPane === 'function' ? (mountPane as MountLike) : undefined
}

/** 只认对象；`this` 绑回句柄，写成方法的 dispose 才拿得到自己的字段 */
export function pickDispose(handle: unknown): (() => void) | undefined {
  if (handle === null || typeof handle !== 'object') return undefined
  const dispose = (handle as { dispose?: unknown }).dispose
  if (typeof dispose !== 'function') return undefined
  return () => {
    ;(dispose as (this: unknown) => void).call(handle)
  }
}

/** 可选：取不到是正常路径，外壳改走硬换 */
export function pickRetarget(handle: unknown): ((params: Record<string, unknown>) => void) | undefined {
  if (handle === null || typeof handle !== 'object') return undefined
  const retarget = (handle as { retarget?: unknown }).retarget
  if (typeof retarget !== 'function') return undefined
  return (params) => {
    ;(retarget as (this: unknown, params: Record<string, unknown>) => void).call(handle, params)
  }
}

/**
 * 插件的 dispose 排进微任务、在 React 提交之外执行：在提交里同步 `root.unmount()` 会被推迟，
 * 紧接着的清空容器就先于卸载。dispose 抛错交给 `report`
 */
export function disposeOutsideCommit(dispose: (() => void) | undefined, report: (err: unknown) => void): void {
  queueMicrotask(() => {
    try {
      dispose?.()
    } catch (err) {
      report(err)
    }
  })
}

/** 契约不符时写明它返回的是什么 */
export function describeHandle(handle: unknown): string {
  if (handle === null) return 'null'
  if (handle === undefined) return 'undefined'
  // mountPane 写成 async 时句柄是 Promise，按「对象（键：无）」报的话人看不出来，单独点名
  if (
    (typeof handle === 'object' || typeof handle === 'function') &&
    typeof (handle as { then?: unknown }).then === 'function'
  ) {
    return '一个 Promise（mountPane 写成了 async？契约里它是同步的，句柄得当场回）'
  }
  if (typeof handle === 'function') return '一个函数（契约要的是 { dispose() } 对象）'
  if (typeof handle === 'object') return `一个对象（键：${Object.keys(handle).join(', ') || '无'}）`
  return typeof handle
}

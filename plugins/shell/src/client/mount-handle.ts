/**
 * 动态 import 回来的件 client 模块是 `any`，这里按窗格契约收窄：取 `mountPane` 导出、
 * 句柄上的 `dispose`、可选的 `retarget`。零 import、不碰 DOM，测试在 node 里直接跑。
 *
 * 契约是 `mountPane(args, container): { dispose(): void; retarget?(params): void }`
 * ——回的是对象不是函数；`dispose` 取不到就是契约不符，要说出来（撞墙经过见文档站）。
 */

/** 只按「能不能调」看待 mountPane：参数由调用方按契约给，返回值再经 pickDispose 收窄 */
export type MountLike = (...args: unknown[]) => unknown

/** 模块上按契约取 `mountPane` 导出；缺了或不是函数回 undefined */
export function pickMountPane(mod: unknown): MountLike | undefined {
  if (mod === null || (typeof mod !== 'object' && typeof mod !== 'function')) return undefined
  const mount = (mod as { mountPane?: unknown }).mountPane
  return typeof mount === 'function' ? (mount as MountLike) : undefined
}

/**
 * mountPane 回的句柄 → 可调的 dispose。只认对象（契约写的就是对象，别的形态由调用方
 * 按契约不符报）。`this` 绑回句柄本身：写成方法的 dispose() 才拿得到自己的字段。
 */
export function pickDispose(handle: unknown): (() => void) | undefined {
  if (handle === null || typeof handle !== 'object') return undefined
  const dispose = (handle as { dispose?: unknown }).dispose
  if (typeof dispose !== 'function') return undefined
  return () => {
    ;(dispose as (this: unknown) => void).call(handle)
  }
}

/**
 * 句柄上那支**可选的** `retarget`（软换）。挑不到不是错——没给这支的件外壳走硬换，
 * undefined 是正常路径。
 */
export function pickRetarget(handle: unknown): ((params: Record<string, unknown>) => void) | undefined {
  if (handle === null || typeof handle !== 'object') return undefined
  const retarget = (handle as { retarget?: unknown }).retarget
  if (typeof retarget !== 'function') return undefined
  return (params) => {
    ;(retarget as (this: unknown, params: Record<string, unknown>) => void).call(handle, params)
  }
}

/**
 * 在 React 提交之外拆一格：件的 `dispose` 与桶的 `release` 排进微任务，先后照旧。
 *
 * 窗格的清理 effect 跑在外壳的提交里（关格、换壳拆整棵树都是），件在 `dispose` 里同步
 * `root.unmount()` 会被 React 推迟，紧跟着的 `container.textContent = ''` 就抢在拆树
 * 前面，渲染层报 removeChild 的 NotFoundError。排出提交之后，契约里「dispose 同步拆完」
 * 才成立。`dispose` 抛了也照样 release，异常交给 `report`。
 */
export function disposeOutsideCommit(
  dispose: (() => void) | undefined,
  release: () => void,
  report: (err: unknown) => void,
): void {
  queueMicrotask(() => {
    try {
      dispose?.()
    } catch (err) {
      report(err)
    }
    release()
  })
}

/** 契约不符时给人看的一句：说清它回的是什么 */
export function describeHandle(handle: unknown): string {
  if (handle === null) return 'null'
  if (handle === undefined) return 'undefined'
  // mountPane 写成了 async：句柄是 Promise，上面当然没有 dispose。按「对象（键：无）」报
  // 人看不出是 thenable，这一种要点名——契约里 mountPane 是同步的
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

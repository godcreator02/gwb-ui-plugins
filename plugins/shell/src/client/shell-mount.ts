/**
 * 外壳整棵树的挂与拆。准备是异步的（问环境、等样式表、取注册表与布局档），落树是同步的
 * 一小段（createRoot + render），拆是同步的 `unmount()`。零 import、不碰 DOM，测试在 node 里直接跑。
 *
 * 契约三条：
 * - `dispose()` 返回时树已经拆完——调用方（内核页面根）紧接着清空容器，拆树不许落在那之后
 * - 准备还没好就 dispose 了：落树那段永不执行，页面上不会长出一棵没人拆的树
 * - 准备失败只在没被 dispose 时报，拆掉之后的迟到失败不往已经交出去的容器里写字
 */

export interface MountedTree {
  unmount(): void
}

/** 准备好之后回落树的那一段；回 undefined 表示不落（比如准备途中发现已经被拆） */
export type Prepare = (alive: () => boolean) => Promise<(() => MountedTree) | undefined>

export function mountWhenReady(prepare: Prepare, fail: (err: unknown) => void): { dispose(): void } {
  let disposed = false
  let tree: MountedTree | undefined
  const alive = (): boolean => !disposed

  void (async () => {
    try {
      const mount = await prepare(alive)
      if (disposed || mount === undefined) return
      tree = mount()
    } catch (err) {
      if (!disposed) fail(err)
    }
  })()

  return {
    dispose() {
      if (disposed) return
      disposed = true
      const current = tree
      tree = undefined
      current?.unmount()
    },
  }
}

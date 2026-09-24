/**
 * 契约：`dispose()` 返回时树已卸载（内核页面根紧接着清空容器）；准备完成前就 dispose 的，挂载那段永不执行；
 * dispose 之后才到的准备失败不再报
 */

export interface MountedTree {
  unmount(): void
}

/** 准备好后回挂载那一段；回 undefined 表示不挂载 */
export type Prepare = (alive: () => boolean) => Promise<(() => MountedTree) | undefined>

export function mountWhenReady(prepare: Prepare, fail: (err: unknown) => void): { dispose(): void } {
  let disposed = false
  let mountedTree: MountedTree | undefined
  const alive = (): boolean => !disposed

  void (async () => {
    try {
      const mountTree = await prepare(alive)
      if (disposed || mountTree === undefined) return
      mountedTree = mountTree()
    } catch (err) {
      if (!disposed) fail(err)
    }
  })()

  return {
    dispose() {
      if (disposed) return
      disposed = true
      const treeToUnmount = mountedTree
      mountedTree = undefined
      treeToUnmount?.unmount()
    },
  }
}

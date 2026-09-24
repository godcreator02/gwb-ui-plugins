/** 窗格拿到的总线句柄。按形状声明、不 extends 浏览器侧的类型：本模块要能在 node 里直接测 */
export interface PaneBusHandle {
  /** `release` 之后什么都不做、也不报错：外壳先让插件 dispose 再 release，插件在 dispose 里 emit 仍然有效 */
  emit(type: string, detail?: unknown): void
  /** 回注销函数，调两次不报错 */
  on(type: string, listener: (detail: unknown) => void): () => void
  /** 幂等：先注销自己注册的监听函数，分组上最后一个句柄释放时整个删除分组 */
  release(): void
}

export interface BusRegistry {
  acquire(scope: string): PaneBusHandle
  /** 只给验收用：此刻有哪些分组、各有几个句柄、注册了哪些事件名 */
  inspect(): { scope: string; refs: number; types: string[] }[]
}

type BusListener = (detail: unknown) => void

interface Bucket {
  listenersByType: Map<string, Set<BusListener>>
  refs: number
}

function removeListener(bucket: Bucket, type: string, listener: BusListener): void {
  const listenersOfType = bucket.listenersByType.get(type)
  if (listenersOfType === undefined) return
  listenersOfType.delete(listener)
  if (listenersOfType.size === 0) bucket.listenersByType.delete(type)
}

function addListener(bucket: Bucket, type: string, listener: BusListener): void {
  let listenersOfType = bucket.listenersByType.get(type)
  if (listenersOfType === undefined) {
    listenersOfType = new Set()
    bucket.listenersByType.set(type, listenersOfType)
  }
  listenersOfType.add(listener)
}

export function createBusRegistry(): BusRegistry {
  const bucketsByScope = new Map<string, Bucket>()

  function bucketFor(scope: string): Bucket {
    let bucket = bucketsByScope.get(scope)
    if (bucket === undefined) {
      bucket = { listenersByType: new Map(), refs: 0 }
      bucketsByScope.set(scope, bucket)
    }
    return bucket
  }

  return {
    inspect() {
      return [...bucketsByScope.entries()].map(([scope, bucket]) => ({
        scope,
        refs: bucket.refs,
        types: [...bucket.listenersByType.entries()].map(([type, listenersOfType]) => `${type}×${String(listenersOfType.size)}`),
      }))
    },
    acquire(scope) {
      const bucket = bucketFor(scope)
      bucket.refs += 1
      let released = false
      /** release 时照着它逐条注销：同一条目还有别的窗格占着时分组不删，不注销的话关掉的窗格还会收到事件 */
      const ownListeners = new Set<{ type: string; listener: BusListener }>()

      return {
        emit(type, detail) {
          const listenersOfType = bucket.listenersByType.get(type)
          if (listenersOfType === undefined) return
          // 拷贝一份再遍历：监听函数收到事件后注销自己是常见写法，直接遍历正在被修改的集合会漏掉或重复
          // oxlint-disable-next-line unicorn/no-useless-spread
          for (const listener of [...listenersOfType]) {
            try {
              listener(detail)
            } catch (err) {
              console.error(`[shell] 条目 ${scope} 的窗格听 ${type} 时抛了：`, err)
            }
          }
        },
        on(type, listener) {
          addListener(bucket, type, listener)
          const ownListener = { type, listener }
          ownListeners.add(ownListener)
          return () => {
            ownListeners.delete(ownListener)
            removeListener(bucket, type, listener)
          }
        },
        release() {
          if (released) return
          released = true
          // 先注销再减计数：反过来的话分组可能已经删除，注销不起作用
          for (const { type, listener } of ownListeners) removeListener(bucket, type, listener)
          ownListeners.clear()
          bucket.refs -= 1
          // 只删自己这个分组：条目关掉再开的话，表里已经换成新的分组
          if (bucket.refs <= 0 && bucketsByScope.get(scope) === bucket) bucketsByScope.delete(scope)
        },
      }
    },
  }
}

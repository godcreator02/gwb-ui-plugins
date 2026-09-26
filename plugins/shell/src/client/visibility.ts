export type VisibilityListener = (visible: boolean) => void

export interface VisibilityHub {
  /**
   * 注册即回一次当下值，之后每次切换再回；回注销函数，调两次不报错。
   * 还没通知过的桌面按可见算：容器只在第一次切到时挂载，挂载那一刻它必然可见
   */
  subscribe(desktopId: string, listener: VisibilityListener): () => void
  /** 监听函数抛异常按监听函数隔离：一个抛了，别的照样收到 */
  notify(desktopId: string, visible: boolean): void
}

function callIsolated(desktopId: string, listener: VisibilityListener, visible: boolean): void {
  try {
    listener(visible)
  } catch (err) {
    console.error(`[shell] 桌面 ${desktopId} 的可见性听众抛了：`, err)
  }
}

export function createVisibilityHub(): VisibilityHub {
  const listenersByDesktop = new Map<string, Set<VisibilityListener>>()
  const lastVisibilityByDesktop = new Map<string, boolean>()

  return {
    subscribe(desktopId, listener) {
      let desktopListeners = listenersByDesktop.get(desktopId)
      if (desktopListeners === undefined) {
        desktopListeners = new Set()
        listenersByDesktop.set(desktopId, desktopListeners)
      }
      desktopListeners.add(listener)
      // 这一次同样隔离：监听函数在注册回调里就退订是正当写法
      callIsolated(desktopId, listener, lastVisibilityByDesktop.get(desktopId) ?? true)
      return () => {
        desktopListeners.delete(listener)
        if (desktopListeners.size === 0) listenersByDesktop.delete(desktopId)
      }
    },

    notify(desktopId, visible) {
      lastVisibilityByDesktop.set(desktopId, visible)
      const desktopListeners = listenersByDesktop.get(desktopId)
      if (desktopListeners === undefined) return
      // 拷贝一份再遍历：监听函数收到一次就退订是正当用法
      // oxlint-disable-next-line unicorn/no-useless-spread
      for (const listener of [...desktopListeners]) callIsolated(desktopId, listener, visible)
    },
  }
}

/** 一页只有一个外壳，可见性通知也只有一份 */
export const visibilityHub: VisibilityHub = createVisibilityHub()

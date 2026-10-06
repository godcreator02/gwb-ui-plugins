import type { PaneOwner } from './pane-registry.js'

/** 外壳每次启动时注入页面的用户外观样式：只收一份，主题插件是可选的、没装就没有 */
export interface StartupStyleSlot {
  /** 已有别的插件登记时抛错；返回的注销函数只撤自己那一份 */
  register(owner: PaneOwner, read: () => string): () => void
  /**
   * 空白是用户没设置，当没有；读的时候抛错也当没有，但记一条 error——外壳照常启动，只是少了用户外观样式
   */
  css(logError: (message: string) => void): string | undefined
}

export function createStartupStyleSlot(): StartupStyleSlot {
  let registered: { owner: PaneOwner; read: () => string } | undefined
  return {
    register(owner, read) {
      if (registered !== undefined) {
        throw new Error(`启动样式已由 ${registered.owner.pkg}（${registered.owner.entryId}）登记，外壳只收一份，${owner.pkg} 没登记上`)
      }
      const mine = { owner, read }
      registered = mine
      return () => {
        if (registered === mine) registered = undefined
      }
    },
    css(logError) {
      if (registered === undefined) return undefined
      let css: string
      try {
        css = registered.read()
      } catch (err: unknown) {
        logError(`${registered.owner.pkg} 登记的启动样式读不出，这次启动不带用户外观样式：${String(err)}`)
        return undefined
      }
      return css.trim() === '' ? undefined : css
    },
  }
}

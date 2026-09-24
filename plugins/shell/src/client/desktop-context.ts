/** 这两个是 DOM 约定的标记，不进任何样式表，所以不带 `shell:` 前缀 */

/** 桌面那个 section 上的属性，值是桌面 id（d1、d2…） */
export const DESKTOP_ATTR = 'data-gwb-desktop'

/** 每张桌面里浮层的挂载点（容器的兄弟节点），插件里 radix Portal 的 container 指向它 */
export const PORTAL_HOST_CLASS = 'gwb-portal-host'

/** 按 DOM 祖先找所在桌面；认不出回空串，空串上没有可见性通知，等于永远可见 */
export function desktopIdOf(el: Element | null): string {
  return el?.closest(`[${DESKTOP_ATTR}]`)?.getAttribute(DESKTOP_ATTR) ?? ''
}

/** 认不出（不在桌面体系里）回 `document.body`，即 radix Portal 的缺省，插件不用判空 */
export function portalHostOf(el: Element | null): HTMLElement {
  const section = el?.closest(`[${DESKTOP_ATTR}]`)
  const host = section?.querySelector(`:scope > .${PORTAL_HOST_CLASS}`)
  return host instanceof HTMLElement ? host : document.body
}

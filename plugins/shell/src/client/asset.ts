/** 注入过的地址不再注入，也不移除：移除要引用计数，计错了会关一个窗格、另一个窗格的样式跟着没了 */
const mounted = new Map<string, Promise<boolean>>()

/** 等 `load` 再 resolve：`<link>` 是异步取的，只 append 的话第一帧可能没有样式。取不到回 false、不抛，插件可以没有样式表 */
export function loadStyle(href: string): Promise<boolean> {
  const seen = mounted.get(href)
  if (seen !== undefined) return seen
  const task = new Promise<boolean>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.addEventListener('load', () => resolve(true))
    link.addEventListener('error', () => resolve(false))
    document.head.appendChild(link)
  })
  mounted.set(href, task)
  return task
}

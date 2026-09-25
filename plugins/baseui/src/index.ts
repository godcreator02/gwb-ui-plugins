import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为引入这几个包的 `declare module 'cordis'`，让 ctx 上有各自的服务名
import type {} from '@godcreator/gwb-logger'
import type {} from '@godcreator/gwb-plugin-manager'
import type {} from '@godcreator/gwb-shell'

export const name = 'gwb-baseui'

/** 与本模块同在 dist/ 下 */
const CLIENT_URL = new URL('./client.js', import.meta.url).href
const STYLE_URL = new URL('./style.css', import.meta.url).href

/** 必需依赖只有外壳：没有窗格容器就没有窗格集 */
export const inject = ['gwbShell']

/** 局部注入：没装日志插件时这个子 fiber 一直 PENDING，只是不注册日志窗格 */
function registerLoggerPaneWheneverLoggerIsLoaded(ctx: GwbContext): void {
  ctx.inject(['gwbLogger'], (contextWithLogger) => {
    contextWithLogger.effect(() =>
      contextWithLogger.gwbShell.registerPane({ id: 'logger', title: '日志', icon: 'scroll-text', client: CLIENT_URL, style: STYLE_URL }),
    )
  })
}

/** gwbPluginManager 服务上没有方法，只用来决定注不注册窗格；窗格的操作全部经 plugin-manager.* 命令 */
function registerPluginManagerPaneWheneverPluginManagerIsLoaded(ctx: GwbContext): void {
  ctx.inject(['gwbPluginManager'], (contextWithPluginManager) => {
    contextWithPluginManager.effect(() =>
      contextWithPluginManager.gwbShell.registerPane({ id: 'plugin-manager', title: '插件管理', icon: 'puzzle', client: CLIENT_URL, style: STYLE_URL }),
    )
  })
}

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)
  ctx.gwbShell.describeSelf({ title: '基础界面', icon: 'layout-grid' })
  registerLoggerPaneWheneverLoggerIsLoaded(ctx)
  registerPluginManagerPaneWheneverPluginManagerIsLoaded(ctx)
  log.info('基础界面已就绪（装了哪些 core 插件，就注册哪些窗格）')
}

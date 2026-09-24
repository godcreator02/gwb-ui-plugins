import type { GwbContext } from '@godcreator/gwb-plugin-api'
// 只为引入这几个包的 `declare module 'cordis'`，让 ctx 上有各自的服务名。
// logger 与 plugin-manager **都是局部注入**：home 里缺哪个，下面对应的那块局部注入就一直 PENDING，
// 本插件照常加载，只是不注册对应的窗格
import type {} from '@godcreator/gwb-logger'
import type {} from '@godcreator/gwb-plugin-manager'
import type {} from '@godcreator/gwb-shell'

/**
 * 基础界面插件：基础插件的官方窗格集。一个插件注册多个窗格，浏览器端按 `pane.id` 分派。
 *
 * 三条规矩（哪条破了本插件就会变成什么都往里放的上帝插件）：
 *
 * 1. 对每个 core 服务**一律局部注入**，硬等待只有 gwbShell——缺哪个服务就少注册哪个窗格
 * 2. **一个窗格一个模块**：`panes/` 下的窗格互不引用，共享组件放在 `src/client/components/ui`
 * 3. **只收拆掉了界面的 core 插件的窗格**：进本插件的唯一资格是它是某个 core 插件的官方界面；
 *    界面本身就是全部功能的插件（hello、theme、将来的功能插件）自带界面，不放这里
 */

export const name = 'gwb-baseui'

/** 浏览器端脚本与样式表的地址，注册窗格时报给外壳。它们和本模块同在 dist/ 下，从本模块的地址算 */
const CLIENT_URL = new URL('./client.js', import.meta.url).href
const STYLE_URL = new URL('./style.css', import.meta.url).href

/** 没有外壳就不加载：没有窗格容器，就没有「窗格集」 */
export const inject = ['gwbShell']

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)

  // 状态栏显示一次本插件自己的名字与图标；各窗格的标题与图标在各自注册时给
  ctx.gwbShell.describeSelf({ title: '基础界面', icon: 'layout-grid' })

  // 日志窗格。gwb-logger 提供缓冲、查询命令与事件流，这里只是它的界面
  ctx.inject(['gwbLogger'], (scoped) => {
    scoped.effect(() =>
      scoped.gwbShell.registerPane({ id: 'logger', title: '日志', icon: 'scroll-text', client: CLIENT_URL, style: STYLE_URL }),
    )
  })

  // 插件管理窗格。服务 gwbPluginManager 只表示「插件管理装了」（上面没有方法），这里只用它决定注不注册窗格；
  // 窗格的全部操作都经 plugin-manager.* 命令
  ctx.inject(['gwbPluginManager'], (scoped) => {
    scoped.effect(() =>
      scoped.gwbShell.registerPane({ id: 'plugin-manager', title: '插件管理', icon: 'puzzle', client: CLIENT_URL, style: STYLE_URL }),
    )
  })

  log.info('基础界面已就绪（装了哪些 core 插件，就注册哪些窗格）')
}

import path from 'node:path'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
// 只为引入这几个包的 `declare module 'cordis'`，让 ctx 上有各自的服务名
import type {} from '@godcreator/gwb-commands'
import type {} from '@godcreator/gwb-plugin-manager'
import type {} from '@godcreator/gwb-shell'
import { QUERY_COMMAND, QUERY_USAGE, logQueryFrom, queryLogFile } from './log-query/query.js'
import { requireKernel } from './vocab.js'

export const name = 'gwb-baseui'

/** 与本模块同在 dist/ 下 */
const CLIENT_URL = new URL('./client.js', import.meta.url).href
const STYLE_URL = new URL('./style.css', import.meta.url).href

/** 内核写的日志文件名，与内核靠约定对齐；轮转出的旧文件是 `<它>.1` */
const LOG_FILE_NAME = 'gwb.log'

/** 必需依赖只有外壳：没有窗格容器就没有窗格集 */
export const inject = ['gwbShell']

/** 日志窗格只按命令名调 `logger.query`，总是注册：命令不在时窗格照样有，里面显示命令失败的原因 */
function registerLoggerPane(ctx: GwbContext): void {
  ctx.effect(() => ctx.gwbShell.registerPane({ id: 'logger', title: '日志', icon: 'scroll-text', client: CLIENT_URL, style: STYLE_URL }))
}

/** `plugin` 不写：命令总线从调用方的条目取包名 */
function registerLogQueryCommandWheneverCommandBusIsLoaded(ctx: GwbContext): void {
  ctx.inject(['gwbCommands'], (contextWithCommandBus) => {
    const logFile = path.join(requireKernel(ctx).dataDir, LOG_FILE_NAME)
    // 命令插件把 gwbCommands 声明成可选；inject 保证它在
    const commandBus = contextWithCommandBus.gwbCommands!
    contextWithCommandBus.effect(() =>
      commandBus.register(
        {
          name: QUERY_COMMAND,
          description: '查内核写的日志文件 gwb.log（含轮转出的 gwb.log.1）：可按级别、logger 名、子串筛，只取最近几条，或只取某个位置之后新写的',
          usage: QUERY_USAGE,
          effect: 'read',
        },
        async (args) => queryLogFile(logFile, logQueryFrom(args)),
      ),
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
  registerLoggerPane(ctx)
  registerLogQueryCommandWheneverCommandBusIsLoaded(ctx)
  registerPluginManagerPaneWheneverPluginManagerIsLoaded(ctx)
  log.info('基础界面已就绪（日志窗格总是注册，有命令总线才登记 logger.query，装了插件管理才注册插件管理窗格）')
}

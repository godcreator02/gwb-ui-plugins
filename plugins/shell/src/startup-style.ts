import type { GwbCommands } from '@godcreator/gwb-commands'

/** 与主题插件导出的 `STARTUP_COMMAND` 各存一份：主题插件 peer 外壳，外壳 import 它会成环 */
export const THEME_STARTUP_COMMAND = 'theme.startupCss'

/**
 * 主题插件是可选的：命令表里没有这条就不调（调不存在的命令会记一条 warn）。
 * 空白是用户没设置，当没有；回失败、回的不是字符串也当没有，但记一条 error——外壳照常启动，只是少了用户外观样式
 */
export async function startupCss(bus: Pick<GwbCommands, 'list' | 'run'>, logError: (message: string) => void): Promise<string | undefined> {
  if (!bus.list().some((command) => command.name === THEME_STARTUP_COMMAND)) return undefined
  const reply = await bus.run(THEME_STARTUP_COMMAND)
  if (!reply.ok) {
    logError(`${THEME_STARTUP_COMMAND} 回了失败，这次启动不带用户外观样式：${reply.error ?? '没说原因'}`)
    return undefined
  }
  if (typeof reply.data !== 'string') {
    logError(`${THEME_STARTUP_COMMAND} 回的不是字符串（${typeof reply.data}），这次启动不带用户外观样式`)
    return undefined
  }
  return reply.data.trim() === '' ? undefined : reply.data
}

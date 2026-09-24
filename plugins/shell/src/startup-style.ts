import type { GwbCommands } from '@godcreator/gwb-commands'

/** 与主题插件导出的 `STARTUP_COMMAND` 各存一份：主题插件 peer 外壳，外壳 import 它会成环 */
export const THEME_STARTUP_COMMAND = 'theme.startupCss'

/**
 * 主题插件是可选的：命令表里没有这条就不调（调不存在的命令会记一条 warn）。
 * 回失败、回的不是字符串或是空白，都当没有
 */
export async function startupCss(bus: Pick<GwbCommands, 'list' | 'run'>): Promise<string | undefined> {
  if (!bus.list().some((command) => command.name === THEME_STARTUP_COMMAND)) return undefined
  const reply = await bus.run(THEME_STARTUP_COMMAND)
  return reply.ok && typeof reply.data === 'string' && reply.data.trim() !== '' ? reply.data : undefined
}

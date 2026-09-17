import type { GwbCommands } from '@godcreator/gwb-commands'

/**
 * 开机那一刻的用户外观样式（gwb-theme 的字体覆盖 + 自定义 CSS）。不碰 ctx，测试喂一份假总线。
 *
 * **软契约**：命令名两个件各存一份字符串，外壳不 import 主题件的任何东西（主题件 peer 外壳，
 * 反过来就成环）。主题件那半是它导出的 `STARTUP_COMMAND`。
 */
export const THEME_STARTUP_COMMAND = 'theme.startupCss'

/**
 * theme 是可选件：**总线上没有这条命令就不调**——调一条不在的命令，总线会记一条 warn，
 * 而「没装可选件」不是毛病。命令在但回失败（总线自己记账）、回的不是字符串或是空白，一律当没有。
 */
export async function startupCss(bus: Pick<GwbCommands, 'list' | 'run'>): Promise<string | undefined> {
  if (!bus.list().some((c) => c.name === THEME_STARTUP_COMMAND)) return undefined
  const reply = await bus.run(THEME_STARTUP_COMMAND)
  return reply.ok && typeof reply.data === 'string' && reply.data.trim() !== '' ? reply.data : undefined
}

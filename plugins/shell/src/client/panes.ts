import type { HostBridge, PaneRow, PluginRow } from './types.js'
import { PANES_COMMAND, PLUGINS_COMMAND } from '../protocol.js'
import { wellHub } from './well-hub.js'

/**
 * 取一次注册表。**取不到回空表并记一条错**：外壳照样画出空井，因为「一个件都没注册」
 * 本来就是合法状态，而井在不在跟表取没取到是两回事。
 *
 * 井与每一格开格时都现取，不存快照：件是热挂载的，表是会变的。取到的那份顺手记进枢纽——
 * 标签菜单要同步地问「这一格是哪一类」，而开机那一趟已经取过一次，缓存从一开始就是热的。
 */
export async function fetchPanes(host: HostBridge): Promise<PaneRow[]> {
  try {
    const reply = (await host.call(PANES_COMMAND)) as { ok?: boolean; data?: unknown; error?: string }
    if (reply.ok !== true || !Array.isArray(reply.data)) {
      console.error(`[shell] ${PANES_COMMAND} 没回一张表：${reply.error ?? JSON.stringify(reply)}`)
      return []
    }
    const rows = reply.data as PaneRow[]
    wellHub.notePanes(rows)
    return rows
  } catch (err) {
    console.error(`[shell] ${PANES_COMMAND} 调不通：${String(err)}`)
    return []
  }
}

/** 取一次件名表（启动器按插件分组时拿它当组名）。取不到回空表——组名退回包名，不拦启动器 */
export async function fetchPlugins(host: HostBridge): Promise<PluginRow[]> {
  try {
    const reply = (await host.call(PLUGINS_COMMAND)) as { ok?: boolean; data?: unknown }
    return reply.ok === true && Array.isArray(reply.data) ? (reply.data as PluginRow[]) : []
  } catch {
    return []
  }
}

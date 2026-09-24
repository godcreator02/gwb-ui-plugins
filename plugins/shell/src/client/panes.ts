import type { HostBridge, PaneRow, PluginRow } from './types.js'
import { PANES_COMMAND, PLUGINS_COMMAND } from '../protocol.js'
import { wellHub } from './well-hub.js'

/**
 * 取不到回空表并记一条 error：一个插件都没注册是合法状态，外壳照样画出空容器。
 * 取到的顺手记进 wellHub，标签菜单要同步地问窗格是哪一类
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

/** 启动器的组名用它；取不到回空表，组名退回包名 */
export async function fetchPlugins(host: HostBridge): Promise<PluginRow[]> {
  try {
    const reply = (await host.call(PLUGINS_COMMAND)) as { ok?: boolean; data?: unknown }
    return reply.ok === true && Array.isArray(reply.data) ? (reply.data as PluginRow[]) : []
  } catch {
    return []
  }
}

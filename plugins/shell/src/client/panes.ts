import type { HostBridge, PaneRow, PluginRow } from './types.js'
import type { PaneKind } from '../openable.js'
import { PANES_COMMAND, PLUGINS_COMMAND } from '../protocol.js'
import { wellHub } from './well-hub.js'

/** 挂载一个窗格要的东西，全部取自当场的注册表 */
export interface PaneTarget {
  client: string
  style: string | undefined
  kind: PaneKind
}

/** 注册表里没有这个窗格（插件卸载了）或注册时没给 client 都抛错 */
export function paneTargetIn(rows: PaneRow[], entryId: string, paneId: string): PaneTarget {
  const row = rows.find((r) => r.entryId === entryId && r.id === paneId)
  if (row === undefined) throw new Error(`注册表里没有条目 ${entryId} 的窗格 ${paneId}——插件卸载了？`)
  if (row.client === undefined) throw new Error(`${row.pkg} 注册窗格 ${paneId} 时没报浏览器侧的地址（client）`)
  return { client: row.client, style: row.style, kind: row.kind }
}

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

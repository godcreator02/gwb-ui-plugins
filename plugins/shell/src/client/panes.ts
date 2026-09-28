import type { HostBridge, PaneRow, PluginRow } from './types.js'
import type { PaneKind } from '../openable.js'
import { PANES_COMMAND, PLUGINS_COMMAND } from '../protocol.js'
import { wellHub } from './well-hub.js'

/** 挂载一个窗格要的东西，全部取自当场的注册表；`pkg` 是此刻的包名，不是布局文件里保存的那份 */
export interface PaneTarget {
  pkg: string
  client: string
  style: string | undefined
  kind: PaneKind
}

/** 注册表里没有这个窗格（插件卸载了）或注册时没给 client 都抛错 */
export function paneTargetIn(rows: PaneRow[], entryId: string, paneId: string): PaneTarget {
  const row = rows.find((r) => r.entryId === entryId && r.id === paneId)
  if (row === undefined) throw new Error(`注册表里没有条目 ${entryId} 的窗格 ${paneId}——插件卸载了？`)
  if (row.client === undefined) throw new Error(`${row.pkg} 注册窗格 ${paneId} 时没报浏览器侧的地址（client）`)
  return { pkg: row.pkg, client: row.client, style: row.style, kind: row.kind }
}

/**
 * 取不到就抛错：空表是「一个插件都没注册」，取失败当成空表的话启动器会说「还没有插件注册窗格」。
 * 取到的表同时记进 wellHub：标签菜单要同步地查窗格是哪一类
 */
export async function fetchPanes(host: HostBridge): Promise<PaneRow[]> {
  let reply: { ok?: boolean; data?: unknown; error?: string }
  try {
    reply = (await host.call(PANES_COMMAND)) as typeof reply
  } catch (err) {
    throw new Error(`${PANES_COMMAND} 调不通：${String(err)}`, { cause: err })
  }
  if (reply.ok !== true || !Array.isArray(reply.data)) {
    throw new Error(`${PANES_COMMAND} 没回一张表：${reply.error ?? JSON.stringify(reply)}`)
  }
  const rows = reply.data as PaneRow[]
  wellHub.notePanes(rows)
  return rows
}

/** 启动器的组名用它；取不到回空表、组名退回包名，并记一条 error */
export async function fetchPlugins(host: HostBridge): Promise<PluginRow[]> {
  let reply: { ok?: boolean; data?: unknown; error?: string }
  try {
    reply = (await host.call(PLUGINS_COMMAND)) as typeof reply
  } catch (err) {
    console.error(`[shell] ${PLUGINS_COMMAND} 调不通，启动器的组名退回包名：${String(err)}`)
    return []
  }
  if (reply.ok !== true || !Array.isArray(reply.data)) {
    console.error(`[shell] ${PLUGINS_COMMAND} 没回一张表，启动器的组名退回包名：${reply.error ?? JSON.stringify(reply)}`)
    return []
  }
  return reply.data as PluginRow[]
}

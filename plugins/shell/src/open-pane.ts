import type { OpenPaneOptions, Placement } from './openable.js'

/**
 * 跨件开格那一条的纯判断：`shell.openPane` 转进来的动作长什么样、总线参数怎么认成
 * 一份合法载荷、事件载荷怎么挑回 `openPane` 的那几样与来源。
 *
 * 纯机、无 DOM，node 半与浏览器半共用这一份，测试在 node 里直接跑。
 */

/** node → 页面那条开格动作事件上的记号。载荷形状就是 `OpenPaneAction` */
export const OPEN_PANE_EVENT = 'gwb-shell-open-pane'

/**
 * 页面上执行得了的开格动作。**井在页面那半**，node 半的命令只是把动作经内核事件口
 * 转进去；页面那侧拿注册表现取的那条链执行（判断照旧 `planOpen`）。命令回执只代表
 * 「转发了」，不代表「开完了」。
 */
export interface OpenPaneAction {
  t: typeof OPEN_PANE_EVENT
  /** 谁的哪一格：注册表的键就是这两样拼的，光给 paneId 会撞名 */
  entryId: string
  paneId: string
  /** 这一份装的内容，语义同件开自己格的那个 key */
  key?: string
  /** 交给这一份的参数，跟着布局落盘，必须可 JSON 序列化 */
  params?: Record<string, unknown>
  /** 放进目标组的预览槽（每组每一格至多一份，转正就是删键） */
  preview?: boolean
  /**
   * 来源窗格的实例 id（件手上的 `pane.instance`）。新窗格落在它旁边、开在它所在的那张
   * 桌面上；页面上找不到它就当没有来源
   */
  from?: string
  /** 往哪放，缺省 auto */
  placement?: Placement
}

/** 事件载荷的宽松形状：事件口上什么件的事件都有，认了自己那记号再按这个收窄 */
export interface OpenPaneActionLike {
  t?: unknown
  entryId?: unknown
  paneId?: unknown
  key?: unknown
  params?: unknown
  preview?: unknown
  from?: unknown
  placement?: unknown
}

/** 是不是一条开格动作（记号对得上）。事件监听那侧的第一道过滤 */
export function isOpenPaneAction(payload: unknown): payload is OpenPaneActionLike {
  if (payload === null || typeof payload !== 'object') return false
  return (payload as OpenPaneActionLike).t === OPEN_PANE_EVENT
}

/**
 * params 的门：平对象、JSON 序列化不炸。它跟着面板进 `toJSON()` 整档落盘，循环引用
 * 在这儿就拦下，别让它写坏盘上那份布局档。
 */
function plainParams(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  try {
    JSON.stringify(value)
  } catch {
    return false
  }
  return true
}

function isPlacement(value: unknown): value is Placement {
  return value === 'auto' || value === 'side'
}

/**
 * 总线参数 → 开格动作。entryId 与 paneId 都得是非空字符串；key 得是字符串；params 过
 * `plainParams` 那道门；preview 只认布尔；from 得是非空字符串；placement 只认 auto / side。
 * 认不出回 error，调用方原样回给总线——agent 手滑不该在井里留下任何动静。
 */
export function parseOpenPaneArgs(
  args: unknown,
): { ok: true; action: OpenPaneAction } | { ok: false; error: string } {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, error: '参数得是 { entryId, paneId, key?, params?, preview?, from?, placement? } 那样的对象' }
  }
  const a = args as OpenPaneActionLike
  if (typeof a.entryId !== 'string' || a.entryId === '') {
    return { ok: false, error: 'entryId 要是非空字符串（shell.panes 回的表里那条 entryId）' }
  }
  if (typeof a.paneId !== 'string' || a.paneId === '') {
    return { ok: false, error: 'paneId 要是非空字符串（件 registerPane 时报的窗格 id）' }
  }
  if (a.key !== undefined && typeof a.key !== 'string') {
    return { ok: false, error: 'key 是字符串（这一份装的内容），不给就别带' }
  }
  if (a.params !== undefined && !plainParams(a.params)) {
    return { ok: false, error: 'params 得是平对象且可 JSON 序列化（它跟着布局落盘）' }
  }
  if (a.preview !== undefined && typeof a.preview !== 'boolean') {
    return { ok: false, error: 'preview 是布尔（true = 放进预览槽）' }
  }
  if (a.from !== undefined && (typeof a.from !== 'string' || a.from === '')) {
    return { ok: false, error: 'from 是来源窗格的实例 id（件手上的 pane.instance），非空字符串，不给就别带' }
  }
  if (a.placement !== undefined && !isPlacement(a.placement)) {
    return { ok: false, error: "placement 只认 'auto'（缺省，按目标组规则）或 'side'（开到来源旁边）" }
  }
  return {
    ok: true,
    action: {
      t: OPEN_PANE_EVENT,
      entryId: a.entryId,
      paneId: a.paneId,
      ...(typeof a.key === 'string' ? { key: a.key } : {}),
      ...(plainParams(a.params) ? { params: a.params } : {}),
      ...(a.preview === true ? { preview: true } : {}),
      ...(typeof a.from === 'string' ? { from: a.from } : {}),
      ...(isPlacement(a.placement) ? { placement: a.placement } : {}),
    },
  }
}

/**
 * 事件载荷 → `openPane` 的那几样。不假设发事件的那半先验过形状——键各挑各的，
 * 挑不走的当没给。
 */
export function openPaneOptionsOf(action: OpenPaneActionLike): OpenPaneOptions {
  return {
    ...(typeof action.key === 'string' ? { key: action.key } : {}),
    ...(plainParams(action.params) ? { params: action.params } : {}),
    ...(action.preview === true ? { preview: true } : {}),
    ...(isPlacement(action.placement) ? { placement: action.placement } : {}),
  }
}

/** 事件载荷 → 来源窗格的实例 id。挑不走当没有来源 */
export function openPaneSourceOf(action: OpenPaneActionLike): string | undefined {
  return typeof action.from === 'string' && action.from !== '' ? action.from : undefined
}

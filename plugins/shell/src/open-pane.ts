import type { OpenPaneOptions, Placement } from './openable.js'
import { isPlainParams } from './panels.js'

/** node 侧经内核事件入口转给页面的开窗格动作事件上的标记 */
export const OPEN_PANE_EVENT = 'gwb-shell-open-pane'

/** 页面收到后走插件开自己窗格的同一条流程（`planOpen`）；回执 ok 只代表转发了 */
export interface OpenPaneAction {
  t: typeof OPEN_PANE_EVENT
  /** 注册表的键是 entryId 加 paneId，只给 paneId 会重名 */
  entryId: string
  paneId: string
  /** 语义同插件开自己窗格的 key */
  key?: string
  /** 随布局保存，必须可 JSON 序列化 */
  params?: Record<string, unknown>
  /** 放进目标组的预览窗格 */
  preview?: boolean
  /** 来源窗格的实例 id（插件手上的 `pane.instance`）；新窗格开在它旁边、它那张桌面上，页面上找不到就当没有来源 */
  from?: string
  /** 缺省 auto */
  placement?: Placement
}

/** 事件入口上什么插件的事件都有：认出标记之后再按这个形状收窄 */
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

export function isOpenPaneAction(payload: unknown): payload is OpenPaneActionLike {
  if (payload === null || typeof payload !== 'object') return false
  return (payload as OpenPaneActionLike).t === OPEN_PANE_EVENT
}

function isPlacement(value: unknown): value is Placement {
  return value === 'auto' || value === 'side'
}

/** 第一处不合格的参数的报错；全都合格回 undefined */
function firstOpenPaneArgsError(openArgs: OpenPaneActionLike): string | undefined {
  if (typeof openArgs.entryId !== 'string' || openArgs.entryId === '') {
    return 'entryId 要是非空字符串（shell.panes 回的表里那条 entryId）'
  }
  if (typeof openArgs.paneId !== 'string' || openArgs.paneId === '') {
    return 'paneId 要是非空字符串（件 registerPane 时报的窗格 id）'
  }
  if (openArgs.key !== undefined && typeof openArgs.key !== 'string') return 'key 是字符串（这一份装的内容），不给就别带'
  if (openArgs.params !== undefined && !isPlainParams(openArgs.params)) return 'params 得是平对象且可 JSON 序列化（它随布局保存）'
  if (openArgs.preview !== undefined && typeof openArgs.preview !== 'boolean') return 'preview 是布尔（true = 放进预览窗格）'
  if (openArgs.from !== undefined && (typeof openArgs.from !== 'string' || openArgs.from === '')) {
    return 'from 是来源窗格的实例 id（插件手上的 pane.instance），非空字符串，不给就别带'
  }
  if (openArgs.placement !== undefined && !isPlacement(openArgs.placement)) {
    return "placement 只认 'auto'（缺省，按目标组规则）或 'side'（开到来源旁边）"
  }
  return undefined
}

/** 命令参数 → 开窗格动作；认不出回 error，调用方原样回给命令总线 */
export function parseOpenPaneArgs(
  args: unknown,
): { ok: true; action: OpenPaneAction } | { ok: false; error: string } {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) {
    return { ok: false, error: '参数得是 { entryId, paneId, key?, params?, preview?, from?, placement? } 那样的对象' }
  }
  const openArgs = args as OpenPaneActionLike
  const error = firstOpenPaneArgsError(openArgs)
  if (error !== undefined) return { ok: false, error }
  return {
    ok: true,
    action: {
      t: OPEN_PANE_EVENT,
      entryId: openArgs.entryId as string,
      paneId: openArgs.paneId as string,
      ...(typeof openArgs.key === 'string' ? { key: openArgs.key } : {}),
      ...(isPlainParams(openArgs.params) ? { params: openArgs.params } : {}),
      ...(openArgs.preview === true ? { preview: true } : {}),
      ...(typeof openArgs.from === 'string' ? { from: openArgs.from } : {}),
      ...(isPlacement(openArgs.placement) ? { placement: openArgs.placement } : {}),
    },
  }
}

/** 不假设发事件的一方校验过形状：各键分别取，取不到当没给 */
export function openPaneOptionsOf(action: OpenPaneActionLike): OpenPaneOptions {
  return {
    ...(typeof action.key === 'string' ? { key: action.key } : {}),
    ...(isPlainParams(action.params) ? { params: action.params } : {}),
    ...(action.preview === true ? { preview: true } : {}),
    ...(isPlacement(action.placement) ? { placement: action.placement } : {}),
  }
}

/** 取不到当没有来源 */
export function openPaneSourceOf(action: OpenPaneActionLike): string | undefined {
  return typeof action.from === 'string' && action.from !== '' ? action.from : undefined
}

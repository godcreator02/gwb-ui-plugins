import type { DragEvent } from 'react'
import { getPanelData } from 'dockview-react'
import { wellHub } from './well-hub.js'

/**
 * 「桌面」面板上拖的是哪个窗格。两种来源，放下时都是「送到那张桌面」：
 *
 * - **面板里的窗格行**：dragstart 时记在这儿。HTML5 拖拽在 dragover 里只看得到数据的类型、读不到
 *   内容，而「这张桌面接不接」在 dragover 里就得答，所以不走 dataTransfer 传实例
 * - **桌面上的标签**：dockview 自己的拖拽，把 `{ viewId, groupId, panelId }` 放在页内的单例里
 *   （`getPanelData`；外壳的浏览器束里只有一份 dockview，单例就是同一个）。drop 发生在 dragend
 *   之前，放下那一刻还读得到。拖的是整组（组头，`panelId` 为 null）不算
 */

/** 面板里的窗格行被拖起时记下的那一份；拖完（放下或取消）清掉 */
let row: { instance: string; desktop: string } | undefined

/** 窗格行的 dragstart。数据里也放一份实例 id，拖出页面时对方至少看得到是什么 */
export function startRowDrag(e: DragEvent, instance: string, desktop: string): void {
  row = { instance, desktop }
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', instance)
}

export function endRowDrag(): void {
  row = undefined
}

/** 此刻拖着的窗格与它在哪张桌面。拖的不是窗格回 undefined；标签在哪张桌面问枢纽，页面上找不到就是 undefined */
export function draggedPane(): { instance: string; desktop: string | undefined } | undefined {
  if (row !== undefined) return row
  const tab = getPanelData()
  if (tab?.panelId == null) return undefined
  return { instance: tab.panelId, desktop: wellHub.locate(tab.panelId) }
}

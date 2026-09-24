import type { DragEvent } from 'react'
import { getPanelData } from 'dockview-react'
import { wellHub } from './well-hub.js'

/** 面板里的窗格行拖起时记在模块里：dragover 里读不到 dataTransfer 的内容，而接不接要在 dragover 里答；放下或取消时清掉 */
let row: { instance: string; desktop: string } | undefined

/** dataTransfer 里也放一份实例 id，拖出页面时对方至少看得到是什么 */
export function startRowDrag(e: DragEvent, instance: string, desktop: string): void {
  row = { instance, desktop }
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', instance)
}

export function endRowDrag(): void {
  row = undefined
}

/**
 * 拖的不是窗格回 undefined。桌面上的标签是 dockview 自己的拖拽，数据在页内单例 `getPanelData` 里
 * （drop 先于 dragend，放下时还读得到）；整组拖（`panelId` 为 null）不算
 */
export function draggedPane(): { instance: string; desktop: string | undefined } | undefined {
  if (row !== undefined) return row
  const tab = getPanelData()
  if (tab?.panelId == null) return undefined
  return { instance: tab.panelId, desktop: wellHub.locate(tab.panelId) }
}

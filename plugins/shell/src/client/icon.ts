import { Hash, icons, type LucideIcon } from 'lucide-react'
import { iconKey } from '../pane-icon.js'

/** lucide 全集，键是导出名（PascalCase）。整份打进本束——件登记什么正名都画得出 */
const ALL_ICONS: Readonly<Record<string, LucideIcon>> = icons

/**
 * 窗格图标：件注册窗格时给的 lucide 正名 → 那一枚。没给或认不出画 Hash，不该空一块；认不出的
 * 登记那一刻 node 半已经 warn 过。标签、启动器、切换器同吃这一处
 */
export function iconFor(name: string | undefined): LucideIcon {
  const key = name === undefined ? undefined : iconKey(name)
  return key !== undefined && Object.hasOwn(ALL_ICONS, key) ? ALL_ICONS[key]! : Hash
}

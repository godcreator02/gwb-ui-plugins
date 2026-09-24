import { Hash, icons, type LucideIcon } from 'lucide-react'
import { iconKey } from '../pane-icon.js'

/** lucide 全集，键是导出名（PascalCase），整份打包进来 */
const ALL_ICONS: Readonly<Record<string, LucideIcon>> = icons

/** 标签、启动器、「桌面」面板都用这一处；没给或认不出画 Hash（认不出的登记时 node 侧已 warn） */
export function iconFor(name: string | undefined): LucideIcon {
  const key = name === undefined ? undefined : iconKey(name)
  return key !== undefined && Object.hasOwn(ALL_ICONS, key) ? ALL_ICONS[key]! : Hash
}

/**
 * `settings.all` 按 section（条目 id 的末段）平铺，这里按形状收窄（设置插件 `registry.ts` 的 SettingView）、
 * 再按条目归组。settings 0.3.0 起列表对 secret 行不回 `value` 与 `default`，只回 `secret` / `isSet` / 设过才有的 `mask`；
 * 看明文走 `settings.get`
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const TYPES = ['string', 'number', 'boolean', 'secret', 'string-list'] as const
export type SettingType = (typeof TYPES)[number]

/** 与 node 侧的 `SettingView` 同形 */
export interface SettingRow {
  section: string
  key: string
  type: SettingType
  title?: string
  description?: string
  value?: unknown
  /** 声明方给的默认值，只有 live 的项才有，secret 行没有；没设过值时画成灰色占位 */
  default?: unknown
  /** 此刻还有插件声明着它；false 多半是插件停着或已经卸载，磁盘上的值还在 */
  live?: boolean
  /** 只有 secret 行带 */
  secret?: true
  /** secret 行设过值没有；判断设没设过只认它，别拿 `value` 在不在推 */
  isSet?: boolean
  /** secret 行已设置时的定长掩码，只表示这里有值，别从它推长度或值 */
  mask?: string
}

/** 草稿里临时放改名行新名字的键，不是一项设置 */
export const LABEL_SLOT = '__label__'

function settingTypeOf(rawType: unknown): SettingType {
  return (TYPES as readonly string[]).includes(rawType as string) ? (rawType as SettingType) : 'string'
}

/** `isSet` 只认布尔，`mask` 只认非空串（空掩码会被当成设了个空值） */
function withSecretMarks(row: SettingRow, item: Record<string, unknown>): void {
  if (item['secret'] === true) row.secret = true
  if (typeof item['isSet'] === 'boolean') row.isSet = item['isSet']
  const mask = item['mask']
  if (typeof mask === 'string' && mask !== '') row.mask = mask
}

function acceptSetting(item: unknown): SettingRow | undefined {
  if (!isRecord(item)) return undefined
  const section = item['section']
  const key = item['key']
  if (typeof section !== 'string' || section === '') return undefined
  if (typeof key !== 'string' || key === '') return undefined
  const type = settingTypeOf(item['type'])
  const row: SettingRow = { section, key, type }
  const title = item['title']
  const description = item['description']
  const live = item['live']
  if (typeof title === 'string' && title !== '') row.title = title
  if (typeof description === 'string' && description !== '') row.description = description
  if (item['value'] !== undefined) row.value = item['value']
  if (item['default'] !== undefined) row.default = item['default']
  if (live === false) row.live = false
  if (type === 'secret') withSecretMarks(row, item)
  return row
}

/** 认不出的丢掉、不报错：node 侧改了形状时宁可少显示几行，也不要整个窗格空白 */
export function acceptSettings(raw: unknown): SettingRow[] {
  if (!Array.isArray(raw)) return []
  const rows: SettingRow[] = []
  for (const item of raw as unknown[]) {
    const row = acceptSetting(item)
    if (row !== undefined) rows.push(row)
  }
  return rows
}

/** 布尔写开 / 关，数组逐行，其余 String() */
export function formatDefault(def: unknown): string {
  if (Array.isArray(def)) return def.filter((one): one is string => typeof one === 'string').join('\n')
  if (typeof def === 'boolean') return def ? '开' : '关'
  return String(def)
}

/** secret 行「已设置 / 没设过」只在这里判断，别散进 JSX；非 secret 行照旧按值画 */
export type FieldState = 'value' | 'secret-set' | 'secret-unset'

export function fieldState(row: Pick<SettingRow, 'type' | 'isSet'>): FieldState {
  if (row.type !== 'secret') return 'value'
  return row.isSet === true ? 'secret-set' : 'secret-unset'
}

/** 设过了显示定长掩码（按真实长度打码等于泄露长度），没设过直说，不留空框 */
export function secretPlaceholder(row: Pick<SettingRow, 'isSet' | 'mask'>): string {
  if (row.isSet !== true) return '未设置'
  const mask = typeof row.mask === 'string' && row.mask !== '' ? row.mask : '••••'
  return `已设置（${mask}，不在此显示）`
}

/**
 * 按键在不在草稿里判断编辑过，不按值：secret 行没有值，「没动过」与「改成空」都是 undefined。
 * 保存只提交这些，没动过的 secret 不会被当成清空写回
 */
export function dirtySlots(draft: Record<string, unknown> | undefined): Array<[string, unknown]> {
  return Object.entries(draft ?? {}).filter(([slot]) => slot !== LABEL_SLOT)
}

/** `home:hello` → `hello`，即设置的 section */
export function bareId(entryId: string): string {
  const parts = entryId.split(':')
  return parts[parts.length - 1] ?? entryId
}

/** `settings.set` / `settings.delete` 按它定位；两段各自 encodeURIComponent，section 里有 `/` 也拆得回来 */
export function slotKey(setting: Pick<SettingRow, 'section' | 'key'>): string {
  return `${encodeURIComponent(setting.section)}/${encodeURIComponent(setting.key)}`
}

export function parseSlotKey(slot: string): { section: string; key: string } {
  const [section, key] = slot.split('/').map((part) => decodeURIComponent(part))
  return { section: section ?? '', key: key ?? '' }
}

export function settingsForEntry(all: readonly SettingRow[], entryId: string): SettingRow[] {
  const entrySection = bareId(entryId)
  return all.filter((setting) => setting.section === entrySection)
}

/** section 对不上界面上任何条目的：多半是条目删了值没清，或者插件停着还没声明 */
export function orphanSettings(all: readonly SettingRow[], entries: readonly string[]): SettingRow[] {
  const entrySections = new Set(entries.map(bareId))
  return all.filter((setting) => !entrySections.has(setting.section))
}

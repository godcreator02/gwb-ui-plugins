/**
 * `settings.all` 与 `credentials.list` 按 section（条目 id 的末段；公共区是 `*`）平铺，这里合并、按形状收窄、再按条目归组。
 * secret 行没有 `value` 与 `default`，只有 `secret` / `isSet` / 设过才有的 `mask`；本地看明文走 `credentials.reveal`
 */

import { asResult } from './rows'

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

/** 认不出的 type 回 undefined，那一行整行丢掉：当成 string 画出来，保存时会把别的类型写成字符串 */
function settingTypeOf(rawType: unknown): SettingType | undefined {
  return (TYPES as readonly unknown[]).includes(rawType) ? (rawType as SettingType) : undefined
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
  if (type === undefined) return undefined
  const row: SettingRow = { section, key, type }
  const title = item['title']
  const description = item['description']
  const live = item['live']
  if (typeof title === 'string' && title !== '') row.title = title
  if (typeof description === 'string' && description !== '') row.description = description
  if (type !== 'secret' && item['value'] !== undefined) row.value = item['value']
  if (type !== 'secret' && item['default'] !== undefined) row.default = item['default']
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

/** 两类列表都取到才显示完整配置；缺一路时说明命令与原因，不把未取到的凭据当成没配置。 */
export async function loadSettings(call: (command: string) => Promise<unknown>): Promise<SettingRow[]> {
  const commands = ['settings.all', 'credentials.list'] as const
  const results = await Promise.allSettled(commands.map((command) => call(command)))
  const rows: SettingRow[] = []
  const failures: string[] = []
  for (const [index, settled] of results.entries()) {
    const command = commands[index]!
    if (settled.status === 'rejected') {
      failures.push(`${command}：${String(settled.reason)}`)
      continue
    }
    const result = asResult(settled.value)
    if (!result.ok) failures.push(`${command}：${result.error}`)
    else rows.push(...acceptSettings(result.data).filter((row) => (row.type === 'secret') === (command === 'credentials.list')))
  }
  if (failures.length > 0) throw new Error(failures.join('\n'))
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
  return `已设置（${row.mask ?? '••••'}，不在此显示）`
}

/**
 * 按键在不在草稿里判断编辑过，不按值：secret 行没有值，「没动过」与「改成空」都是 undefined。
 * 保存只提交这些，没动过的 secret 不会被当成清空写回
 */
export function dirtySlots(draft: Record<string, unknown> | undefined): Array<[string, unknown]> {
  return Object.entries(draft ?? {})
}

/** `home:hello` → `hello`，即设置的 section */
export function bareId(entryId: string): string {
  const parts = entryId.split(':')
  return parts[parts.length - 1]!
}

/** 设置与凭据命令按它定位；两段各自 encodeURIComponent，section 里有 `/` 也拆得回来 */
export function slotKey(setting: Pick<SettingRow, 'section' | 'key'>): string {
  return `${encodeURIComponent(setting.section)}/${encodeURIComponent(setting.key)}`
}

/** 只收 `slotKey` 拼出来的串；切不成两段就抛错，不拿空串去调设置或凭据命令 */
export function parseSlotKey(slot: string): { section: string; key: string } {
  const parts = slot.split('/')
  if (parts.length !== 2) throw new Error(`设置槽 ${JSON.stringify(slot)} 不是 slotKey 拼出来的「section/key」`)
  const [section, key] = parts.map((part) => decodeURIComponent(part)) as [string, string]
  return { section, key }
}

export function settingsForEntry(all: readonly SettingRow[], entryId: string): SettingRow[] {
  const entrySection = bareId(entryId)
  return all.filter((setting) => setting.section === entrySection)
}

/** 凭据空着保存就是清除；普通空字符串仍是设置值，数值控件清空时传 undefined。 */
export function settingWriteRequest(row: Pick<SettingRow, 'section' | 'key' | 'type'>, value: unknown): {
  command: string
  args: { section: string; key: string; value?: unknown }
} {
  const { section, key, type } = row
  const prefix = type === 'secret' ? 'credentials' : 'settings'
  if (value === undefined || (type === 'secret' && value === '')) return { command: `${prefix}.delete`, args: { section, key } }
  return { command: `${prefix}.set`, args: { section, key, value } }
}

export interface SettingsDeletion {
  deleted: number
  /** 每项一行「section.key：原因」；没删掉的值留在「没有插件声明的设置」里还找得到 */
  failures: string[]
}

/** 按类型逐项清除设置或凭据，一项失败不停下。回执失败与调用抛错都记进失败项。 */
export async function deleteSettingValues(
  call: (command: string, args: { section: string; key: string }) => Promise<unknown>,
  settings: ReadonlyArray<Pick<SettingRow, 'section' | 'key' | 'type'>>,
): Promise<SettingsDeletion> {
  const outcome: SettingsDeletion = { deleted: 0, failures: [] }
  for (const { section, key, type } of settings) {
    try {
      const command = type === 'secret' ? 'credentials.delete' : 'settings.delete'
      const result = asResult(await call(command, { section, key }))
      if (result.ok) outcome.deleted += 1
      else outcome.failures.push(`${section}.${key}：${result.error ?? ''}`)
    } catch (err: unknown) {
      outcome.failures.push(`${section}.${key}：${String(err)}`)
    }
  }
  return outcome
}

/** 删除结果拼在回执那句话后面：删了几项、哪几项没删掉 */
export function describeSettingsDeletion(outcome: SettingsDeletion): string {
  const parts: string[] = []
  if (outcome.deleted > 0) parts.push(`，删除了 ${outcome.deleted} 项设置值`)
  if (outcome.failures.length > 0) {
    parts.push(`\n${outcome.failures.length} 项设置值没删掉（留在「没有插件声明的设置」里）：\n${outcome.failures.join('\n')}`)
  }
  return parts.join('')
}

/**
 * 此刻没有插件声明（`live: false`）、又对不上界面上任何条目的：多半是条目删了值没清，或者插件停着。
 * 是否有人声明只看回执的 `live`，不按 section 推：公共区 `*` 对不上任何条目，里面的项却可能正被声明着。
 * 对得上条目的未声明项画在那个条目下（带「未声明」标记），不在这里重复
 */
export function orphanSettings(all: readonly SettingRow[], entries: readonly string[]): SettingRow[] {
  const entrySections = new Set(entries.map(bareId))
  return all.filter((setting) => setting.live === false && !entrySections.has(setting.section))
}

/** 设置插件公共区的分区名（与设置插件 `paths.ts` 的 `SHARED_SECTION` 一致）：声明 `shared` 的项写在这里，不属于任何条目 */
export const SHARED_SECTION = '*'

/** 公共区里此刻有插件声明着的项。按条目分区找不到它们；没人声明的归 `orphanSettings` */
export function sharedSettings(all: readonly SettingRow[]): SettingRow[] {
  return all.filter((setting) => setting.section === SHARED_SECTION && setting.live !== false)
}

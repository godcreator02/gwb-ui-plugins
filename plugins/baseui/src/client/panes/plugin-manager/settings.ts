/**
 * `settings.all` 回的那份 → 跟条目 join 成「这一格的设置」。纯逻辑，不碰 DOM。
 *
 * `settings.all` 交出来的是按 `section`（条目裸 id）平铺的一张表，那串东西不是给人读
 * 的；join 到条目上，人才能「先想到哪个件，再看到它的设置」。正本的形状在 settings 件
 * 的 `src/registry.ts`（SettingView），这儿按形状收。
 *
 * **枚举口自 settings 0.3.0 起对 secret 行收口**：那一行没有 `value`、也没有
 * `default`（默认值也可能是凭据），只回 `secret` / `isSet` / 设过才有的 `mask`。「设过没有」
 * 因此只认 `isSet`——拿 `value === undefined` 推会把它永远念成「没设过」。非 secret 行
 * 一个字节没变。要看 secret 的明文走**按位取用**口 `settings.get`，那条照旧回明文。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const TYPES = ['string', 'number', 'boolean', 'secret', 'string-list'] as const
export type SettingType = (typeof TYPES)[number]

/** 一项设置过桥之后的样子。跟 node 半的 `SettingView` 是同一个形状 */
export interface SettingRow {
  section: string
  key: string
  type: SettingType
  title?: string
  description?: string
  value?: unknown
  /** 声明方递的默认值——只有 live 的项才有，**secret 行没有**。没设过值时生效的就是它，画成灰占位 */
  default?: unknown
  /** 此刻还有件声明着它。false 的多半是件停着或已经卸了，盘上的值还在 */
  live?: boolean
  /** secret 行才带的记号。**「设过没有」只认 `isSet`**，别拿 `value` 在不在推 */
  secret?: true
  /** secret 行设过值没有 */
  isSet?: boolean
  /** secret 行已设置时的定长掩码。**掩码只是「这儿本该有个值」的记号**，别从它推长度或值 */
  mask?: string
}

/** 草稿里那个借道的槽：改名行把新名字暂时塞这儿，不是一项设置 */
export const LABEL_SLOT = '__label__'

/** 认不出的丢掉、不崩——node 半改了形状时宁可少显示几行，不要整格白屏 */
export function acceptSettings(raw: unknown): SettingRow[] {
  if (!Array.isArray(raw)) return []
  const out: SettingRow[] = []
  for (const item of raw as unknown[]) {
    if (!isRecord(item)) continue
    const section = item['section']
    const key = item['key']
    if (typeof section !== 'string' || section === '') continue
    if (typeof key !== 'string' || key === '') continue
    const rawType = item['type']
    const type: SettingType = (TYPES as readonly string[]).includes(rawType as string)
      ? (rawType as SettingType)
      : 'string'
    const row: SettingRow = { section, key, type }
    const title = item['title']
    const description = item['description']
    const live = item['live']
    if (typeof title === 'string' && title !== '') row.title = title
    if (typeof description === 'string' && description !== '') row.description = description
    if (item['value'] !== undefined) row.value = item['value']
    if (item['default'] !== undefined) row.default = item['default']
    if (live === false) row.live = false
    // secret 那三格只在报出来时才收：`isSet` 认布尔，`mask` 认非空串——空掩码会被念成
    // 「设了个空值」。画成哪一态认的是 `type`，这三格只是随回执带过来的记号
    if (type === 'secret') {
      if (item['secret'] === true) row.secret = true
      if (typeof item['isSet'] === 'boolean') row.isSet = item['isSet']
      const mask = item['mask']
      if (typeof mask === 'string' && mask !== '') row.mask = mask
    }
    out.push(row)
  }
  return out
}

/** 默认值画进占位符前的人话化：布尔说开/关，数组逐行，其余 String() */
export function formatDefault(def: unknown): string {
  if (Array.isArray(def)) return def.filter((one): one is string => typeof one === 'string').join('\n')
  if (typeof def === 'boolean') return def ? '开' : '关'
  return String(def)
}

/**
 * 一格设置此刻画成哪一态。**secret 的「已设置 / 没设过」判定只此一处**，别散进 JSX。
 *
 * 枚举口（`settings.all`）对 secret 行不回值，`value` 那一格在它这儿永远不在——「设过了」
 * 与「空着」只能靠 `isSet` 分。非 secret 行照旧按值画，这条判定不碰它们。
 */
export type FieldState = 'value' | 'secret-set' | 'secret-unset'

export function fieldState(row: Pick<SettingRow, 'type' | 'isSet'>): FieldState {
  if (row.type !== 'secret') return 'value'
  return row.isSet === true ? 'secret-set' : 'secret-unset'
}

/**
 * secret 那格没揭明文时框里的占位符。设过了摆枚举口给的掩码（**定长**，照真实长度打码
 * 等于把长度也交出去），没设过就直说——空框会被念成「没设过」，而设过的那一格不该长得
 * 跟它一样。
 */
export function secretPlaceholder(row: Pick<SettingRow, 'isSet' | 'mask'>): string {
  if (row.isSet !== true) return '未设置'
  const mask = typeof row.mask === 'string' && row.mask !== '' ? row.mask : '••••'
  return `已设置（${mask}，不在此显示）`
}

/**
 * 草稿里**真被编辑过**的格：按「键在不在」判，**不按值**。
 *
 * 枚举口对 secret 行不回值之后，「没动过这一格」与「把这一格改成空」在值上长得一模一样
 * （都是 undefined），只有「这个 slot 在不在草稿里」分得开。保存只提交这一份清单——
 * 没动过的 secret 格因此不会被当成「清空」写回盘上。
 */
export function dirtySlots(draft: Record<string, unknown> | undefined): Array<[string, unknown]> {
  return Object.entries(draft ?? {}).filter(([slot]) => slot !== LABEL_SLOT)
}

/** `home:hello` → `hello`。设置的 section 就是这个末段 */
export function bareId(entryId: string): string {
  const parts = entryId.split(':')
  return parts[parts.length - 1] ?? entryId
}

/**
 * 一项设置在盘上的唯一位置。`settings.set` / `settings.delete` 都按这两样定位。
 *
 * **每段 encodeURIComponent 再拼**：section 万一将来放进带 `/` 的东西也不会把定位串
 * 拆乱——拆开再 decode 一段不差。
 */
export function slotKey(s: Pick<SettingRow, 'section' | 'key'>): string {
  return `${encodeURIComponent(s.section)}/${encodeURIComponent(s.key)}`
}

export function parseSlotKey(slot: string): { section: string; key: string } {
  const [section, key] = slot.split('/').map((part) => decodeURIComponent(part))
  return { section: section ?? '', key: key ?? '' }
}

/** 条目自己那几张设置：section 就是条目 id 的末段 */
export function settingsForEntry(all: readonly SettingRow[], entryId: string): SettingRow[] {
  const bare = bareId(entryId)
  return all.filter((s) => s.section === bare)
}

/**
 * 谁也认不走的那些：section 对不上画面上任何条目。盘上有值、此刻却没主——多半是条目
 * 删了值没擦，或者件停着还没声明。
 */
export function orphanSettings(all: readonly SettingRow[], entries: readonly string[]): SettingRow[] {
  const bareIds = new Set(entries.map(bareId))
  return all.filter((s) => !bareIds.has(s.section))
}

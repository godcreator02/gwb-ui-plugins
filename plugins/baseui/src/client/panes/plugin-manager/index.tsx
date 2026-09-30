import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { PaneArgs, PaneHandle } from '@godcreator/gwb-shell/pane'
import {
  BookOpen,
  ChevronRight,
  Database,
  Ellipsis,
  Eye,
  EyeOff,
  FileCode,
  FlaskConical,
  Hash,
  LayoutDashboard,
  PackageX,
  PanelLeft,
  Plug,
  Puzzle,
  RotateCw,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  Sparkles,
  Store,
  Terminal,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { cn } from 'cn'
import type { OutdatedMap, UpdateInfo } from '@godcreator/gwb-plugin-manager/receipts'
import type { Acknowledged } from '@godcreator/gwb-plugin-manager/receipts'
import { callPluginManager } from './receipts'
import {
  asResult,
  summarize,
  toRows,
  unmetPeerMark,
  type CallResult,
  type EntryRow,
  type PackageRow,
  type UnmetPeerMark,
} from './rows'
import {
  acceptSettings,
  deleteSettingValues,
  describeSettingsDeletion,
  dirtySlots,
  fieldState,
  formatDefault,
  orphanSettings,
  parseSlotKey,
  secretPlaceholder,
  settingsForEntry,
  SHARED_SECTION,
  sharedSettings,
  slotKey,
  type SettingRow,
  type SettingsDeletion,
} from './settings'
import { MarketTab } from './market'
import { installedIndex, type InstalledIndex } from './market-rows'
import { describeUpdateReceipt, waitForOwnRemount, type UpdateView } from './update-receipt'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * 插件管理窗格：「已安装」每条条目一行、展开是那个插件的设置（人先想到的是哪个插件，不是哪个分区）；「可安装」见 `market.tsx`。
 * 三份数据各取各的、各自失败：`plugin-manager.list`（包与条目）、`settings.all`（按 section 对应到条目，secret 行不回值，
 * 看明文用 `settings.get`）、`shell.plugins`（显示名与图标）。升级走 `plugin-manager.update`（`{ all: true }` 或 `{ only: [包名] }`），
 * 有包升级了由窗格自己调 `shell.reload` 整页重新加载。没有事件推送，每次操作完重新取数据
 */

const PANE_ID = 'plugin-manager'

const LIST = 'plugin-manager.list'
const INSTALL = 'plugin-manager.install'
const ADD_ENTRY = 'plugin-manager.add-entry'
const ENABLE = 'plugin-manager.enable'
const DISABLE = 'plugin-manager.disable'
const REMOVE_ENTRY = 'plugin-manager.remove-entry'
const SETTINGS_ALL = 'settings.all'
/** 按位置读一项设置，secret 项照样回明文（只有列表命令 `settings.all` 不回），「看一眼」按钮用它 */
const SETTINGS_GET = 'settings.get'
const SETTINGS_SET = 'settings.set'
const SETTINGS_DELETE = 'settings.delete'
const SHELL_PLUGINS = 'shell.plugins'
const SHELL_RELOAD = 'shell.reload'
const OUTDATED = 'plugin-manager.outdated'
const UPDATE = 'plugin-manager.update'
const UNINSTALL = 'plugin-manager.uninstall'

/** 插件管理的包名。升级它时要等它自己的条目重新加载完再整页重新加载；卸载它时这个窗格会关闭，确认框与回执要说明 */
const OWN_PKG = '@godcreator/gwb-plugin-manager'

/** 没勾「连设置值一起删」时的删除结果 */
const NOTHING_DELETED: SettingsDeletion = { deleted: 0, failures: [] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 写成映射表、不按名字动态取：动态取要把整个 lucide 打包进来。认不出的用 Puzzle */
const ICONS: Record<string, typeof Puzzle> = {
  'scroll-text': ScrollText,
  store: Store,
  puzzle: Puzzle,
  'flask-conical': FlaskConical,
  hash: Hash,
  'panel-left': PanelLeft,
  'layout-dashboard': LayoutDashboard,
  terminal: Terminal,
  settings: SettingsIcon,
  plug: Plug,
  'book-open': BookOpen,
  database: Database,
  sparkles: Sparkles,
  'file-code': FileCode,
}

/** 插件自己报的显示名与图标（shell.plugins 的形状，按形状校验后接收） */
interface Face {
  title?: string
  icon?: string
}

function acceptFaces(raw: unknown): Record<string, Face> {
  if (!Array.isArray(raw)) return {}
  const out: Record<string, Face> = {}
  for (const item of raw as unknown[]) {
    if (!isRecord(item)) continue
    const entryId = item['entryId']
    if (typeof entryId !== 'string' || entryId === '') continue
    const face: Face = {}
    const title = item['title']
    const icon = item['icon']
    if (typeof title === 'string' && title !== '') face.title = title
    if (typeof icon === 'string' && icon !== '') face.icon = icon
    out[entryId] = face
  }
  return out
}

/** 条目的四态 → 徽标颜色。文案与提示的正本在 rows.ts 的 FACES */
const STATE_BADGE: Record<EntryRow['state'], 'secondary' | 'outline' | 'destructive'> = {
  active: 'secondary',
  stalled: 'destructive',
  disabled: 'outline',
  'disabled-running': 'destructive',
}

type Filter = 'all' | 'on' | 'off' | 'bad'

const FILTER_LABEL: Record<Filter, string> = { all: '全部', on: '启用', off: '停用', bad: '异常' }

/** 「查看明文」读回的明文只留在组件里、不进草稿，否则保存时会把没编辑过的 secret 项当新值提交 */
type Peek =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'shown'; text: string }
  | { kind: 'failed'; reason: string }

/**
 * 按 `type` 挑控件；没设过值的项把默认值显示成灰色占位符。secret 项的框平常是空的（列表命令不回值），
 * 状态看 `isSet`，「看一眼」读不到时如实显示原因，不显示空框
 */
function SettingField({
  row,
  value,
  onChange,
  onReveal,
}: {
  row: SettingRow
  value: unknown
  onChange: (next: unknown) => void
  /** 按位置读这一项的明文（`settings.get`）。读不到就抛，由这一项如实显示原因 */
  onReveal: (row: SettingRow) => Promise<string>
}): ReactElement {
  const [peek, setPeek] = useState<Peek>({ kind: 'idle' })
  /** secret 项不显示默认值——默认值不该以明文出现在占位符里 */
  const fallback = row.type !== 'secret' && row.default !== undefined ? formatDefault(row.default) : undefined

  if (row.type === 'boolean') {
    return (
      <div className="baseui:flex baseui:items-center baseui:gap-2">
        <Switch checked={value === true} onCheckedChange={onChange} />
        {value === undefined && typeof row.default === 'boolean' && (
          <span className="baseui:text-xs baseui:text-muted-foreground" title="没设过值，此刻生效的是声明方的默认">
            默认{row.default ? '开' : '关'}
          </span>
        )}
      </div>
    )
  }
  if (row.type === 'number') {
    return (
      <Input
        type="number"
        className="baseui:h-8 baseui:w-32 baseui:text-right baseui:tabular-nums"
        placeholder={fallback}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
      />
    )
  }
  if (row.type === 'secret') {
    const state = fieldState(row)
    // 按这个次序显示：草稿（人正在改）→ 按位置读回来的明文 → 空框。列表命令不返回值，所以
    // 平常显示空框，靠占位符说「设过了 / 没设过」
    const edited = typeof value === 'string'
    const shown = edited ? value : peek.kind === 'shown' ? peek.text : ''
    const revealed = !edited && peek.kind === 'shown'
    /** 有草稿时不能再显示「已设置」：人刚清空这一项，显示回去会被读成没改 */
    const hint = revealed
      ? '（磁盘上的值是空字符串）'
      : edited
        ? '（空着保存就是清空这一项）'
        : secretPlaceholder(row)
    const why = revealed
      ? '这是按位置读回来的明文（settings.get）。改了再点「保存」才会写回磁盘'
      : edited
        ? '改了还没保存。点「保存」才写回磁盘'
        : state === 'secret-set'
          ? '已设置。列表命令 settings.all 不返回 secret 的值（只返回设过没有与遮掉的值），所以这个框平常是空的——点右边的眼睛按位置读明文'
          : '没设过。填上再点「保存」就设上了'
    const look = (): void => {
      if (peek.kind === 'shown') {
        setPeek({ kind: 'idle' })
        return
      }
      setPeek({ kind: 'loading' })
      void onReveal(row).then(
        (text) => setPeek({ kind: 'shown', text }),
        // 读不到就说为什么。**不显示成空**——空框会被读成「没设过」，而这两件事差得远
        (err: unknown) => setPeek({ kind: 'failed', reason: err instanceof Error ? err.message : String(err) }),
      )
    }
    return (
      <div className="baseui:flex baseui:flex-col baseui:items-end baseui:gap-0.5">
        <div className="baseui:flex baseui:items-center baseui:gap-1">
          <Input
            type={revealed ? 'text' : 'password'}
            className="baseui:h-8 baseui:w-56 baseui:font-mono"
            placeholder={shown === '' ? hint : undefined}
            title={why}
            value={shown}
            onChange={(e) => {
              // 一改就是编辑：读回来的明文不再显示，之后显示草稿（列表命令不返回值，回不到原样）
              setPeek({ kind: 'idle' })
              onChange(e.target.value)
            }}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={peek.kind === 'loading' || edited}
            title={
              revealed
                ? '遮起来（读回来的明文只在这个框里，不写回磁盘）'
                : edited
                  ? '这一项改了还没保存——先「保存」或「放弃」，再看磁盘上那份明文'
                  : peek.kind === 'loading'
                    ? '读取中…'
                    : '查看明文：调 settings.get 按位置读一次明文。注意：secret 只影响这里的显示，磁盘上照样是明文；列表命令 settings.all 不返回它的值，所以这个框平常是空的'
            }
            onClick={look}
          >
            {revealed ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {peek.kind === 'failed' && (
          <span
            className="baseui:max-w-56 baseui:text-[10px] baseui:break-all baseui:text-destructive"
            title={peek.reason}
          >
            无法查看：{peek.reason}
          </span>
        )}
      </div>
    )
  }
  return (
    <Input
      className="baseui:h-8 baseui:w-56"
      placeholder={fallback ?? '（空）'}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/** string-list 的值 ↔ textarea 的行。legacy 的分号串原样显示，人能看到没丢 */
function listText(value: unknown): string {
  if (Array.isArray(value)) return value.filter((one): one is string => typeof one === 'string').join('\n')
  if (typeof value === 'string') return value
  return ''
}

/** 一项设置的一行：`string-list` 整行宽（textarea 逐行编辑），其余左边说明右边控件 */
function SettingLine({
  row,
  value,
  onChange,
  onReveal,
}: {
  row: SettingRow
  value: unknown
  onChange: (next: unknown) => void
  onReveal: (row: SettingRow) => Promise<string>
}): ReactElement {
  const label = (
    <div className="baseui:min-w-0 baseui:flex-1">
      <div className="baseui:flex baseui:items-center baseui:gap-2">
        <span className="baseui:text-sm">{row.title ?? row.key}</span>
        <code className="baseui:rounded baseui:bg-muted baseui:px-1 baseui:py-0.5 baseui:font-mono baseui:text-[10px] baseui:text-muted-foreground">{row.key}</code>
        {row.live === false && (
          <Badge variant="outline" className="baseui:px-1 baseui:py-0 baseui:text-[10px]" title="此刻没有插件声明它——插件停用了或者已经卸载">
            未声明
          </Badge>
        )}
        {row.type === 'secret' && (
          <Badge
            variant="outline"
            className="baseui:px-1 baseui:py-0 baseui:text-[10px] baseui:text-warning"
            title="secret 只影响显示时遮掉，磁盘上存的是明文；列表命令 settings.all 不返回它的值，要看明文点右边的眼睛按位置读"
          >
            明文存储
          </Badge>
        )}
      </div>
      {row.description !== undefined && <p className="baseui:mt-0.5 baseui:text-xs baseui:text-muted-foreground">{row.description}</p>}
    </div>
  )

  if (row.type === 'string-list') {
    return (
      <div className="baseui:px-3 baseui:py-2">
        {label}
        <Textarea
          spellCheck={false}
          className="baseui:mt-1 baseui:h-28 baseui:resize-y baseui:font-mono"
          placeholder={row.default !== undefined ? formatDefault(row.default) : '一行一项'}
          value={listText(value)}
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
      </div>
    )
  }

  return (
    <div className="baseui:flex baseui:items-start baseui:justify-between baseui:gap-4 baseui:px-3 baseui:py-2">
      {label}
      <div className="baseui:shrink-0 baseui:pt-0.5">
        <SettingField row={row} value={value} onChange={onChange} onReveal={onReveal} />
      </div>
    </div>
  )
}

/** 一条条目的卡片：头部一行，展开后是设置项列表与「保存 / 放弃」栏。数据与动作都由上层传入 */
function EntryCard({
  card,
  portal,
  face,
  open,
  onToggleOpen,
  busy,
  draft,
  saveError,
  saving,
  settingsError,
  onValue,
  onReveal,
  onSave,
  onDiscard,
  onToggleEnabled,
  onAskRemove,
  onAskUninstall,
  update,
  onUpdate,
}: {
  card: {
    entry: EntryRow
    pkg: string
    spec?: string
    settings: SettingRow[]
    peerMark?: UnmetPeerMark
  }
  /** 弹出层的容器元素：行尾「更多」下拉菜单放在它下面，切走桌面时跟着隐藏 */
  portal: HTMLElement
  face: Face | undefined
  open: boolean
  onToggleOpen: () => void
  busy: boolean
  draft: Record<string, unknown> | undefined
  saveError: string | undefined
  saving: boolean
  /** `settings.all` 没取到的原因，空串是取到了。取不到时 `card.settings` 是空的，不能说成没声明 */
  settingsError: string
  onValue: (slot: string, next: unknown) => void
  /** 按位置读一项的明文（`settings.get`），供 secret 项的「看一眼」用 */
  onReveal: (row: SettingRow) => Promise<string>
  onSave: () => void
  onDiscard: () => void
  onToggleEnabled: (next: boolean) => void
  onAskRemove: () => void
  /** 卸载是**包级**动作：从这条条目进入，删除的是这个包的全部条目和包本身 */
  onAskUninstall: () => void
  /** 这个包有新版本。undefined = 没查到它的新版本（没查、查失败、或者已是最新） */
  update?: UpdateInfo
  /** 给了才显示「更新」按钮 */
  onUpdate?: () => void
}): ReactElement {
  const entry = card.entry
  const Icon = ICONS[face?.icon ?? ''] ?? Puzzle
  const badge = STATE_BADGE[entry.state]
  const dirtyCount = dirtySlots(draft).length
  const title = face?.title ?? entry.id

  return (
    <Collapsible open={open} onOpenChange={onToggleOpen} className="baseui:border-b baseui:border-border baseui:last:border-b-0">
      <div className={cn('baseui:flex baseui:items-center baseui:gap-3 baseui:px-3 baseui:py-2.5 baseui:hover:bg-accent/40', entry.disabled && 'baseui:opacity-60')}>
        {/* 点击展开的区域只包住左半边——右半边有开关和菜单，点它们不该顺带展开 */}
        <CollapsibleTrigger className="baseui:flex baseui:min-w-0 baseui:flex-1 baseui:items-center baseui:gap-3 baseui:text-left baseui:outline-none">
          <ChevronRight className={cn('baseui:size-4 baseui:shrink-0 baseui:text-muted-foreground baseui:transition-transform', open && 'baseui:rotate-90')} />
          <Icon className="baseui:size-4 baseui:shrink-0 baseui:text-muted-foreground" />
          {/*
            两行的分工：第一行**只放认出插件用得到的几样**（名字、未保存、状态、版本提醒），第二行放
            身份（不带前缀的 id）与包名。id 是身份，日志和 yml 里出现的是它，显示名是插件自己报的 title
          */}
          <div className="baseui:min-w-0 baseui:flex-1">
            <div className="baseui:flex baseui:items-center baseui:gap-2">
              <span className="baseui:truncate baseui:text-sm baseui:font-medium">{title}</span>
              {dirtyCount > 0 && (
                <Badge className="baseui:shrink-0 baseui:border-0 baseui:bg-warning/15 baseui:px-1.5 baseui:py-0 baseui:text-[10px] baseui:text-warning">
                  未保存
                </Badge>
              )}
              <Badge variant={badge} className="baseui:shrink-0 baseui:px-1.5 baseui:py-0 baseui:text-[10px]">
                {entry.text}
              </Badge>
              {update !== undefined && (
                <Badge
                  variant="outline"
                  className="baseui:shrink-0 baseui:border-warning/40 baseui:px-1.5 baseui:py-0 baseui:text-[10px] baseui:text-warning"
                  title={`home 里是 ${update.current}，registry 上最新是 ${update.latest}`}
                >
                  有新版 {update.current} → {update.latest}
                </Badge>
              )}
              <UnmetPeerBadge mark={card.peerMark} />
            </div>
            <div className="baseui:flex baseui:items-baseline baseui:gap-2">
              <span className="baseui:min-w-0 baseui:truncate baseui:font-mono baseui:text-xs baseui:text-muted-foreground" title={entry.entryId}>
                {entry.id}
              </span>
              <span className="baseui:shrink-0 baseui:font-mono baseui:text-xs baseui:text-muted-foreground">
                {card.pkg}
                {card.spec !== undefined ? `@${card.spec}` : ''}
              </span>
              {card.settings.length > 0 && (
                <span className="baseui:shrink-0 baseui:text-xs baseui:text-muted-foreground">· {card.settings.length} 项设置</span>
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <div className="baseui:flex baseui:shrink-0 baseui:items-center baseui:gap-1">
          {onUpdate !== undefined && update !== undefined && (
            <Button
              size="xs"
              variant="outline"
              disabled={busy}
              title={`热升级这一个包（plugin-manager.update 只升 ${card.pkg}）：升到 ${update.latest}，逐条重新加载它的条目，不重启，最后整页重新加载界面`}
              onClick={onUpdate}
            >
              更新
            </Button>
          )}
          {/* 看的是 disabled 不是 active：没加载起来的条目照样可以「停用」 */}
          <Switch
            checked={!entry.disabled}
            disabled={busy}
            title={!entry.disabled ? '停用（往 cordis.yml 写 disabled: true，立即卸载）' : '启用（删掉 disabled，立即加载）'}
            onCheckedChange={onToggleEnabled}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" title="更多">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" container={portal}>
              <DropdownMenuItem variant="destructive" onSelect={onAskRemove}>
                <Trash2 /> 删除条目…
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onAskUninstall}>
                <PackageX /> 卸载这个包…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <CollapsibleContent>
        <div className="baseui:border-t baseui:border-border baseui:bg-muted/30">
          {/* 先说明没加载起来的原因——attention 的两种状态（没加载起来、停用了还在运行）都是最该被看见的 */}
          {entry.attention && (
            <div className="baseui:flex baseui:items-start baseui:gap-2 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2 baseui:text-xs baseui:text-warning">
              <TriangleAlert className="baseui:mt-0.5 baseui:size-3.5 baseui:shrink-0" />
              <span>{entry.hint}</span>
            </div>
          )}
          {settingsError !== '' ? (
            <p className="baseui:px-3 baseui:py-3 baseui:text-xs baseui:whitespace-pre-wrap baseui:break-all baseui:text-destructive">
              设置取不到：{settingsError}
            </p>
          ) : card.settings.length === 0 ? (
            <p className="baseui:px-3 baseui:py-3 baseui:text-xs baseui:text-muted-foreground">
              这个插件没声明设置项。
              {entry.state !== 'active' && '（插件加载起来才会声明——没加载时这里多半是空的）'}
            </p>
          ) : (
            <div className="baseui:divide-y baseui:divide-border">
              {card.settings.map((s) => {
                const slot = slotKey(s)
                return (
                  <SettingLine
                    key={slot}
                    row={s}
                    value={draft?.[slot] !== undefined ? draft[slot] : s.value}
                    onChange={(next) => onValue(slot, next)}
                    onReveal={onReveal}
                  />
                )
              })}
            </div>
          )}
          {dirtyCount > 0 && (
            <div className="baseui:flex baseui:items-center baseui:gap-2 baseui:border-t baseui:border-border baseui:px-3 baseui:py-2">
              {saveError !== undefined ? (
                <span className="baseui:flex-1 baseui:text-xs baseui:break-all baseui:whitespace-pre-wrap baseui:text-destructive">{saveError}</span>
              ) : (
                <span className="baseui:flex-1 baseui:text-xs baseui:text-muted-foreground">
                  改了 {dirtyCount} 项，还没保存
                </span>
              )}
              <Button size="xs" variant="ghost" disabled={saving} onClick={onDiscard}>
                放弃
              </Button>
              <Button size="xs" disabled={saving} onClick={onSave}>
                {saving ? '保存中…' : '保存'}
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/** 「peer 没满足」的标记，样式和「有新版」相同，悬停列出没满足的那几项。mark 是 undefined（全满足）时不显示 */
function UnmetPeerBadge({ mark }: { mark: UnmetPeerMark | undefined }): ReactElement | null {
  if (mark === undefined) return null
  return (
    <Badge
      variant="outline"
      className="baseui:shrink-0 baseui:border-warning/40 baseui:px-1.5 baseui:py-0 baseui:text-[10px] baseui:text-warning"
      title={mark.hint}
    >
      {mark.text}
    </Badge>
  )
}

function PluginsPane({ args }: { args: PaneArgs }): ReactElement {
  /** null 是「还没取到」，跟「取到了但一个包都没有」不是一回事——三份表各自独立 */
  const [rows, setRows] = useState<PackageRow[] | null>(null)
  const [settingsRows, setSettingsRows] = useState<SettingRow[] | null>(null)
  /** `settings.all` 没取到的原因，空串是取到了 */
  const [settingsError, setSettingsError] = useState('')
  const [faces, setFaces] = useState<Record<string, Face>>({})
  /** `shell.plugins` 没取到的原因，空串是取到了。取不到时标题用条目 id */
  const [facesError, setFacesError] = useState('')
  /** 取表本身没成时的那句话。跟操作的回执分开——它说的是整个列表都没有内容 */
  const [listError, setListError] = useState('')
  /** 上一次操作的回执。**error 一个字都不丢**，pnpm 输出的最后几行在里面 */
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  /** 展开着的条目。按 entryId 记——重新取表后不变 */
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set())
  /** 每条条目的设置草稿：slot（转义过的位置串）→ 新值。空对象 = 没改动 */
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  /** 删条目确认框里的那条条目；null 是确认框关着 */
  const [asking, setAsking] = useState<{ card: Card } | null>(null)
  const [alsoDrop, setAlsoDrop] = useState(true)
  /** 卸载确认框：**包级**——这个包的全部条目和包本身。isSelf 表示卸载的是插件管理自己 */
  const [askingUninstall, setAskingUninstall] = useState<{
    pkg: string
    count: number
    settings: SettingRow[]
    isSelf: boolean
  } | null>(null)
  const [uninstallDrop, setUninstallDrop] = useState(false)
  const [installInput, setInstallInput] = useState('')
  const [orphansOpen, setOrphansOpen] = useState(false)
  const [sharedOpen, setSharedOpen] = useState(false)
  const [noEntryOpen, setNoEntryOpen] = useState(false)
  /** 「已安装 / 可安装」两段。可安装那段见 market.tsx */
  const [tab, setTab] = useState<'installed' | 'market'>('installed')
  /** outdated 的表。null 是「还没查到」——跟「查到了、全都最新」（空对象）分得开 */
  const [updates, setUpdates] = useState<OutdatedMap | null>(null)
  const [checking, setChecking] = useState(false)
  /** 「全部更新」的确认框开着；`updatingAll` 是点了确认、升级与整页重新加载还没做完 */
  const [askingUpdateAll, setAskingUpdateAll] = useState(false)
  const [updatingAll, setUpdatingAll] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    // 三份表**各取各的、各自失败**——设置插件没装时插件管理照样能用，展开区写明设置取不到的原因
    const [list, settings, faces] = await Promise.allSettled([
      callPluginManager(args.host, LIST),
      args.host.call(SETTINGS_ALL),
      args.host.call(SHELL_PLUGINS),
    ])
    if (list.status === 'fulfilled') {
      const result = list.value
      if (result.ok) {
        setRows(toRows(result.data))
        setListError('')
      } else {
        setListError(result.error)
      }
    } else {
      setListError(`读取插件列表失败：${String(list.reason)}`)
    }
    if (settings.status === 'fulfilled') {
      const result = asResult(settings.value)
      if (result.ok) {
        setSettingsRows(acceptSettings(result.data))
        setSettingsError('')
      } else {
        setSettingsRows(null)
        setSettingsError(result.error)
      }
    } else {
      setSettingsRows(null)
      setSettingsError(String(settings.reason))
    }
    if (faces.status === 'fulfilled') {
      const result = asResult(faces.value)
      if (result.ok) {
        setFaces(acceptFaces(result.data))
        setFacesError('')
      } else {
        setFacesError(result.error)
      }
    } else {
      setFacesError(String(faces.reason))
    }
  }, [args.host])

  /**
   * 查一遍新版本。`manual` 说这次是谁发起的：点按钮查的把失败显示在 notice 上；窗格打开时自动查的
   * 失败就不提示（`updates` 设回 null，界面上什么都不标，也不影响列表）。
   */
  const checkOutdated = useCallback(
    async (manual: boolean): Promise<void> => {
      setChecking(true)
      try {
        const result = await callPluginManager(args.host, OUTDATED)
        if (!result.ok) {
          setUpdates(null)
          if (manual) setNotice({ ok: false, text: result.error })
          return
        }
        setUpdates(result.data.updates)
      } catch (err: unknown) {
        setUpdates(null)
        if (manual) setNotice({ ok: false, text: String(err) })
      } finally {
        setChecking(false)
      }
    },
    [args.host],
  )

  useEffect(() => {
    // refresh 不会 reject：三条命令用 allSettled 取，失败原因各自写进状态
    void refresh()
    // 窗格打开时查一次新版本。查不成不提示——没有 pnpm 时不该每打开一次窗格都报一次错，
    // 点「检查更新」按钮才显示原因
    void checkOutdated(false)
  }, [refresh, checkOutdated])

  /** 执行完一定重新取表：没有事件推送，不重取的话界面停在旧样子上，看起来就是点了没反应 */
  const run = async (invoke: () => Promise<Acknowledged | CallResult>, done: string): Promise<void> => {
    setBusy(true)
    try {
      const result = await invoke()
      setNotice(result.ok ? { ok: true, text: done } : { ok: false, text: result.error })
    } catch (err: unknown) {
      setNotice({ ok: false, text: String(err) })
    }
    try {
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  // ── 派生：三份表合成「一条条目一张卡片」────────────────────────────────────
  interface Card {
    entry: EntryRow
    pkg: string
    spec?: string
    settings: SettingRow[]
    peerMark?: UnmetPeerMark
  }

  const cards = useMemo<Card[]>(() => {
    const out: Card[] = []
    for (const row of rows ?? []) {
      for (const entry of row.entries) {
        out.push({
          entry,
          pkg: row.pkg,
          spec: row.spec,
          settings: settingsRows === null ? [] : settingsForEntry(settingsRows, entry.entryId),
          peerMark: unmetPeerMark(row),
        })
      }
    }
    return out
  }, [rows, settingsRows])

  /** 「可安装」那一栏用的已安装索引：从已取的这份表推导，不再调一次 plugin-manager.list */
  const marketIndex = useMemo<InstalledIndex | null>(() => (rows === null ? null : installedIndex(rows)), [rows])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter((card) => {
      const on = !card.entry.disabled
      if (filter === 'on' && !on) return false
      if (filter === 'off' && on) return false
      if (filter === 'bad' && !card.entry.attention) return false
      if (q === '') return true
      return (
        card.entry.id.toLowerCase().includes(q) ||
        card.pkg.toLowerCase().includes(q) ||
        card.entry.entryId.toLowerCase().includes(q) ||
        card.settings.some(
          (s) => s.key.toLowerCase().includes(q) || (s.title ?? '').toLowerCase().includes(q),
        )
      )
    })
  }, [cards, filter, search])

  /** 已安装但没有条目的包：插件管理不区分插件与库，一律列在「已安装、没有条目的包」里 */
  const noEntryRows = useMemo(() => (rows ?? []).filter((row) => row.entries.length === 0), [rows])

  const orphans = useMemo(() => {
    if (settingsRows === null) return []
    return orphanSettings(settingsRows, cards.map((card) => card.entry.entryId))
  }, [settingsRows, cards])

  /**
   * 公共区里有插件声明着的项：按条目分区找不到，单独一块。草稿、保存错误按 `SHARED_SECTION` 记，
   * 和条目的 entryId 放在同一张表里——entryId 是 kebab-case 分段，不会等于 `*`
   */
  const shared = useMemo(() => (settingsRows === null ? [] : sharedSettings(settingsRows)), [settingsRows])
  const sharedDirtyCount = dirtySlots(drafts[SHARED_SECTION]).length

  const summary = useMemo(() => summarize(rows ?? []), [rows])
  const onCount = cards.filter((card) => !card.entry.disabled).length
  const badCount = cards.filter((card) => card.entry.attention).length

  // ── 动作───────────────────────────────────────────────────────────────────

  const toggleOpen = (entryId: string): void =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })

  /** 读不到就抛，由那一项如实显示原因：显示成空框会被读成「没设过」 */
  const revealSecret = async (row: SettingRow): Promise<string> => {
    const result = asResult(await args.host.call(SETTINGS_GET, { section: row.section, key: row.key }))
    if (!result.ok) throw new Error(result.error)
    const value = result.data
    // 命令返回「ok 但没值」＝这一项磁盘上没有值。**如实说没设过**，不显示成空框
    if (value === undefined) throw new Error('这一项磁盘上没有值（没设过）')
    // secret 的值就是字符串。返回了别的形状说明这一项与声明对不上，也如实说，不把它 String() 成一句话
    if (typeof value !== 'string') throw new Error(`这一项的值不是字符串：${typeof value}`)
    return value
  }

  const onValue = (entryId: string, slot: string, next: unknown): void =>
    setDrafts((prev) => ({ ...prev, [entryId]: { ...prev[entryId], [slot]: next } }))

  const discardEntry = (entryId: string): void =>
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[entryId]
      return next
    })

  /** 逐键 settings.set，有一个失败就全留在草稿里；只提交草稿里有的槽（`dirtySlots`），没动过的 secret 不会被当成清空 */
  const saveEntry = async (entryId: string): Promise<void> => {
    const slots = dirtySlots(drafts[entryId])
    if (slots.length === 0) return
    setSavingId(entryId)
    const failures: string[] = []
    for (const [slot, value] of slots) {
      try {
        const pos = parseSlotKey(slot)
        const result = asResult(await args.host.call(SETTINGS_SET, { ...pos, value }))
        if (!result.ok) failures.push(`${pos.section}.${pos.key}：${result.error}`)
      } catch (err: unknown) {
        failures.push(`${slot}：${String(err)}`)
      }
    }
    setSavingId(null)
    if (failures.length > 0) {
      setSaveErrors((prev) => ({ ...prev, [entryId]: failures.join('\n') }))
      return
    }
    setSaveErrors((prev) => {
      const next = { ...prev }
      delete next[entryId]
      return next
    })
    discardEntry(entryId)
    // 设置写进磁盘了，重新取一份 settings，让「未声明」这类标记跟着更新。草稿已经清掉，
    // 重新取失败时不能留着旧的那份：卡片会显示保存之前的值
    let reloadError: string
    try {
      const result = asResult(await args.host.call(SETTINGS_ALL))
      if (result.ok) {
        setSettingsRows(acceptSettings(result.data))
        setSettingsError('')
        setNotice({ ok: true, text: '设置存好了' })
        return
      }
      reloadError = result.error
    } catch (err: unknown) {
      reloadError = String(err)
    }
    setSettingsRows(null)
    setSettingsError(reloadError)
    setNotice({ ok: false, text: `设置存好了，但重新读取设置没成：${reloadError}` })
  }

  const install = async (): Promise<void> => {
    const pkg = installInput.trim()
    if (pkg === '') return
    setBusy(true)
    try {
      // 失败时插件管理已经把 pnpm 输出的最后几行拼进 error
      const result = await callPluginManager(args.host, INSTALL, { pkg })
      if (!result.ok) {
        setNotice({ ok: false, text: result.error })
      } else {
        setNotice({ ok: true, text: `已安装 ${pkg}，条目 ${result.data.entryId}。是否加载成功，看这条条目的状态` })
      }
    } catch (err: unknown) {
      setNotice({ ok: false, text: String(err) })
    }
    setInstallInput('')
    await refresh()
    setBusy(false)
  }


  /** 过期清单，按包名排——确认框里列的、「全部更新」亮不亮，都看它 */
  const outdatedRows = useMemo(
    () => Object.entries(updates ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [updates],
  )

  /** 插件管理自己也升了就先等它的条目重新加载完，再调 `shell.reload` */
  const reloadPageAfterUpdate = async (view: UpdateView): Promise<CallResult> => {
    if (view.selfDeferred) {
      const remounted = await waitForOwnRemount({
        call: (command) => callPluginManager(args.host, command),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        listCommand: LIST,
        ownPkg: OWN_PKG,
      })
      if (!remounted.ok) return remounted
    }
    return asResult(await args.host.call(SHELL_RELOAD))
  }

  /** 不给 `only` 升全部过期包，给了只升这几个；有包升级了就整页重新加载 */
  const updatePackages = async (only?: readonly string[]): Promise<void> => {
    setBusy(true)
    setUpdatingAll(true)
    try {
      const view = describeUpdateReceipt(await callPluginManager(args.host, UPDATE, only === undefined ? { all: true } : { only }))
      setNotice({ ok: view.ok, text: view.text })
      if (view.pageReloadNeeded) {
        const reloaded = await reloadPageAfterUpdate(view)
        if (!reloaded.ok) setNotice({ ok: false, text: `${view.text}\n界面没有整页重新加载：${reloaded.error}` })
      }
    } catch (err: unknown) {
      setNotice({ ok: false, text: String(err) })
    }
    setAskingUpdateAll(false)
    setUpdatingAll(false)
    try {
      await refresh()
      await checkOutdated(false)
    } finally {
      setBusy(false)
    }
  }

  const removeEntry = async (): Promise<void> => {
    if (asking === null) return
    const {
      card: { entry, settings },
    } = asking
    setBusy(true)
    try {
      const result = await callPluginManager(args.host, REMOVE_ENTRY, { entryId: entry.entryId })
      if (!result.ok) {
        setNotice({ ok: false, text: result.error })
      } else {
        const deletion = alsoDrop ? await deleteSettingValues((command, pos) => args.host.call(command, pos), SETTINGS_DELETE, settings) : NOTHING_DELETED
        // 设置没取到时 settings 是空的，勾了「一并删除」也删不了，要说出来
        const settingsUnknown = alsoDrop && settingsError !== '' ? `；设置取不到（${settingsError}），设置值没删` : ''
        setNotice({
          ok: deletion.failures.length === 0 && settingsUnknown === '',
          text: `条目 ${entry.id} 删了，包没动${describeSettingsDeletion(deletion)}${settingsUnknown}`,
        })
      }
    } catch (err: unknown) {
      setNotice({ ok: false, text: String(err) })
    }
    setAsking(null)
    try {
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const askRemove = (card: Card): void => {
    setAlsoDrop(true)
    setAsking({ card })
  }

  /** 打开卸载确认框。条目数与设置值都从当前的 cards 里现算 */
  const askUninstall = (pkg: string): void => {
    const own = cards.filter((card) => card.pkg === pkg)
    setUninstallDrop(false)
    setAskingUninstall({
      pkg,
      count: own.length,
      settings: own.flatMap((card) => card.settings),
      isSelf: pkg === OWN_PKG,
    })
  }

  const uninstallPkg = async (): Promise<void> => {
    if (askingUninstall === null) return
    const { pkg, settings } = askingUninstall
    setBusy(true)
    try {
      const result = await callPluginManager(args.host, UNINSTALL, { pkg })
      if (!result.ok) {
        // 失败时插件管理已经把原因与 pnpm 输出的最后几行拼进 error
        setNotice({ ok: false, text: result.error })
      } else {
        const deletion = uninstallDrop ? await deleteSettingValues((command, pos) => args.host.call(command, pos), SETTINGS_DELETE, settings) : NOTHING_DELETED
        const touchedSettings = deletion.deleted > 0 || deletion.failures.length > 0
        setNotice({
          ok: deletion.failures.length === 0,
          text: `${pkg} 卸载了，包与条目一起删除${touchedSettings ? describeSettingsDeletion(deletion) : '；设置与数据留在磁盘上'}${
            pkg === OWN_PKG ? '。插件管理自己的窗格还开着，关掉它就没了' : ''
          }`,
        })
      }
    } catch (err: unknown) {
      setNotice({ ok: false, text: String(err) })
    }
    setAskingUninstall(null)
    try {
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  // ── 渲染───────────────────────────────────────────────────────────────────

  return (
    <div className="baseui:flex baseui:h-full baseui:flex-col baseui:bg-background baseui:text-foreground">
      {/* 按包名直接安装的输入框放在两栏切换之上：列表以外的、第三方的插件，两栏里都用它安装 */}
      <div className="baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
        <div className="baseui:flex baseui:items-center baseui:gap-2">
          <Input
            className="baseui:h-8 baseui:flex-1 baseui:font-mono"
            placeholder="按包名直接安装，如 @godcreator/gwb-hello（安装最新版）"
            value={installInput}
            onChange={(e) => setInstallInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && installInput.trim() !== '') void install()
            }}
          />
          <Button size="sm" disabled={busy || installInput.trim() === ''} onClick={() => void install()}>
            安装
          </Button>
        </div>
      </div>

      {notice !== null && (
        <div
          className={`baseui:flex baseui:items-start baseui:gap-2 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2 baseui:text-xs ${
            notice.ok ? 'baseui:text-muted-foreground' : 'baseui:text-destructive'
          }`}
        >
          <span className="baseui:flex-1 baseui:whitespace-pre-wrap baseui:break-all">{notice.text}</span>
          <Button size="xs" variant="ghost" onClick={() => setNotice(null)}>
            知道了
          </Button>
        </div>
      )}

      {/* 「已安装」与「可安装」两栏。刷新按钮两栏共用——「可安装」那一栏判断装没装用的是同一份表 */}
      <div className="baseui:flex baseui:items-center baseui:gap-1 baseui:border-b baseui:border-border baseui:px-3 baseui:py-1.5">
        <Button size="sm" variant={tab === 'installed' ? 'secondary' : 'ghost'} onClick={() => setTab('installed')}>
          已安装
        </Button>
        <Button size="sm" variant={tab === 'market' ? 'secondary' : 'ghost'} onClick={() => setTab('market')}>
          可安装
        </Button>
        <span className="baseui:flex-1" />
        <Button
          size="sm"
          variant="ghost"
          title="查一遍 home 里已装的包哪些有新版本"
          disabled={checking || busy}
          onClick={() => void checkOutdated(true)}
        >
          {checking ? '检查中…' : '检查更新'}
        </Button>
        {/* 有过期包才高亮可点：没查过（null）与查了全是最新（空表）都是灰的 */}
        <Button
          size="sm"
          variant={outdatedRows.length > 0 ? 'secondary' : 'ghost'}
          title={
            outdatedRows.length > 0
              ? `热升级 ${outdatedRows.length} 个包（plugin-manager.update 全部升级）：一次 pnpm add，逐条停用→启用重新加载成新版本，不重启，最后整页重新加载界面`
              : '没有过期的包'
          }
          disabled={checking || busy || outdatedRows.length === 0}
          onClick={() => setAskingUpdateAll(true)}
        >
          {updatingAll ? '升级中…' : '全部更新'}
          {!updatingAll && outdatedRows.length > 0 ? ` ${outdatedRows.length}` : ''}
        </Button>
        <Button size="icon-sm" variant="ghost" title="重新读取" disabled={busy} onClick={() => void refresh()}>
          <RotateCw />
        </Button>
      </div>

      {tab === 'market' ? (
        <MarketTab host={args.host} installed={marketIndex} busy={busy} onChanged={refresh} portal={args.shell.portal} />
      ) : (
        <>
          <div className="baseui:flex baseui:flex-wrap baseui:items-center baseui:gap-x-2 baseui:gap-y-2 baseui:border-b baseui:border-border baseui:px-3 baseui:py-2">
            <div className="baseui:relative baseui:min-w-40 baseui:flex-1">
              <Search className="baseui:pointer-events-none baseui:absolute baseui:top-1/2 baseui:left-2 baseui:size-3.5 baseui:-translate-y-1/2 baseui:text-muted-foreground" />
              <Input
                type="search"
                placeholder="搜索插件名、包名、设置项"
                className="baseui:h-8 baseui:pl-7"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="baseui:flex baseui:items-center baseui:gap-1">
              {(['all', 'on', 'off', 'bad'] as Filter[]).map((f) => (
                <Button key={f} size="sm" variant={filter === f ? 'secondary' : 'ghost'} onClick={() => setFilter(f)}>
                  {FILTER_LABEL[f]}
                  {f === 'bad' && badCount > 0 && <Badge variant="destructive">{badCount}</Badge>}
                </Button>
              ))}
            </div>
          </div>

          <div className="baseui:flex-1 baseui:overflow-auto">
            {listError !== '' && <p className="baseui:p-6 baseui:text-sm baseui:whitespace-pre-wrap baseui:text-destructive">{listError}</p>}

            {facesError !== '' && (
              <p className="baseui:border-b baseui:border-border baseui:px-3 baseui:py-1.5 baseui:text-xs baseui:break-all baseui:text-warning" title={facesError}>
                插件的显示名与图标取不到（shell.plugins），下面用条目 id 代替：{facesError}
              </p>
            )}

            {listError === '' && rows !== null && cards.length === 0 && (
              <p className="baseui:p-6 baseui:text-sm baseui:text-muted-foreground">home 里一条条目都没有。</p>
            )}

            {shown.map((card) => (
              <EntryCard
                key={card.entry.entryId}
                card={card}
                portal={args.shell.portal}
                face={faces[card.entry.entryId]}
                open={openIds.has(card.entry.entryId)}
                onToggleOpen={() => toggleOpen(card.entry.entryId)}
                busy={busy}
                draft={drafts[card.entry.entryId]}
                saveError={saveErrors[card.entry.entryId]}
                saving={savingId === card.entry.entryId}
                settingsError={settingsError}
                onValue={(slot, next) => onValue(card.entry.entryId, slot, next)}
                onReveal={revealSecret}
                onSave={() => void saveEntry(card.entry.entryId)}
                onDiscard={() => discardEntry(card.entry.entryId)}
                onToggleEnabled={(next) =>
                  void run(
                    () => callPluginManager(args.host, next ? ENABLE : DISABLE, { entryId: card.entry.entryId }),
                    next ? `条目 ${card.entry.id} 启用了` : `条目 ${card.entry.id} 停用了`,
                  )
                }
                onAskRemove={() => askRemove(card)}
                onAskUninstall={() => askUninstall(card.pkg)}
                update={updates?.[card.pkg]}
                onUpdate={
                  updates?.[card.pkg] !== undefined ? () => void updatePackages([card.pkg]) : undefined
                }
              />
            ))}

            {shown.length === 0 && cards.length > 0 && (
              <div className="baseui:p-6 baseui:text-sm baseui:text-muted-foreground">
                <span className="baseui:inline-flex baseui:items-center baseui:gap-2">
                  {cards.length} 条条目都被筛掉了。
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearch('')
                      setFilter('all')
                    }}
                  >
                    清筛选
                  </Button>
                </span>
              </div>
            )}

            {/* 公共设置与下面「没有插件声明的设置」一样只在没筛选时出现；交互与条目卡片里的设置一致 */}
            {search === '' && filter === 'all' && shared.length > 0 && (
              <Collapsible open={sharedOpen} onOpenChange={setSharedOpen} className="baseui:border-t baseui:border-border">
                <CollapsibleTrigger className="baseui:flex baseui:w-full baseui:items-center baseui:gap-2 baseui:px-3 baseui:py-2 baseui:text-left baseui:outline-none baseui:hover:bg-accent/40">
                  <ChevronRight
                    className={cn('baseui:size-4 baseui:text-muted-foreground baseui:transition-transform', sharedOpen && 'baseui:rotate-90')}
                  />
                  <span className="baseui:text-sm baseui:text-muted-foreground">公共设置</span>
                  <Badge variant="outline" className="baseui:px-1.5 baseui:py-0 baseui:text-[10px]">
                    {shared.length}
                  </Badge>
                  {sharedDirtyCount > 0 && (
                    <Badge className="baseui:shrink-0 baseui:border-0 baseui:bg-warning/15 baseui:px-1.5 baseui:py-0 baseui:text-[10px] baseui:text-warning">
                      未保存
                    </Badge>
                  )}
                  <span className="baseui:text-xs baseui:text-muted-foreground">设置插件公共区（*）里的项，不属于哪一个插件，别的插件不用声明也读得到</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="baseui:bg-muted/30">
                    <div className="baseui:divide-y baseui:divide-border">
                      {shared.map((s) => {
                        const slot = slotKey(s)
                        const draft = drafts[SHARED_SECTION]
                        return (
                          <SettingLine
                            key={slot}
                            row={s}
                            value={draft?.[slot] !== undefined ? draft[slot] : s.value}
                            onChange={(next) => onValue(SHARED_SECTION, slot, next)}
                            onReveal={revealSecret}
                          />
                        )
                      })}
                    </div>
                    {sharedDirtyCount > 0 && (
                      <div className="baseui:flex baseui:items-center baseui:gap-2 baseui:border-t baseui:border-border baseui:px-3 baseui:py-2">
                        {saveErrors[SHARED_SECTION] !== undefined ? (
                          <span className="baseui:flex-1 baseui:text-xs baseui:break-all baseui:whitespace-pre-wrap baseui:text-destructive">
                            {saveErrors[SHARED_SECTION]}
                          </span>
                        ) : (
                          <span className="baseui:flex-1 baseui:text-xs baseui:text-muted-foreground">改了 {sharedDirtyCount} 项，还没保存</span>
                        )}
                        <Button size="xs" variant="ghost" disabled={savingId === SHARED_SECTION} onClick={() => discardEntry(SHARED_SECTION)}>
                          放弃
                        </Button>
                        <Button size="xs" disabled={savingId === SHARED_SECTION} onClick={() => void saveEntry(SHARED_SECTION)}>
                          {savingId === SHARED_SECTION ? '保存中…' : '保存'}
                        </Button>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/*
              没有插件声明的设置单独一块，放在最后：它们不属于界面上任何一个插件，混进上面那张表只会
              让人以为插件还在。只在没筛选的时候出现——筛选中的列表只列符合条件的条目
            */}
            {search === '' && filter === 'all' && orphans.length > 0 && (
              <Collapsible open={orphansOpen} onOpenChange={setOrphansOpen} className="baseui:border-t baseui:border-border">
                <CollapsibleTrigger className="baseui:flex baseui:w-full baseui:items-center baseui:gap-2 baseui:px-3 baseui:py-2 baseui:text-left baseui:outline-none baseui:hover:bg-accent/40">
                  <ChevronRight
                    className={cn('baseui:size-4 baseui:text-muted-foreground baseui:transition-transform', orphansOpen && 'baseui:rotate-90')}
                  />
                  <span className="baseui:text-sm baseui:text-muted-foreground">没有插件声明的设置</span>
                  <Badge variant="outline" className="baseui:px-1.5 baseui:py-0 baseui:text-[10px]">
                    {orphans.length}
                  </Badge>
                  <span className="baseui:text-xs baseui:text-muted-foreground">磁盘上有值，此刻没有插件声明它</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="baseui:divide-y baseui:divide-border baseui:bg-muted/30">
                    {orphans.map((s) => (
                      <div key={slotKey(s)} className="baseui:flex baseui:items-center baseui:justify-between baseui:gap-4 baseui:px-3 baseui:py-2">
                        <div className="baseui:min-w-0">
                          <div className="baseui:flex baseui:items-center baseui:gap-2">
                            <span className="baseui:text-sm">{s.title ?? s.key}</span>
                            <code className="baseui:rounded baseui:bg-muted baseui:px-1 baseui:py-0.5 baseui:font-mono baseui:text-[10px] baseui:text-muted-foreground">
                              {s.section}/{s.key}
                            </code>
                          </div>
                          {s.description !== undefined && <p className="baseui:mt-0.5 baseui:text-xs baseui:text-muted-foreground">{s.description}</p>}
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="baseui:shrink-0"
                          title="把这一项从磁盘上删除"
                          onClick={() =>
                            void run(
                              async () => asResult(await args.host.call(SETTINGS_DELETE, { section: s.section, key: s.key })),
                              `删除了 ${s.section}.${s.key}`,
                            )
                          }
                        >
                          <Trash2 /> 删除
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {noEntryRows.length > 0 && (
              <Collapsible open={noEntryOpen} onOpenChange={setNoEntryOpen} className="baseui:border-t baseui:border-border">
                <CollapsibleTrigger className="baseui:flex baseui:w-full baseui:items-center baseui:gap-2 baseui:px-3 baseui:py-2 baseui:text-left baseui:outline-none baseui:hover:bg-accent/40">
                  <ChevronRight
                    className={cn('baseui:size-4 baseui:text-muted-foreground baseui:transition-transform', noEntryOpen && 'baseui:rotate-90')}
                  />
                  <span className="baseui:text-sm baseui:text-muted-foreground">已安装、没有条目的包</span>
                  <Badge variant="outline" className="baseui:px-1.5 baseui:py-0 baseui:text-[10px]">
                    {noEntryRows.length}
                  </Badge>
                  <span className="baseui:text-xs baseui:text-muted-foreground">在 home 里、cordis.yml 里没有指向它的条目，所以没有加载</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="baseui:divide-y baseui:divide-border baseui:bg-muted/30">
                    {noEntryRows.map((row) => (
                      <div key={row.pkg} className="baseui:flex baseui:items-center baseui:justify-between baseui:gap-4 baseui:px-3 baseui:py-2">
                        <div className="baseui:min-w-0">
                          <div className="baseui:flex baseui:items-baseline baseui:gap-2">
                            <span className="baseui:min-w-0 baseui:truncate baseui:font-mono baseui:text-xs">{row.pkg}</span>
                            {row.spec !== undefined && (
                              <span className="baseui:shrink-0 baseui:font-mono baseui:text-xs baseui:text-muted-foreground">{row.spec}</span>
                            )}
                          </div>
                          <p className="baseui:mt-0.5 baseui:text-xs baseui:text-muted-foreground" title={row.noteHint}>
                            {row.note}
                          </p>
                        </div>
                        <UnmetPeerBadge mark={unmetPeerMark(row)} />
                        {updates?.[row.pkg] !== undefined && (
                          <span
                            className="baseui:shrink-0 baseui:font-mono baseui:text-xs baseui:text-warning"
                            title={`home 里是 ${updates[row.pkg]!.current}，registry 上最新是 ${updates[row.pkg]!.latest}`}
                          >
                            有新版 → {updates[row.pkg]!.latest}
                          </span>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="baseui:shrink-0"
                          disabled={busy}
                          title={`往 cordis.yml 里加一条指向 ${row.pkg} 的条目并立即加载`}
                          onClick={() => void run(() => callPluginManager(args.host, ADD_ENTRY, { pkg: row.pkg }), `给 ${row.pkg} 添加了一条条目`)}
                        >
                          添加条目
                        </Button>
                        {/* 没有条目的包也能卸载——卸载是包级动作，不经过条目那一层 */}
                        <Button
                          size="sm"
                          variant="destructive"
                          className="baseui:shrink-0"
                          disabled={busy}
                          title={`pnpm remove ${row.pkg}。设置与数据留在磁盘上`}
                          onClick={() => askUninstall(row.pkg)}
                        >
                          卸载
                        </Button>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          <div className="baseui:flex baseui:items-center baseui:justify-between baseui:gap-3 baseui:border-t baseui:border-border baseui:px-3 baseui:py-1 baseui:text-xs baseui:text-muted-foreground">
            <span>
              {shown.length === cards.length
                ? `${summary.entries} 条条目`
                : `${shown.length} / ${summary.entries} 条条目`}
              {` · ${onCount} 个启用`}
              {badCount > 0 && ` · ${badCount} 个异常`}
            </span>
            <span className="baseui:truncate baseui:font-mono" title="设置存放在 <home>/settings.json，和 cordis.yml 在同一个目录——全部配置都在 home 里">
              settings.json
            </span>
          </div>
        </>
      )}

      <AlertDialog open={asking !== null} onOpenChange={(v) => !v && setAsking(null)}>
        <AlertDialogContent container={args.shell.portal}>
          <AlertDialogHeader>
            <AlertDialogTitle>删除条目 {asking?.card.entry.id}？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="baseui:space-y-2">
                <p>
                  会把 <code className="baseui:font-mono">{asking?.card.entry.id}</code> 这条条目从 cordis.yml 里删除，插件
                  立即卸载。<strong>包不删除</strong>，还留在 home 里；要连包一起删除，用「卸载这个包…」。
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* 设置值删不删要问：不问就静默留下一批没有插件声明的值，它们会出现在列表末尾「没有插件声明的设置」里 */}
          <label className="baseui:flex baseui:items-center baseui:gap-2 baseui:rounded-md baseui:border baseui:border-border baseui:px-3 baseui:py-2 baseui:text-sm">
            <Checkbox checked={alsoDrop} onCheckedChange={(next) => setAlsoDrop(next === true)} />
            <span>
              一并删除它的设置值
              <span className="baseui:block baseui:text-xs baseui:text-muted-foreground">
                不勾的话这些值留在磁盘上，之后会出现在「没有插件声明的设置」里
              </span>
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void removeEntry()}
            >
              删除条目
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 全部更新：先把 from → to 列出来让人确认再执行，和卸载确认框一样。升级中不许关闭（onOpenChange 不处理） */}
      <AlertDialog open={askingUpdateAll} onOpenChange={(v) => !v && !updatingAll && setAskingUpdateAll(false)}>
        <AlertDialogContent container={args.shell.portal}>
          <AlertDialogHeader>
            <AlertDialogTitle>全部更新 {outdatedRows.length} 个包？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="baseui:space-y-2">
                <p>
                  一次 <code className="baseui:font-mono">pnpm add</code> 把下面这些升到 registry 上的最新版，再把它们的每条条目
                  停用→启用重新加载成新版本（本来就停用的保持停用），<strong>不重启内核</strong>；升完整页重新加载界面。
                </p>
                {outdatedRows.some(([pkg]) => pkg === OWN_PKG) && (
                  <p className="baseui:text-warning">
                    插件管理自己也在清单里：它的条目在升级完成之后才重新加载，等它加载起来再整页重新加载界面。
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="baseui:max-h-64 baseui:divide-y baseui:divide-border baseui:overflow-auto baseui:rounded-md baseui:border baseui:border-border">
            {outdatedRows.map(([pkg, info]) => (
              <div key={pkg} className="baseui:flex baseui:items-baseline baseui:justify-between baseui:gap-3 baseui:px-3 baseui:py-1.5 baseui:font-mono baseui:text-xs">
                <span className="baseui:min-w-0 baseui:truncate">{pkg}</span>
                <span className="baseui:shrink-0 baseui:text-muted-foreground">
                  {info.current} → <span className="baseui:text-foreground">{info.latest}</span>
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingAll}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={updatingAll} onClick={() => void updatePackages()}>
              {updatingAll ? '升级中，完成后整页重新加载界面…' : '全部更新'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 卸载是包级动作，与删一条条目是两回事——对话框把两边的边界说清楚 */}
      <AlertDialog open={askingUninstall !== null} onOpenChange={(v) => !v && setAskingUninstall(null)}>
        <AlertDialogContent container={args.shell.portal}>
          <AlertDialogHeader>
            <AlertDialogTitle>卸载 {askingUninstall?.pkg}？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="baseui:space-y-2">
                <p>
                  会把这个包的 <code className="baseui:font-mono">{String(askingUninstall?.count ?? 0)}</code> 条条目从
                  cordis.yml 里删除（插件立即卸载），再 pnpm remove 把包从 home 移走。
                </p>
                <p>
                  <strong>设置与数据留在磁盘上</strong>——重装回来还是那份。只想删除一条条目、保留包的话，取消后用那条条目上的「删除条目…」。
                </p>
                {askingUninstall?.isSelf && (
                  <p className="baseui:text-destructive">
                    这是插件管理自己：卸载之后<strong>这个窗格就没有了</strong>，重启内核后也不会再出现。要装回来只能用命令行。
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {askingUninstall !== null && askingUninstall.settings.length > 0 && (
            <label className="baseui:flex baseui:items-center baseui:gap-2 baseui:rounded-md baseui:border baseui:border-border baseui:px-3 baseui:py-2 baseui:text-sm">
              <Checkbox checked={uninstallDrop} onCheckedChange={(next) => setUninstallDrop(next === true)} />
              <span>
                一并删除这 {askingUninstall.settings.length} 项设置值
                <span className="baseui:block baseui:text-xs baseui:text-muted-foreground">
                  不勾的话这些值留在磁盘上，之后会出现在「没有插件声明的设置」里
                </span>
              </span>
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={() => void uninstallPkg()}
            >
              卸载
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function boot(args: PaneArgs, container: HTMLElement): Root {
  const root = createRoot(container)
  // 认不出的 paneId 如实报错，不改用别的窗格
  if (args.pane.id === PANE_ID) {
    // 弹出层（下拉、确认框）portal 到 `args.shell.portal`（本窗格所在桌面的浮层挂载点），桌面切走时一起隐藏；
    // 样式靠类名前缀隔离，不依赖放在窗格容器里（见外壳页「菜单 portal 到哪都有样式」一节）
    root.render(<PluginsPane args={args} />)
  } else {
    root.render(<p className="baseui:p-3 baseui:text-sm baseui:text-destructive">基础界面插件没有叫 {args.pane.id} 的窗格</p>)
  }
  return root
}

/** 窗格浏览器侧的入口：外壳按导出名 `mountPane` 调用它，挂进窗格容器给的那个元素 */
export function mountPane(args: PaneArgs, container: HTMLElement): PaneHandle {
  // **不给容器加 position:relative**：确认框用 fixed 定位，不依赖最近的 positioned 祖先，遮罩盖住整张桌面
  // 而不是只盖这个窗格
  const root = boot(args, container)
  return {
    dispose() {
      root.unmount()
      container.textContent = ''
    },
  }
}

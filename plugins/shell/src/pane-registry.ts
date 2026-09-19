/**
 * 窗格注册表：谁注册了哪几格。不碰 ctx，测试在 node 里直接跑。
 *
 * 身份不由件自己报——`entryId` 与 `pkg` 由服务层从注册方的 fiber 上取（判据见文档站）。
 * 一条条目一个命名空间：键是 `entryId` + 窗格 id，同一个包挂两条条目也撞不着。
 */

/**
 * 窗格的两类：打开这个动作对它是什么意思。**工具窗格**一张桌面至多一份，打开就是把它显示
 * 出来；**文档窗格**可以开多份，每份装一个内容，打开是「装这个内容」。两类的查重范围、
 * 启动器行为、能不能「在旁边再开一份」都不同。
 */
export type PaneKind = 'tool' | 'document'

/** 件注册一格时给的那几样 */
export interface PaneSpec {
  /** 窗格 id，本条条目内唯一。跟 entryId 拼成全局的窗格 id */
  id: string
  /** 标题栏上那几个字 */
  title: string
  /**
   * 标签上那枚图标：lucide 的**正名**，kebab-case（lucide.dev 上图标页写的那个，如
   * `layout-grid`）。全集都认；认不出的照样进表、标签上画 `#`，登记那一刻日志里 warn 一句
   * 说清怎么改。不给就画 `#`、不出声
   */
  icon?: string
  /** 浏览器半的地址（`file://`），件从自己的 `import.meta.url` 算。没报的格开出来是一句错，不是空白 */
  client?: string
  /** 样式表的地址，同上。没有就不注 */
  style?: string
  /** 工具窗格还是文档窗格。**不给就是 `tool`**；写错照 `tool` 进表、登记那一刻 warn */
  kind?: PaneKind
}

/** 注册方的身份，由服务层从 fiber 上取 */
export interface PaneOwner {
  /** 条目 id（cordis.yml 里那条的 id） */
  entryId: string
  /** 完整包名 */
  pkg: string
}

/** 表里一条：件给的那几样 + 服务填的身份。`kind` 进表时一定填上 */
export type RegisteredPane = Omit<PaneSpec, 'kind'> & PaneOwner & { kind: PaneKind }

function isPaneKind(value: unknown): value is PaneKind {
  return value === 'tool' || value === 'document'
}

export interface PaneRegistry {
  /** 注册一格，回注销函数（只收自己那份，摘两遍不炸） */
  register(owner: PaneOwner, spec: PaneSpec): () => void
  /** 此刻表里有哪些格，按注册先后 */
  list(): RegisteredPane[]
}

/**
 * 键的分隔符用 `:`——窗格 id 注册时就禁止带冒号（见 register），所以 (entryId, 窗格 id)
 * 不会拼出歧义；entryId 自己带冒号不要紧，它只是键的前段。
 */
function keyOf(entryId: string, paneId: string): string {
  return `${entryId}:${paneId}`
}

/**
 * `warn` 由调用方给，真跑时是 cordis logger。说不清自己是谁的抛错，撞名后来者赢但
 * 出声——两种错的性质不一样，判据见文档站。
 *
 * `checkIcon` 认图标名：认得回 `undefined`，认不出回一句话（真跑时对的是 `pane-icon.ts`
 * 的名单）。认不出只 warn、照样进表。
 */
export function createPaneRegistry(
  warn: (message: string) => void,
  checkIcon: (name: string) => string | undefined,
): PaneRegistry {
  const table = new Map<string, RegisteredPane>()

  return {
    register(owner, spec) {
      if (spec.id === '') throw new Error(`${owner.pkg} 注册的窗格没有 id`)
      // entryId 自带冒号（实机是 home:hello），窗格 id 再有一个的话，两组不同的
      // (条目, 窗格) 能拼出同一个面板 id——开格的查重会静默追一个 :2 上去
      if (spec.id.includes(':')) {
        throw new Error(`${owner.pkg} 的窗格 id ${JSON.stringify(spec.id)} 带冒号——那是拼面板 id 的分隔符`)
      }
      if (spec.title === '') throw new Error(`${owner.pkg} 的窗格 ${spec.id} 没有标题`)
      const iconIssue = spec.icon === undefined ? undefined : checkIcon(spec.icon)
      if (iconIssue !== undefined) warn(`${owner.pkg} 的窗格 ${spec.id}：${iconIssue}；标签上先画成 #`)
      const kind: PaneKind = spec.kind === undefined || isPaneKind(spec.kind) ? (spec.kind ?? 'tool') : 'tool'
      if (spec.kind !== undefined && !isPaneKind(spec.kind)) {
        warn(`${owner.pkg} 的窗格 ${spec.id}：kind ${JSON.stringify(spec.kind)} 认不出（只认 'tool' / 'document'），照 'tool' 进表`)
      }
      const key = keyOf(owner.entryId, spec.id)
      const record: RegisteredPane = { ...spec, kind, entryId: owner.entryId, pkg: owner.pkg }
      const prev = table.get(key)
      if (prev !== undefined) {
        warn(`条目 ${owner.entryId} 的窗格 ${spec.id} 被重复注册，后来者生效：${prev.title} → ${record.title}`)
      }
      table.set(key, record)
      // 只收自己那份：这条被后来者顶掉之后再摘，摘的就不该是别人那条
      return () => {
        if (table.get(key) === record) table.delete(key)
      }
    },

    list() {
      return [...table.values()]
    },
  }
}

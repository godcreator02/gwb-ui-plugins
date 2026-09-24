/** 打开这个动作对窗格意味着什么：工具窗格整页至多一份、打开就是显示它；文档窗格可以开多份、每份装一个内容 */
export type PaneKind = 'tool' | 'document'

/** 插件注册一个窗格时给的那几样 */
export interface PaneSpec {
  /** 窗格 id，本条条目内唯一，不许带冒号 */
  id: string
  /** 标签上的标题 */
  title: string
  /** lucide 的正名，kebab-case（如 `layout-grid`）。认不出照样登记、标签上画 `#`，登记时 warn；不给就画 `#` */
  icon?: string
  /**
   * 浏览器侧入口的 `file://` 地址，路径以 `.js` 结尾，插件从自己的 `import.meta.url` 算。
   * 给了却不是这样的地址，注册时抛错；不给的窗格照常登记，打开后显示一句报错
   */
  client?: string
  /** 样式表的 `file://` 地址，路径以 `.css` 结尾；给了却不是这样的地址，注册时抛错。不给就不注入 */
  style?: string
  /** 不给就是 `tool`；写错按 `tool` 登记、登记时 warn */
  kind?: PaneKind
}

/** 注册方的身份，由服务从调用方的 fiber 上取 */
export interface PaneOwner {
  /** cordis.yml 里那条条目的 id */
  entryId: string
  /** 完整包名 */
  pkg: string
}

/** 表里一条：插件给的那几样加服务填的身份，`kind` 一定已填上 */
export type RegisteredPane = Omit<PaneSpec, 'kind'> & PaneOwner & { kind: PaneKind }

function isPaneKind(value: unknown): value is PaneKind {
  return value === 'tool' || value === 'document'
}

export interface PaneRegistry {
  /** 回注销函数：只删自己登记的那条，调两次不报错 */
  register(owner: PaneOwner, spec: PaneSpec): () => void
  /** 按注册先后 */
  list(): RegisteredPane[]
}

/** 窗格 id 不许带冒号，所以 entryId 带冒号也拼不出歧义 */
function registryKeyOf(entryId: string, paneId: string): string {
  return `${entryId}:${paneId}`
}

function throwWhenIdOrTitleIsUnusable(owner: PaneOwner, spec: PaneSpec): void {
  if (spec.id === '') throw new Error(`${owner.pkg} 注册的窗格没有 id`)
  if (spec.id.includes(':')) {
    throw new Error(`${owner.pkg} 的窗格 id ${JSON.stringify(spec.id)} 带冒号——那是拼面板 id 的分隔符`)
  }
  if (spec.title === '') throw new Error(`${owner.pkg} 的窗格 ${spec.id} 没有标题`)
}

function isFileUrlWithPathEndingIn(address: string, extension: string): boolean {
  if (!URL.canParse(address)) return false
  const url = new URL(address)
  return url.protocol === 'file:' && url.pathname.endsWith(extension)
}

function throwWhenClientOrStyleIsNotFileUrl(owner: PaneOwner, spec: PaneSpec): void {
  const expectations = [
    { field: 'client', address: spec.client, extension: '.js', example: "new URL('./client.js', import.meta.url).href" },
    { field: 'style', address: spec.style, extension: '.css', example: "new URL('./style.css', import.meta.url).href" },
  ] as const
  for (const { field, address, extension, example } of expectations) {
    if (address === undefined || isFileUrlWithPathEndingIn(address, extension)) continue
    throw new Error(
      `${owner.pkg} 的窗格 ${spec.id}：${field} 收到 ${JSON.stringify(address)}，` +
        `要的是路径以 ${extension} 结尾的 file:// 地址，从插件自己的模块地址算，如 ${example}`,
    )
  }
}

function kindDefaultingToTool(owner: PaneOwner, spec: PaneSpec, warn: (message: string) => void): PaneKind {
  if (spec.kind === undefined) return 'tool'
  if (isPaneKind(spec.kind)) return spec.kind
  warn(`${owner.pkg} 的窗格 ${spec.id}：kind ${JSON.stringify(spec.kind)} 认不出（只认 'tool' / 'document'），按 'tool' 登记`)
  return 'tool'
}

/** `checkIcon` 认得图标名回 `undefined`，认不出回一句怎么改 */
export function createPaneRegistry(
  warn: (message: string) => void,
  checkIcon: (name: string) => string | undefined,
): PaneRegistry {
  const panesByRegistryKey = new Map<string, RegisteredPane>()

  return {
    register(owner, spec) {
      throwWhenIdOrTitleIsUnusable(owner, spec)
      throwWhenClientOrStyleIsNotFileUrl(owner, spec)
      const iconIssue = spec.icon === undefined ? undefined : checkIcon(spec.icon)
      if (iconIssue !== undefined) warn(`${owner.pkg} 的窗格 ${spec.id}：${iconIssue}；标签上先画成 #`)
      const kind = kindDefaultingToTool(owner, spec, warn)
      const registryKey = registryKeyOf(owner.entryId, spec.id)
      const registeredPane: RegisteredPane = { ...spec, kind, entryId: owner.entryId, pkg: owner.pkg }
      const previous = panesByRegistryKey.get(registryKey)
      if (previous !== undefined) {
        warn(`条目 ${owner.entryId} 的窗格 ${spec.id} 被重复注册，后来者生效：${previous.title} → ${registeredPane.title}`)
      }
      panesByRegistryKey.set(registryKey, registeredPane)
      // 只删自己这条：被后来者替换之后再注销，不能删掉接手的那条
      return () => {
        if (panesByRegistryKey.get(registryKey) === registeredPane) panesByRegistryKey.delete(registryKey)
      }
    },

    list() {
      return [...panesByRegistryKey.values()]
    },
  }
}

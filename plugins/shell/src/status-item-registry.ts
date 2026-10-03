import { isFileUrlWithPathEndingIn, type PaneOwner } from './pane-registry.js'

/** 插件在状态栏上登记一个按钮时给的那几样：点它在按钮上方弹出浮层，浮层里的内容由插件的 `mountStatusItem` 画 */
export interface StatusItemSpec {
  /** 本条条目内唯一，不许带冒号 */
  id: string
  /** 按钮上的字 */
  title: string
  /** lucide 的正名，kebab-case；认不出照样登记、按钮上画 `#`，登记时 warn */
  icon?: string
  /** 浏览器侧入口的 `file://` 地址，路径以 `.js` 结尾，模块要导出 `mountStatusItem` */
  client: string
  /** 样式表的 `file://` 地址，路径以 `.css` 结尾；不给就不注入 */
  style?: string
}

/** 表里一条：插件给的那几样加服务填的身份 */
export type RegisteredStatusItem = StatusItemSpec & PaneOwner

export interface StatusItemRegistry {
  /** 回注销函数：只删自己登记的那条，调两次不报错 */
  register(owner: PaneOwner, spec: StatusItemSpec): () => void
  /** 按登记先后，也就是状态栏上从左到右的顺序 */
  list(): RegisteredStatusItem[]
}

function throwWhenSpecIsUnusable(owner: PaneOwner, spec: StatusItemSpec): void {
  if (spec.id === '') throw new Error(`${owner.pkg} 登记的状态栏按钮没有 id`)
  if (spec.id.includes(':')) throw new Error(`${owner.pkg} 的状态栏按钮 id ${JSON.stringify(spec.id)} 带冒号——那是拼注册表键的分隔符`)
  if (spec.title === '') throw new Error(`${owner.pkg} 的状态栏按钮 ${spec.id} 没有标题`)
  if (!isFileUrlWithPathEndingIn(spec.client, '.js')) {
    throw new Error(
      `${owner.pkg} 的状态栏按钮 ${spec.id}：client 收到 ${JSON.stringify(spec.client)}，要的是路径以 .js 结尾的 file:// 地址，如 new URL('./client.js', import.meta.url).href`,
    )
  }
  if (spec.style !== undefined && !isFileUrlWithPathEndingIn(spec.style, '.css')) {
    throw new Error(
      `${owner.pkg} 的状态栏按钮 ${spec.id}：style 收到 ${JSON.stringify(spec.style)}，要的是路径以 .css 结尾的 file:// 地址，如 new URL('./style.css', import.meta.url).href`,
    )
  }
}

/** 表一变（登记、注销、被后来者替换）就调 `onChange`：页面据此重新取表，插件比页面晚加载也能出现在状态栏上 */
export function createStatusItemRegistry(
  warn: (message: string) => void,
  checkIcon: (name: string) => string | undefined,
  onChange: () => void,
): StatusItemRegistry {
  const itemsByRegistryKey = new Map<string, RegisteredStatusItem>()

  return {
    register(owner, spec) {
      throwWhenSpecIsUnusable(owner, spec)
      const iconIssue = spec.icon === undefined ? undefined : checkIcon(spec.icon)
      if (iconIssue !== undefined) warn(`${owner.pkg} 的状态栏按钮 ${spec.id}：${iconIssue}；按钮上先画成 #`)
      const registryKey = `${owner.entryId}:${spec.id}`
      const registeredItem: RegisteredStatusItem = { ...spec, entryId: owner.entryId, pkg: owner.pkg }
      const previous = itemsByRegistryKey.get(registryKey)
      if (previous !== undefined) {
        warn(`条目 ${owner.entryId} 的状态栏按钮 ${spec.id} 被重复登记，后来者生效：${previous.title} → ${registeredItem.title}`)
      }
      itemsByRegistryKey.set(registryKey, registeredItem)
      onChange()
      return () => {
        if (itemsByRegistryKey.get(registryKey) !== registeredItem) return
        itemsByRegistryKey.delete(registryKey)
        onChange()
      }
    },

    list() {
      return [...itemsByRegistryKey.values()]
    },
  }
}

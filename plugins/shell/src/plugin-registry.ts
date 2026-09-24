/** 插件报自己名字时给的那几样 */
export interface PluginInfo {
  /** 给人看的名字 */
  title: string
  /** 与窗格的 `icon` 同一套认法（lucide 正名、kebab-case），认不出同样 warn；目前还没有地方画它 */
  icon?: string
}

/** 表里一条：插件给的那几样加服务填的身份 */
export interface RegisteredPlugin extends PluginInfo {
  entryId: string
  pkg: string
}

export interface PluginRegistry {
  /** 回注销函数：只删自己登记的那条，调两次不报错 */
  describe(owner: { entryId: string; pkg: string }, info: PluginInfo): () => void
  /** 按报名字的先后 */
  list(): RegisteredPlugin[]
}

/** 键是 `entryId`，一条条目至多一条；`checkIcon` 认得图标名回 `undefined`，认不出回一句怎么改 */
export function createPluginRegistry(
  warn: (message: string) => void,
  checkIcon: (name: string) => string | undefined,
): PluginRegistry {
  const pluginsByEntryId = new Map<string, RegisteredPlugin>()

  return {
    describe(owner, info) {
      if (info.title === '') throw new Error(`${owner.pkg} 报名字时 title 是空串`)
      const iconIssue = info.icon === undefined ? undefined : checkIcon(info.icon)
      if (iconIssue !== undefined) warn(`${owner.pkg} 报名字：${iconIssue}`)
      const registeredPlugin: RegisteredPlugin = { ...info, entryId: owner.entryId, pkg: owner.pkg }
      const previous = pluginsByEntryId.get(owner.entryId)
      if (previous !== undefined) {
        warn(`条目 ${owner.entryId} 报了两次名字，后来者生效：${previous.title} → ${registeredPlugin.title}`)
      }
      pluginsByEntryId.set(owner.entryId, registeredPlugin)
      // 只删自己这条：被后来者替换之后再注销，不能删掉接手的那条
      return () => {
        if (pluginsByEntryId.get(owner.entryId) === registeredPlugin) pluginsByEntryId.delete(owner.entryId)
      }
    },

    list() {
      return [...pluginsByEntryId.values()]
    },
  }
}

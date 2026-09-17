/**
 * 件级信息表：一条条目一条记录，件说「我叫什么」。不碰 ctx，测试在 node 里直接跑。
 *
 * 跟窗格表分开两张：键不同（这张就是 `entryId`、一条条目至多一条），消费方也不同。
 * 身份同样不由件自己报——`entryId` 与 `pkg` 由服务层从注册方的 fiber 上取。
 */

/** 件报自己名字时给的那几样 */
export interface PluginInfo {
  /** 给人看的名字。包名太长、也不是给人读的 */
  title: string
  /** 跟窗格的 `icon` 同一套认法（lucide 正名、kebab-case），认不出同样 warn。眼下只原样收下，还没有地方画它 */
  icon?: string
}

/** 表里一条：件给的那几样 + 服务填的身份 */
export interface RegisteredPlugin extends PluginInfo {
  entryId: string
  pkg: string
}

export interface PluginRegistry {
  /** 报一次名字，回注销函数（只收自己那份，摘两遍不炸） */
  describe(owner: { entryId: string; pkg: string }, info: PluginInfo): () => void
  /** 此刻表里有哪些件，按报名先后 */
  list(): RegisteredPlugin[]
}

/**
 * `warn` 由调用方给，真跑时是 cordis logger。空 title 抛错、报两次只告警、图标名认不出只告警
 * ——跟窗格注册一个规矩，判据见文档站
 */
export function createPluginRegistry(
  warn: (message: string) => void,
  checkIcon: (name: string) => string | undefined,
): PluginRegistry {
  const table = new Map<string, RegisteredPlugin>()

  return {
    describe(owner, info) {
      if (info.title === '') throw new Error(`${owner.pkg} 报了个空标题`)
      const iconIssue = info.icon === undefined ? undefined : checkIcon(info.icon)
      if (iconIssue !== undefined) warn(`${owner.pkg} 报名字：${iconIssue}`)
      const record: RegisteredPlugin = { ...info, entryId: owner.entryId, pkg: owner.pkg }
      const prev = table.get(owner.entryId)
      if (prev !== undefined) {
        warn(`条目 ${owner.entryId} 报了两次名字，后来者生效：${prev.title} → ${record.title}`)
      }
      table.set(owner.entryId, record)
      // 只收自己那份：这条被后来者顶掉之后再摘，摘的就不该是别人那条
      return () => {
        if (table.get(owner.entryId) === record) table.delete(owner.entryId)
      }
    },

    list() {
      return [...table.values()]
    },
  }
}

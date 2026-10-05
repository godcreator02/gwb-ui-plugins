import { describe, expect, it } from 'vitest'
import {
  acceptSettings,
  bareId,
  deleteSettingValues,
  describeSettingsDeletion,
  dirtySlots,
  fieldState,
  loadSettings,
  orphanSettings,
  parseSlotKey,
  secretPlaceholder,
  SHARED_SECTION,
  sharedSettings,
  settingWriteRequest,
  slotKey,
  type SettingRow,
} from '../../src/client/panes/plugin-manager/settings'

/**
 * 设置与凭据列表在综合页合并。`credentials.list` 的行没有 `value` 也没有 `default`，只回 `secret` / `isSet` / 设过才有的 `mask`
 * ——「设过了」与「空着」因此只能靠 `isSet` 分（`fieldState`），而「没动过这一格」与
 * 「把这一格改成空」只能靠「槽在不在草稿里」分（`dirtySlots`）。
 */

const row = (patch: Partial<SettingRow> = {}): SettingRow => ({
  section: 'gitea',
  key: 'token',
  type: 'secret',
  ...patch,
})

describe('acceptSettings：secret 那三格随回执收下', () => {
  it('已设置的 secret 行：没有 value / default，收下 secret、isSet 与掩码', () => {
    const got = acceptSettings([
      { section: 'gitea', key: 'token', type: 'secret', title: 'gitea token', live: true, secret: true, isSet: true, mask: '••••' },
    ])
    expect(got[0]).toEqual({
      section: 'gitea',
      key: 'token',
      type: 'secret',
      title: 'gitea token',
      secret: true,
      isSet: true,
      mask: '••••',
    })
    expect(got[0]!.value).toBeUndefined()
    expect(got[0]!.default).toBeUndefined()
  })

  it('没设过的 secret 行：isSet false、没有掩码', () => {
    const got = acceptSettings([{ section: 'gitea', key: 'token', type: 'secret', secret: true, isSet: false }])
    expect(got[0]).toMatchObject({ type: 'secret', secret: true, isSet: false })
    expect(got[0]!.mask).toBeUndefined()
  })

  it('凭据列表意外带上 value/default 也不导入编辑草稿', () => {
    const got = acceptSettings([{ section: 'gitea', key: 'token', type: 'secret', secret: true, isSet: true, value: 'private', default: 'private' }])
    expect(got[0]).not.toHaveProperty('value')
    expect(got[0]).not.toHaveProperty('default')
  })

  it('掩码是空串就当没有——空掩码会被念成「设了个空值」', () => {
    const got = acceptSettings([{ section: 'gitea', key: 'token', type: 'secret', secret: true, isSet: true, mask: '' }])
    expect(got[0]!.mask).toBeUndefined()
  })

  it('非 secret 行一个字节没变：value 照收，secret 那三格不带', () => {
    const got = acceptSettings([
      { section: 'gitea', key: 'base-url', type: 'string', value: 'https://git.example.com', default: 'https://git.example.com', live: true },
    ])
    expect(got[0]).toEqual({
      section: 'gitea',
      key: 'base-url',
      type: 'string',
      value: 'https://git.example.com',
      default: 'https://git.example.com',
    })
  })
})

describe('loadSettings：普通设置与凭据各用自己的列表命令', () => {
  it('并行读取两份列表并合并，凭据不从普通设置列表兼容读取', async () => {
    const calls: string[] = []
    const got = await loadSettings(async (command) => {
      calls.push(command)
      return {
        ok: true,
        data: command === 'settings.all'
          ? [{ section: 'gitea', key: 'base-url', type: 'string', value: 'https://git.example.com' }, row({ value: 'old-contract' })]
          : [row({ secret: true, isSet: true, mask: '••••' })],
      }
    })
    expect(calls).toEqual(['settings.all', 'credentials.list'])
    expect(got.map((setting) => [setting.key, setting.type])).toEqual([['base-url', 'string'], ['token', 'secret']])
    expect(got[1]).not.toHaveProperty('value')
  })

  it('凭据命令缺失时说明原因，不把普通设置列表当成完整配置', async () => {
    await expect(loadSettings(async (command) => command === 'credentials.list'
      ? { ok: false, error: '命令不存在' }
      : { ok: true, data: [] })).rejects.toThrow('credentials.list：命令不存在')
  })

  it('两边失败都报告，包括调用本身抛错', async () => {
    await expect(loadSettings(async (command) => {
      if (command === 'settings.all') throw new Error('IPC 断开')
      return { ok: false, error: '凭据文件损坏' }
    })).rejects.toThrow('settings.all：Error: IPC 断开\ncredentials.list：凭据文件损坏')
  })
})

describe('settingWriteRequest：按类型选择写入命令', () => {
  it('凭据输入用专用命令，清空输入清除凭据', () => {
    expect(settingWriteRequest(row(), 'new-token')).toEqual({ command: 'credentials.set', args: { section: 'gitea', key: 'token', value: 'new-token' } })
    expect(settingWriteRequest(row(), '')).toEqual({ command: 'credentials.delete', args: { section: 'gitea', key: 'token' } })
    expect(settingWriteRequest(row(), undefined)).toEqual({ command: 'credentials.delete', args: { section: 'gitea', key: 'token' } })
  })

  it('普通设置保留空字符串，数值清空只清除设置', () => {
    expect(settingWriteRequest(row({ type: 'string', key: 'base-url' }), '')).toEqual({ command: 'settings.set', args: { section: 'gitea', key: 'base-url', value: '' } })
    expect(settingWriteRequest(row({ type: 'number', key: 'port' }), undefined)).toEqual({ command: 'settings.delete', args: { section: 'gitea', key: 'port' } })
  })
})

describe('acceptSettings：认不出的整行丢掉', () => {
  it('type 认不出的那一行丢掉，不当成 string', () => {
    const got = acceptSettings([
      { section: 'gitea', key: 'mode', type: 'enum', value: 'a', live: true },
      { section: 'gitea', key: 'base-url', type: 'string', value: 'x', live: true },
    ])
    expect(got.map((setting) => setting.key)).toEqual(['base-url'])
  })

  it('没有 type 的行也丢掉', () => {
    expect(acceptSettings([{ section: 'gitea', key: 'mode', value: 'a', live: true }])).toEqual([])
  })
})

describe('slotKey / parseSlotKey', () => {
  it('拼了再拆回原样，section 里有 / 也拆得回来', () => {
    const pos = { section: 'a/b', key: 'token' }
    expect(parseSlotKey(slotKey(pos))).toEqual(pos)
  })

  it('切不成两段就抛错，不拿空串去调设置命令', () => {
    expect(() => parseSlotKey('gitea')).toThrow(/section\/key/)
    expect(() => parseSlotKey('a/b/c')).toThrow(/section\/key/)
  })
})

describe('bareId', () => {
  it('取末段', () => {
    expect(bareId('home:hello')).toBe('hello')
    expect(bareId('hello')).toBe('hello')
  })
})

describe('orphanSettings：没有插件声明的设置', () => {
  const setting = (patch: Partial<SettingRow>): SettingRow => ({ section: 'gitea', key: 'token', type: 'string', ...patch })

  it('未声明、又对不上任何条目的才算', () => {
    const orphan = setting({ section: 'gone', live: false })
    expect(orphanSettings([orphan], ['home:gitea'])).toEqual([orphan])
  })

  it('公共区 * 里正被声明着的项不算——它对不上任何条目，但有人声明', () => {
    expect(orphanSettings([setting({ section: '*', key: 'proxy' })], ['home:gitea'])).toEqual([])
  })

  it('公共区里没人声明的项算', () => {
    const shared = setting({ section: '*', key: 'proxy', live: false })
    expect(orphanSettings([shared], ['home:gitea'])).toEqual([shared])
  })

  it('对得上条目的未声明项画在条目下，不在这里重复', () => {
    expect(orphanSettings([setting({ live: false })], ['home:gitea'])).toEqual([])
  })
})

describe('sharedSettings：公共区里此刻有插件声明着的项', () => {
  const setting = (patch: Partial<SettingRow>): SettingRow => ({ section: 'gitea', key: 'token', type: 'string', ...patch })

  it('只收 section 是 * 且有人声明的；没人声明的归 orphanSettings，条目分区的不收', () => {
    const declared = setting({ section: SHARED_SECTION, key: 'proxy' })
    const undeclared = setting({ section: SHARED_SECTION, key: 'old', live: false })
    expect(sharedSettings([declared, undeclared, setting({})])).toEqual([declared])
  })

  it('与 orphanSettings 不重叠：公共区每一项只出现在一处', () => {
    const all = [setting({ section: SHARED_SECTION, key: 'proxy' }), setting({ section: SHARED_SECTION, key: 'old', live: false })]
    const shared = sharedSettings(all)
    const orphans = orphanSettings(all, ['home:gitea'])
    expect([...shared, ...orphans].map((s) => s.key).sort()).toEqual(['old', 'proxy'])
  })
})

describe('fieldState：一格画成哪一态', () => {
  it('secret + isSet → 已设置态', () => {
    expect(fieldState(row({ isSet: true }))).toBe('secret-set')
  })

  it('secret + !isSet → 未设置态', () => {
    expect(fieldState(row({ isSet: false }))).toBe('secret-unset')
  })

  it('secret 行没带 isSet（旧回执）也当没设过——**不看 value**，枚举口那一格永远不在', () => {
    expect(fieldState(row())).toBe('secret-unset')
    expect(fieldState(row({ value: 'ghp_明文' }))).toBe('secret-unset')
  })

  it('非 secret 行不受影响：不管带没带 isSet 都按值画', () => {
    expect(fieldState(row({ type: 'string', isSet: true }))).toBe('value')
    expect(fieldState(row({ type: 'number', isSet: true }))).toBe('value')
    expect(fieldState(row({ type: 'boolean' }))).toBe('value')
    expect(fieldState(row({ type: 'string-list' }))).toBe('value')
  })
})

describe('secretPlaceholder：空框里写什么', () => {
  it('设过了摆枚举口给的掩码，并说清「不在此显示」', () => {
    expect(secretPlaceholder({ isSet: true, mask: '••••' })).toBe('已设置（••••，不在此显示）')
  })

  it('没设过就说没设过，掩码在也不摆——那不是它的记号', () => {
    expect(secretPlaceholder({ isSet: false, mask: '••••' })).toBe('未设置')
    expect(secretPlaceholder({})).toBe('未设置')
  })

  it('isSet 说设过了却没给掩码时兜一个——占位符不能是空的（空掩码在 acceptSettings 那里就丢了）', () => {
    expect(secretPlaceholder({ isSet: true })).toBe('已设置（••••，不在此显示）')
  })
})

describe('dirtySlots：保存只提交真被编辑过的格', () => {
  it('槽在草稿里才算动过——**空串也是动过**（人把它清空了）', () => {
    expect(dirtySlots({ 'gitea/token': '' })).toEqual([['gitea/token', '']])
    expect(dirtySlots({ 'gitea/token': 'ghp_新' })).toEqual([['gitea/token', 'ghp_新']])
  })

  it('没动过的格不在草稿里，也就交不上去——枚举口不回值，`undefined` 分不出「没动过」与「清空」', () => {
    expect(dirtySlots({})).toEqual([])
    expect(dirtySlots(undefined)).toEqual([])
    expect(dirtySlots({ 'gitea/token': undefined })).toEqual([['gitea/token', undefined]])
  })
})

describe('deleteSettingValues：删条目、卸载时连设置值一起删', () => {
  const two: SettingRow[] = [
    { section: 'gitea', key: 'token', type: 'secret' },
    { section: 'gitea', key: 'base-url', type: 'string' },
  ]

  it('回执 ok:false 不算删掉', async () => {
    const outcome = await deleteSettingValues(
      async (_command, pos) => (pos.key === 'token' ? { ok: false, error: '写不进 settings.json' } : { ok: true }),
      two,
    )
    expect(outcome).toEqual({ deleted: 1, failures: ['gitea.token：写不进 settings.json'] })
  })

  it('调用抛错也记进失败项，后面的照删', async () => {
    const calls: string[] = []
    const outcome = await deleteSettingValues(
      async (command, pos) => {
        calls.push(`${command} ${pos.key}`)
        if (pos.key === 'token') throw new Error('ipc 断了')
        return { ok: true }
      },
      two,
    )
    expect(calls).toEqual(['credentials.delete token', 'settings.delete base-url'])
    expect(outcome.deleted).toBe(1)
    expect(outcome.failures).toEqual(['gitea.token：Error: ipc 断了'])
  })

  it('回执认不出也算失败', async () => {
    const outcome = await deleteSettingValues(async () => undefined, [two[0]!])
    expect(outcome.deleted).toBe(0)
    expect(outcome.failures).toHaveLength(1)
  })
})

describe('describeSettingsDeletion：拼在回执那句话后面', () => {
  it('全删掉了只说删了几项', () => {
    expect(describeSettingsDeletion({ deleted: 2, failures: [] })).toBe('，删除了 2 项设置值')
  })

  it('有失败逐项列出', () => {
    expect(describeSettingsDeletion({ deleted: 1, failures: ['gitea.token：写不进'] }).split('\n')).toEqual([
      '，删除了 1 项设置值',
      '1 项设置值没删掉（留在「没有插件声明的设置」里）：',
      'gitea.token：写不进',
    ])
  })

  it('什么都没删是空串', () => {
    expect(describeSettingsDeletion({ deleted: 0, failures: [] })).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import {
  acceptSettings,
  deleteSettingValues,
  describeSettingsDeletion,
  dirtySlots,
  fieldState,
  secretPlaceholder,
  type SettingRow,
} from '../../src/client/panes/plugin-manager/settings'

/**
 * 设置那半的纯逻辑。**这一组是 settings 0.3.0 的消费方适配**：`settings.all` 对 secret 行
 * 收口之后，那一行没有 `value` 也没有 `default`，只回 `secret` / `isSet` / 设过才有的 `mask`
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

  it('isSet 说设过了却没给掩码时兜一个——占位符不能是空的', () => {
    expect(secretPlaceholder({ isSet: true })).toBe('已设置（••••，不在此显示）')
    expect(secretPlaceholder({ isSet: true, mask: '' })).toBe('已设置（••••，不在此显示）')
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
  const two = [
    { section: 'gitea', key: 'token' },
    { section: 'gitea', key: 'base-url' },
  ]

  it('回执 ok:false 不算删掉——命令总线失败不抛，只回 ok:false', async () => {
    const outcome = await deleteSettingValues(
      async (_command, pos) => (pos.key === 'token' ? { ok: false, error: '写不进 settings.json' } : { ok: true }),
      'settings.delete',
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
      'settings.delete',
      two,
    )
    expect(calls).toEqual(['settings.delete token', 'settings.delete base-url'])
    expect(outcome.deleted).toBe(1)
    expect(outcome.failures).toEqual(['gitea.token：Error: ipc 断了'])
  })

  it('回执认不出也算失败', async () => {
    const outcome = await deleteSettingValues(async () => undefined, 'settings.delete', [two[0]!])
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

import { describe, expect, it } from 'vitest'
import { describeUpdateAll, waitForOwnRemount } from '../../src/client/panes/plugin-manager/update-all'

/** 回执 → 窗格上的几行话与接下来要不要整页重新加载。形状按插件管理 `update` 的回执收，认不出的丢掉、不崩 */

describe('describeUpdateAll', () => {
  it('升了几个包逐包一行，条目带处理结果与状态；有包升级就要整页重新加载', () => {
    const view = describeUpdateAll({
      ok: true,
      data: {
        updated: [
          {
            pkg: '@x/gwb-hello',
            from: '0.2.0',
            to: '0.2.1',
            entries: [
              { id: 'hello', action: 'remounted', state: 'ACTIVE' },
              { id: 'hello-2', action: 'skipped', state: 'disabled' },
            ],
          },
          { pkg: '@x/gwb-tokens', from: '0.0.5', to: '0.0.6', entries: [] },
        ],
        dependents: [],
        selfDeferred: false,
      },
    })
    expect(view.ok).toBe(true)
    expect(view.pageReloadNeeded).toBe(true)
    expect(view.selfDeferred).toBe(false)
    expect(view.text.split('\n')).toEqual([
      '升了 2 个包：',
      '@x/gwb-hello 0.2.0 → 0.2.1：hello（remounted，ACTIVE）、hello-2（skipped，disabled）',
      '@x/gwb-tokens 0.0.5 → 0.0.6（没有条目）',
      '接着整页重新加载界面',
    ])
  })

  it('插件管理自己也升了：说一声要等它重新加载完，再整页重新加载', () => {
    const view = describeUpdateAll({
      ok: true,
      data: { updated: [{ pkg: '@godcreator/gwb-plugin-manager', from: '0.12.1', to: '0.13.0', entries: [] }], dependents: [], selfDeferred: true },
    })
    expect(view.pageReloadNeeded).toBe(true)
    expect(view.selfDeferred).toBe(true)
    expect(view.text).toContain('插件管理自己也升级了')
    expect(view.text).toContain('等它重新加载完')
  })

  it('全都最新：显示 note，不整页重新加载', () => {
    const view = describeUpdateAll({ ok: true, data: { updated: [], dependents: [], selfDeferred: false, note: '全都最新' } })
    expect(view).toEqual({ ok: true, text: '全都最新', pageReloadNeeded: false, selfDeferred: false })
  })

  it('单个包的「更新」（only）不在过期清单里：显示 note', () => {
    const note = '全都最新；only 里这几个不在过期清单里，没动：@x/gwb-hello'
    expect(describeUpdateAll({ ok: true, data: { updated: [], dependents: [], selfDeferred: false, note } }).text).toBe(note)
  })

  it('没成：原因只在外层 error（pnpm 输出的最后几行已经拼在里面），原样显示', () => {
    const view = describeUpdateAll({
      ok: false,
      error: 'pnpm add 没成（退出码 1）。一条条目都没动\nERR_PNPM_NO_MATCHING_VERSION',
    })
    expect(view.ok).toBe(false)
    expect(view.pageReloadNeeded).toBe(false)
    expect(view.text).toBe('pnpm add 没成（退出码 1）。一条条目都没动\nERR_PNPM_NO_MATCHING_VERSION')
  })

  it('data 形状坏了也不崩', () => {
    expect(describeUpdateAll({ ok: true, data: 'nope' }).text).toBe('全都最新')
    expect(describeUpdateAll({ ok: true, data: { updated: [42, null] } }).text.split('\n')[0]).toBe('升了 2 个包：')
  })
})

const OWN_PKG = '@godcreator/gwb-plugin-manager'

function listWithOwnEntry(active: boolean): unknown {
  return {
    ok: true,
    data: [{ pkg: OWN_PKG, installed: true, entries: [{ id: 'plugin-manager', entryId: 'home:plugin-manager', disabled: false, active }] }],
  }
}

describe('waitForOwnRemount：插件管理自己的条目重新加载完才整页重新加载', () => {
  it('命令暂时不在、条目还没加载起来都接着等，加载起来就返回', async () => {
    const replies = [{ ok: false, error: '没有这条命令：plugin-manager.list' }, listWithOwnEntry(false), listWithOwnEntry(true)]
    const calls: string[] = []
    const sleeps: number[] = []
    const result = await waitForOwnRemount({
      call: async (command) => {
        calls.push(command)
        return replies.shift()
      },
      sleep: async (ms) => {
        sleeps.push(ms)
      },
      listCommand: 'plugin-manager.list',
      ownPkg: OWN_PKG,
    })
    expect(result).toEqual({ ok: true })
    expect(calls).toEqual(['plugin-manager.list', 'plugin-manager.list', 'plugin-manager.list'])
    // 先等一轮再问：回执发出后插件管理才开始重新加载，马上问会问到旧的那份
    expect(sleeps).toHaveLength(3)
  })

  it('调用抛错也接着等', async () => {
    const replies: Array<() => unknown> = [
      () => {
        throw new Error('ipc 断了')
      },
      () => listWithOwnEntry(true),
    ]
    const result = await waitForOwnRemount({
      call: async () => replies.shift()!(),
      sleep: async () => {},
      listCommand: 'plugin-manager.list',
      ownPkg: OWN_PKG,
    })
    expect(result).toEqual({ ok: true })
  })

  it('等满时限还没加载起来：回 ok:false，带上最后一次的原因', async () => {
    const result = await waitForOwnRemount({
      call: async () => ({ ok: false, error: '没有这条命令：plugin-manager.list' }),
      sleep: async () => {},
      listCommand: 'plugin-manager.list',
      ownPkg: OWN_PKG,
    })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('30 秒')
    expect(result.error).toContain('没有这条命令')
  })
})

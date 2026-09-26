import { describe, expect, it } from 'vitest'
import {
  DESKTOP_EVENT,
  afterDelete,
  defaultDesktopName,
  deleteConfirmText,
  isDesktopAction,
  parseDeleteArgs,
  parseRenameArgs,
  parseSwitchArgs,
  renameDesktop,
  resolveDesktop,
} from '../src/desktops.js'
import type { DesktopRow } from '../src/layout.js'

/**
 * 桌面纯判断：事件入口上认不认得出自己的标记、按 id / 名字找不找得到那张桌面、命令参数对不对。
 * 事件入口上什么插件的事件都有，认错一条就把别人的动作当自己的执行了。
 */

function desktop(over: Partial<DesktopRow> = {}): DesktopRow {
  return { id: 'd1', name: '桌面 1', layout: null, ...over }
}

const rows = [desktop(), desktop({ id: 'd2', name: '摸鱼' }), desktop({ id: 'd3', name: '摸鱼' })]

describe('isDesktopAction', () => {
  it('记号对得上才认，null / 原始值 / 别件的事件都不认', () => {
    expect(isDesktopAction({ t: DESKTOP_EVENT, action: 'switch', id: 'd2' })).toBe(true)
    expect(isDesktopAction({ t: DESKTOP_EVENT, action: 'new', name: '写笔记' })).toBe(true)
    expect(isDesktopAction(null)).toBe(false)
    expect(isDesktopAction('switch')).toBe(false)
    expect(isDesktopAction({ t: 'gwb-logger', line: 'x' })).toBe(false)
    expect(isDesktopAction({})).toBe(false)
  })
})

describe('resolveDesktop：id 优先于名字', () => {
  it('按 id 命中', () => {
    expect(resolveDesktop(rows, { id: 'd2' })?.id).toBe('d2')
  })

  it('id 空串 / 不是字符串不当 id 用，落到名字那条', () => {
    expect(resolveDesktop(rows, { id: '', name: '摸鱼' })?.id).toBe('d2')
    expect(resolveDesktop(rows, { id: 3, name: '摸鱼' })?.id).toBe('d2')
  })

  it('名字撞了多口取第一口——名字本来就不唯一，id 才是身份', () => {
    expect(resolveDesktop(rows, { name: '摸鱼' })?.id).toBe('d2')
  })

  it('两样都给不出（空串 / 非字符串）→ undefined：调用方什么都不做', () => {
    expect(resolveDesktop(rows, {})).toBeUndefined()
    expect(resolveDesktop(rows, { id: '', name: '' })).toBeUndefined()
    expect(resolveDesktop(rows, { id: 1, name: 2 })).toBeUndefined()
  })

  it('给得出但认不出（id / 名字都不在表里）→ undefined', () => {
    expect(resolveDesktop(rows, { id: 'd9' })).toBeUndefined()
    expect(resolveDesktop(rows, { name: '不存在' })).toBeUndefined()
  })
})

describe('renameDesktop：改名', () => {
  it('按 id 改名，名字两头的空白去掉；别的桌面不动', () => {
    expect(renameDesktop(rows, 'd2', '  写作 ')).toEqual([rows[0], { ...rows[1], name: '写作' }, rows[2]])
  })
  it('空名（含纯空白）不改：回 undefined，调用方什么都不做', () => {
    expect(renameDesktop(rows, 'd2', '   ')).toBeUndefined()
  })
  it('认不出的 id 回 undefined', () => {
    expect(renameDesktop(rows, 'd9', '写作')).toBeUndefined()
  })
})

describe('afterDelete：删掉一张之后切到哪张', () => {
  it('删的是中间那张 → 左边相邻那张', () => {
    expect(afterDelete(rows, 'd2')).toBe('d1')
  })
  it('删的是最左边那张 → 右边那张', () => {
    expect(afterDelete(rows, 'd1')).toBe('d2')
  })
  it('只剩一张：删不了，回 undefined', () => {
    expect(afterDelete([desktop()], 'd1')).toBeUndefined()
  })
  it('认不出的 id 回 undefined', () => {
    expect(afterDelete(rows, 'd9')).toBeUndefined()
  })
})

describe('deleteConfirmText：删桌面一律先确认，确认框里写什么', () => {
  it('上面有窗格：点名会一起关掉几个', () => {
    expect(deleteConfirmText('写作', 3)).toEqual({ title: '删除『写作』？', description: '上面 3 个窗格会一起关掉。' })
  })
  it('空桌面也确认，只是不提窗格', () => {
    expect(deleteConfirmText('写作', 0)).toEqual({ title: '删除『写作』？', description: '这张桌面是空的。' })
  })
})

describe('命令参数：switch / rename / delete', () => {
  it('switch 要 id 或 name，两个都给按 id；给了的那项不是非空字符串就回错', () => {
    expect(parseSwitchArgs({ id: 'd2' })).toEqual({ ok: true, by: { id: 'd2' } })
    expect(parseSwitchArgs({ name: '摸鱼' })).toEqual({ ok: true, by: { name: '摸鱼' } })
    expect(parseSwitchArgs({ id: 'd2', name: '摸鱼' })).toEqual({ ok: true, by: { id: 'd2' } })
    expect(parseSwitchArgs({})).toEqual({ ok: false, error: 'id 与 name 至少给一个' })
    expect(parseSwitchArgs(undefined)).toEqual({ ok: false, error: 'id 与 name 至少给一个' })
    for (const args of [{ id: 3, name: '摸鱼' }, { id: '', name: '摸鱼' }, { id: 'd2', name: 2 }, { name: '' }, null, 'd2', ['d2']]) {
      expect(parseSwitchArgs(args)).toMatchObject({ ok: false })
    }
  })

  it('rename 要 id 与非空名字', () => {
    expect(parseRenameArgs({ id: 'd2', name: ' 写作 ' })).toEqual({ ok: true, id: 'd2', name: '写作' })
    expect(parseRenameArgs({ id: 'd2', name: '  ' })).toMatchObject({ ok: false })
    expect(parseRenameArgs({ name: '写作' })).toMatchObject({ ok: false })
    expect(parseRenameArgs(null)).toMatchObject({ ok: false })
  })
  it('delete 要 id', () => {
    expect(parseDeleteArgs({ id: 'd2' })).toEqual({ ok: true, id: 'd2' })
    expect(parseDeleteArgs({ id: '' })).toMatchObject({ ok: false })
    expect(parseDeleteArgs(undefined)).toMatchObject({ ok: false })
  })
})

describe('defaultDesktopName', () => {
  it('跟 id 的号走', () => {
    expect(defaultDesktopName('d1')).toBe('桌面 1')
    expect(defaultDesktopName('d12')).toBe('桌面 12')
  })
})

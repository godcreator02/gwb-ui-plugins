import { describe, expect, it } from 'vitest'
import { PANE_EVENT, isPaneAction, listRowsOf, parsePaneArgs, parsePaneSync } from '../src/pane-actions.js'
import type { PaneEntry } from '../src/pane-list.js'

/**
 * 窗格命令那半的纯判断：`shell.pane.focus / send / close` 的参数门与转给页面的动作、
 * 页面推给 node 半缓存的清单、`shell.pane.list` 回的那几行。
 */

describe('isPaneAction', () => {
  it('记号对得上才认', () => {
    expect(isPaneAction({ t: PANE_EVENT, action: 'focus', instance: 'x' })).toBe(true)
    expect(isPaneAction({ t: 'gwb-shell-desktop', action: 'switch' })).toBe(false)
    expect(isPaneAction(null)).toBe(false)
  })
})

describe('parsePaneArgs', () => {
  it('focus / close 只要 instance', () => {
    expect(parsePaneArgs('focus', { instance: 'plugin:home:x:doc' })).toEqual({
      ok: true,
      action: { t: PANE_EVENT, action: 'focus', instance: 'plugin:home:x:doc' },
    })
    expect(parsePaneArgs('close', { instance: '' })).toMatchObject({ ok: false })
    expect(parsePaneArgs('close', null)).toMatchObject({ ok: false })
  })

  it('send：desktop 与 newDesktop 给且只给一个；newDesktop 是新桌面的名字（空串或 true 用缺省名）；follow 只认 true', () => {
    expect(parsePaneArgs('send', { instance: 'i', desktop: 'd2' })).toEqual({
      ok: true,
      action: { t: PANE_EVENT, action: 'send', instance: 'i', desktop: 'd2' },
    })
    expect(parsePaneArgs('send', { instance: 'i', newDesktop: '写作', follow: true })).toEqual({
      ok: true,
      action: { t: PANE_EVENT, action: 'send', instance: 'i', newDesktop: '写作', follow: true },
    })
    expect(parsePaneArgs('send', { instance: 'i', newDesktop: true })).toEqual({
      ok: true,
      action: { t: PANE_EVENT, action: 'send', instance: 'i', newDesktop: '' },
    })
    expect(parsePaneArgs('send', { instance: 'i' })).toMatchObject({ ok: false })
    expect(parsePaneArgs('send', { instance: 'i', desktop: 'd2', newDesktop: 'x' })).toMatchObject({ ok: false })
    expect(parsePaneArgs('send', { instance: 'i', desktop: 'd2', follow: 'yes' })).toMatchObject({ ok: false })
  })
})

const entry = (over: Partial<PaneEntry> = {}): PaneEntry => ({
  instance: 'plugin:home:x:doc',
  desktop: 'd1',
  group: '1',
  pkg: '@x/x',
  entryId: 'home:x',
  paneId: 'doc',
  key: 'k',
  title: '文档',
  icon: 'book',
  preview: false,
  active: true,
  ...over,
})

describe('parsePaneSync：页面推来的清单先过一道门', () => {
  it('认得出的原样收下', () => {
    const payload = { entries: [entry()], desktops: [{ id: 'd1', name: '桌面 1' }], active: 'd1' }
    expect(parsePaneSync(payload)).toEqual(payload)
  })
  it('形状不对就不收（缓存保持上一份）', () => {
    expect(parsePaneSync({ entries: 'x', desktops: [], active: 'd1' })).toBeUndefined()
    expect(parsePaneSync({ entries: [{ instance: 3 }], desktops: [], active: 'd1' })).toBeUndefined()
    expect(parsePaneSync(null)).toBeUndefined()
  })
})

describe('listRowsOf：shell.pane.list 回的那几行', () => {
  it('每行带上 kind（问注册表），只留 spec 写的那几格', () => {
    const rows = listRowsOf([entry(), entry({ instance: 'y', paneId: 'tools' })], (entryId, paneId) =>
      paneId === 'doc' ? 'document' : 'tool',
    )
    expect(rows).toEqual([
      {
        instance: 'plugin:home:x:doc',
        desktop: 'd1',
        group: '1',
        pkg: '@x/x',
        entryId: 'home:x',
        paneId: 'doc',
        kind: 'document',
        key: 'k',
        title: '文档',
        preview: false,
        active: true,
      },
      expect.objectContaining({ instance: 'y', kind: 'tool' }),
    ])
  })
})

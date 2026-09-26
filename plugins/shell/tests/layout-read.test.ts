import { describe, expect, it } from 'vitest'
import { LAYOUT_VERSION, defaultDoc, initialLayoutOf } from '../src/layout.js'

/**
 * 开机读布局文件：只有「文件不存在」（shell.layout.get 回 ok 且 data 是 undefined）才从默认布局开始并照常保存。
 * 调不通、回失败、认不出都得停止保存——按默认布局打开之后排的那次防抖保存会把磁盘上真正的布局覆盖掉。
 */

const grid = { grid: { root: { type: 'branch', data: [] } }, panels: {} }
const goodDoc = { v: LAYOUT_VERSION, active: 'd2', desktops: [{ id: 'd1', name: '甲', layout: grid }, { id: 'd2', name: '乙', layout: null }], saved: [] }

function fulfilled(value: unknown): PromiseSettledResult<unknown> {
  return { status: 'fulfilled', value }
}

describe('initialLayoutOf', () => {
  it('文件不存在（data 是 undefined 或没有这一项）：默认布局，照常保存', () => {
    expect(initialLayoutOf(fulfilled({ ok: true, data: undefined }))).toEqual({ doc: defaultDoc() })
    expect(initialLayoutOf(fulfilled({ ok: true }))).toEqual({ doc: defaultDoc() })
  })

  it('读到一份认得出的：原样用，照常保存', () => {
    expect(initialLayoutOf(fulfilled({ ok: true, data: goodDoc }))).toEqual({ doc: goodDoc })
  })

  it('IPC 调不通：默认布局，但停止保存，原因带上报错', () => {
    const result = initialLayoutOf({ status: 'rejected', reason: new Error('管道断了') })
    expect(result.doc).toEqual(defaultDoc())
    expect(result.saveBlockedBy).toContain('调不通')
    expect(result.saveBlockedBy).toContain('管道断了')
  })

  it('命令回失败：停止保存，原因带上回执里的 error', () => {
    const result = initialLayoutOf(fulfilled({ ok: false, error: '没有这条命令：shell.layout.get' }))
    expect(result.doc).toEqual(defaultDoc())
    expect(result.saveBlockedBy).toContain('没有这条命令')
  })

  it('回的不是回执：停止保存', () => {
    expect(initialLayoutOf(fulfilled(undefined)).saveBlockedBy).toBeDefined()
    expect(initialLayoutOf(fulfilled('oops')).saveBlockedBy).toBeDefined()
  })

  it('版本认不出（将来的版本、老的 v1 与 v2）、形状坏、内容是 null：停止保存，原因里写明版本', () => {
    for (const data of [
      { ...goodDoc, v: LAYOUT_VERSION + 1 },
      { ...goodDoc, v: 1 },
      { v: 2, current: grid, saved: [] },
      { ...goodDoc, desktops: [] },
      { ...goodDoc, active: 'd9' },
      null,
      42,
    ]) {
      const result = initialLayoutOf(fulfilled({ ok: true, data }))
      expect(result.doc).toEqual(defaultDoc())
      expect(result.saveBlockedBy).toContain('认不出')
    }
    expect(initialLayoutOf(fulfilled({ ok: true, data: { ...goodDoc, v: 9 } })).saveBlockedBy).toContain('v=9')
    expect(initialLayoutOf(fulfilled({ ok: true, data: { ...goodDoc, v: 9 } })).saveBlockedBy).toContain(`只认 v${String(LAYOUT_VERSION)}`)
  })
})

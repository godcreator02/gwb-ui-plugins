import { describe, expect, it } from 'vitest'
import { acceptQueryPage, asResult, readQueryReply } from '../../src/client/panes/logger/receipts'

const ENTRY = { ts: '2026-09-27T01:02:03.004Z', level: 'warn', source: 'kernel', name: 'loader', msg: '在等' }

describe('asResult：日志窗格收命令回执', () => {
  it('ok:true 照收 data', () => {
    expect(asResult({ ok: true, data: [1] })).toEqual({ ok: true, data: [1] })
  })

  it('ok 不是 true 就是失败，原因原样带上', () => {
    expect(asResult({ ok: false, error: '命令不存在：logger.query' })).toEqual({
      ok: false,
      error: '命令不存在：logger.query',
    })
  })

  it('失败却没给原因，也要有一句话', () => {
    expect(asResult({ ok: false })).toEqual({ ok: false, error: '命令失败，没有给出原因' })
    expect(asResult({ ok: false, error: '' })).toEqual({ ok: false, error: '命令失败，没有给出原因' })
  })

  it('回执不是对象算失败，说清收到的是什么', () => {
    expect(asResult(undefined)).toEqual({ ok: false, error: '命令返回了认不出的值：undefined' })
    expect(asResult(null)).toEqual({ ok: false, error: '命令返回了认不出的值：null' })
    expect(asResult([])).toEqual({ ok: false, error: '命令返回了认不出的值：array' })
  })
})

describe('acceptQueryPage：logger.query 的 data', () => {
  it('三项都对时照收', () => {
    expect(acceptQueryPage({ file: 'D:/home/gwb.log', cursor: 4096, entries: [ENTRY] })).toEqual({
      file: 'D:/home/gwb.log',
      cursor: 4096,
      entries: [ENTRY],
    })
  })

  it('cursor 是 0、entries 是空数组都合法', () => {
    expect(acceptQueryPage({ file: 'D:/home/gwb.log', cursor: 0, entries: [] }).entries).toEqual([])
  })

  it('整份不是对象、缺一项、类型不对都抛错，写明是哪一项', () => {
    expect(() => acceptQueryPage(undefined)).toThrow(/要是对象/)
    expect(() => acceptQueryPage({ cursor: 0, entries: [] })).toThrow(/file/)
    expect(() => acceptQueryPage({ file: 'x', entries: [] })).toThrow(/cursor/)
    expect(() => acceptQueryPage({ file: 'x', cursor: 0 })).toThrow(/要是数组/)
  })

  it('cursor 是字节长度：负数、小数、字符串都不收', () => {
    for (const cursor of [-1, 1.5, '12', Number.NaN]) {
      expect(() => acceptQueryPage({ file: 'x', cursor, entries: [] })).toThrow(/cursor/)
    }
  })

  it('entries 里有一条不对，整份抛错', () => {
    expect(() => acceptQueryPage({ file: 'x', cursor: 0, entries: [{ ...ENTRY, level: 'trace' }] })).toThrow(/level/)
  })
})

describe('readQueryReply：整份回执到一页日志', () => {
  it('成功就收窄 data', () => {
    const page = readQueryReply({ ok: true, data: { file: 'x', cursor: 7, entries: [ENTRY] } })
    expect(page.cursor).toBe(7)
  })

  it('失败就把原因抛出来——日志插件没装时窗格里显示的就是这句', () => {
    expect(() => readQueryReply({ ok: false, error: '命令不存在：logger.query' })).toThrow('命令不存在：logger.query')
  })
})

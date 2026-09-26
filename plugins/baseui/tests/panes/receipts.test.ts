import { describe, expect, it } from 'vitest'
import { acceptWhere, asResult } from '../../src/client/panes/logger/receipts'

describe('asResult：日志窗格收命令回执', () => {
  it('ok:true 照收 data', () => {
    expect(asResult({ ok: true, data: [1] })).toEqual({ ok: true, data: [1] })
  })

  it('ok 不是 true 就是失败，原因原样带上', () => {
    expect(asResult({ ok: false, error: '命令不存在：logger.backlog' })).toEqual({
      ok: false,
      error: '命令不存在：logger.backlog',
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

describe('acceptWhere：logger.where 的 data', () => {
  it('两项都是字符串时照收', () => {
    expect(acceptWhere({ home: 'D:/home', logFile: 'D:/home/gwb.log' })).toEqual({
      home: 'D:/home',
      logFile: 'D:/home/gwb.log',
    })
  })

  it('缺一项、类型不对、整份不是对象都抛错，写明是哪一项', () => {
    expect(() => acceptWhere({ home: 'D:/home' })).toThrow(/logFile/)
    expect(() => acceptWhere({ home: 7, logFile: 'x' })).toThrow(/home/)
    expect(() => acceptWhere(undefined)).toThrow(/要是对象/)
  })
})

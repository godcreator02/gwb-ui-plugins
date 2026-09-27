import { describe, expect, it } from 'vitest'
import { acceptEntries, appendRows, clockOf, type LogEntry } from '../../src/client/panes/logger/entries'

const entry = (index: number, patch: Partial<LogEntry> = {}): LogEntry => ({
  ts: new Date(Date.UTC(2026, 8, 27, 1, 2, 3, index)).toISOString(),
  level: 'info',
  source: 'plugin',
  name: 'gwb-cli',
  msg: `第 ${String(index)} 条`,
  ...patch,
})

describe('acceptEntries：logger.query 回执里的 entries', () => {
  it('每条都对就原样收下，顺序不变', () => {
    const got = acceptEntries([entry(1), entry(2, { source: 'kernel', level: 'error' })])
    expect(got).toEqual([entry(1), entry(2, { source: 'kernel', level: 'error' })])
  })

  it('空串名字与空消息是合法的', () => {
    expect(acceptEntries([entry(1, { name: '', msg: '' })])).toHaveLength(1)
  })

  it('整份不是数组就抛错——当成空数组，界面会把「取失败」说成「还没有日志」', () => {
    expect(() => acceptEntries(undefined)).toThrow(/要是数组/)
    expect(() => acceptEntries({ ts: 'x' })).toThrow(/要是数组/)
    expect(() => acceptEntries(null)).toThrow(/null/)
  })

  it('有一条形状不对就整批抛错，写明第几条、哪一项', () => {
    expect(() => acceptEntries([entry(1), null])).toThrow(/第 2 条/)
    for (const key of ['ts', 'level', 'source', 'name', 'msg']) {
      const partial: Record<string, unknown> = { ...entry(1) }
      delete partial[key]
      expect(() => acceptEntries([partial])).toThrow(new RegExp(key))
    }
  })

  it('level 与 source 只认那两张表里的', () => {
    expect(() => acceptEntries([{ ...entry(1), level: 'trace' }])).toThrow(/level/)
    expect(() => acceptEntries([{ ...entry(1), source: 'host' }])).toThrow(/source/)
  })

  it('ts 要是能解析的时间字符串，数字时间戳也不收', () => {
    expect(() => acceptEntries([{ ...entry(1), ts: '不是时间' }])).toThrow(/ts/)
    expect(() => acceptEntries([{ ...entry(1), ts: 1000 }])).toThrow(/ts/)
  })
})

describe('appendRows：新条目接到列表后面', () => {
  it('接在后面，行键从上一行往后数', () => {
    const first = appendRows([], [entry(1), entry(2)], 10)
    expect(first.map((row) => row.rowKey)).toEqual([0, 1])
    const second = appendRows(first, [entry(3)], 10)
    expect(second.map((row) => row.rowKey)).toEqual([0, 1, 2])
    expect(second[2]).toMatchObject(entry(3))
  })

  it('**内容一样的两条都留着**——同一毫秒两句一样的话是常事，不按内容去重', () => {
    const same = entry(1, { msg: '同一句' })
    expect(appendRows([], [same, same], 10)).toHaveLength(2)
  })

  it('超过上限从头丢，留最新那些，行键不重复使用', () => {
    const got = appendRows(appendRows([], [entry(1), entry(2)], 3), [entry(3), entry(4)], 3)
    expect(got.map((row) => row.msg)).toEqual(['第 2 条', '第 3 条', '第 4 条'])
    expect(got.map((row) => row.rowKey)).toEqual([1, 2, 3])
  })

  it('没有新的就原样返回，不白造一个数组', () => {
    const prev = appendRows([], [entry(1)], 10)
    expect(appendRows(prev, [], 10)).toBe(prev)
  })
})

describe('clockOf：行首时刻', () => {
  it('按本地时区显示到毫秒，补零', () => {
    expect(clockOf(new Date(2026, 8, 7, 9, 5, 3, 7).toISOString())).toBe('09:05:03.007')
  })
})

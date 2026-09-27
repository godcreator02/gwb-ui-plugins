import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startLogPoller } from '../../src/client/panes/logger/poller'
import type { LogPage } from '../../src/client/panes/logger/receipts'

const INTERVAL = 1000

const page = (cursor: number): LogPage => ({ file: 'D:/home/gwb.log', cursor, entries: [] })

/** 替身 fetchPage：记下每次的 after，按调用顺序交回事先排好的结果 */
function scriptedFetch(results: (LogPage | Error)[]) {
  const afters: (number | undefined)[] = []
  const fetchPage = (after: number | undefined): Promise<LogPage> => {
    afters.push(after)
    const next = results.shift()
    if (next === undefined) return Promise.resolve(page(after ?? 0))
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }
  return { afters, fetchPage }
}

function start(results: (LogPage | Error)[]) {
  const fetch = scriptedFetch(results)
  const pages: LogPage[] = []
  const failures: string[] = []
  const poller = startLogPoller({
    fetchPage: fetch.fetchPage,
    onPage: (p) => pages.push(p),
    onFailure: (reason) => failures.push(reason),
    intervalMs: INTERVAL,
  })
  return { poller, afters: fetch.afters, pages, failures }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startLogPoller：可见时拉取', () => {
  it('一启动就不带 after 取一次，之后带上回执里的 cursor', async () => {
    const { poller, afters, pages } = start([page(100), page(250)])
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(afters).toEqual([undefined])
    expect(pages.map((p) => p.cursor)).toEqual([100])
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(afters).toEqual([undefined, 100])
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(afters).toEqual([undefined, 100, 250])
    poller.stop()
  })

  it('不可见时只有启动那一次，之后一次都不调', async () => {
    const { poller, afters } = start([page(100)])
    poller.setVisible(false)
    await vi.advanceTimersByTimeAsync(INTERVAL * 5)
    expect(afters).toEqual([undefined])
    poller.stop()
  })

  it('切走就停，切回立刻拉一次再接着每秒拉', async () => {
    const { poller, afters } = start([page(100), page(200), page(300), page(400)])
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(afters).toEqual([undefined, 100])
    poller.setVisible(false)
    await vi.advanceTimersByTimeAsync(INTERVAL * 5)
    expect(afters).toEqual([undefined, 100])
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(afters).toEqual([undefined, 100, 200])
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(afters).toEqual([undefined, 100, 200, 300])
    poller.stop()
  })

  it('上一次还没回来时不叠着发，回来之后才排下一次', async () => {
    let release: (value: LogPage) => void = () => undefined
    const afters: (number | undefined)[] = []
    const poller = startLogPoller({
      fetchPage: (after) => {
        afters.push(after)
        return new Promise<LogPage>((resolve) => {
          release = resolve
        })
      },
      onPage: () => undefined,
      onFailure: () => undefined,
      intervalMs: INTERVAL,
    })
    poller.setVisible(true)
    poller.setVisible(false)
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(INTERVAL * 3)
    expect(afters).toEqual([undefined])
    release(page(100))
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(afters).toEqual([undefined, 100])
    poller.stop()
  })

  it('失败报原因、cursor 不动，下一秒照样再试', async () => {
    const { poller, afters, failures } = start([page(100), new Error('命令不存在：logger.query'), page(300)])
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(failures).toEqual(['命令不存在：logger.query'])
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(afters).toEqual([undefined, 100, 100])
    poller.stop()
  })

  it('启动那次就失败：下一次仍不带 after，等于重新取最近的一批', async () => {
    const { poller, afters, failures } = start([new Error('没装日志插件'), page(100)])
    poller.setVisible(true)
    await vi.advanceTimersByTimeAsync(INTERVAL)
    expect(failures).toEqual(['没装日志插件'])
    expect(afters).toEqual([undefined, undefined])
    poller.stop()
  })

  it('stop 之后回来的结果不再交出去，也不再排下一次', async () => {
    const { poller, afters, pages } = start([page(100)])
    poller.setVisible(true)
    poller.stop()
    await vi.advanceTimersByTimeAsync(INTERVAL * 3)
    expect(afters).toEqual([undefined])
    expect(pages).toEqual([])
  })
})

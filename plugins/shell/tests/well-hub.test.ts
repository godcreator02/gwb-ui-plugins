import { describe, expect, it } from 'vitest'
import { createWellHub } from '../src/client/well-hub.js'
import type { DockviewApi } from 'dockview-react'
import type { PanelLike } from '../src/panels.js'

/**
 * 全井枢纽的账本：井的进出、活动桌面的同拍语义、全井聚合的两条查询、
 * 命令口与两个注入钩子的收放。假井只喂 `panels` / `getPanel` 那一格形状。
 */

/** 一口假井：panels 全量摆着，getPanel 按 id 找 */
function fakeWell(rows: (PanelLike & { id: string })[]): DockviewApi {
  return {
    panels: rows,
    getPanel: (id: string) => rows.find((row) => row.id === id),
  } as unknown as DockviewApi
}

/** 一格插件窗格的 params 三件套 */
function pane(id: string, extra: Record<string, unknown> = {}): PanelLike & { id: string } {
  return {
    id,
    view: { contentComponent: 'plugin' },
    params: { pluginKey: 'pkg', entryId: 'e1', paneId: 'main', ...extra },
  }
}

const who = { entryId: 'e1', paneId: 'main' }

describe('井的进出', () => {
  it('挂上就查得到，clearWells 全拆且活动桌面归零', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([]))
    hub.setActiveDesktop('d1')
    expect(hub.wells().size).toBe(1)
    hub.clearWells()
    expect(hub.wells().size).toBe(0)
    expect(hub.activeDesktop()).toBe('')
  })
})

describe('活动桌面的同拍语义', () => {
  it('setActiveDesktop 之后当场读到新值，不等下一拍', () => {
    const hub = createWellHub()
    hub.setActiveDesktop('d2')
    expect(hub.activeDesktop()).toBe('d2')
  })
})

describe('openInstances：全井聚合', () => {
  it('同一格开在两口井都算，别桌的份带 here:false', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([pane('plugin:e1:main', { key: 'a' })]))
    hub.addWell('d2', fakeWell([pane('plugin:e1:main:2', { key: 'b' })]))
    hub.setActiveDesktop('d1')
    expect(hub.openInstances(who)).toEqual([
      { id: 'plugin:e1:main', key: 'a', preview: false },
      { id: 'plugin:e1:main:2', key: 'b', preview: false, here: false },
    ])
  })

  it('只装同一格的份——别的条目、别的窗格都不进表', () => {
    const hub = createWellHub()
    hub.addWell(
      'd1',
      fakeWell([
        pane('plugin:e1:main'),
        pane('plugin:e1:other', { paneId: 'other' }),
        { id: 'nav', view: { contentComponent: 'nav' } },
      ]),
    )
    expect(hub.openInstances(who).map((p) => p.id)).toEqual(['plugin:e1:main'])
  })

  it('预览格认得出来', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([pane('plugin:e1:main', { preview: true })]))
    expect(hub.openInstances(who)[0]?.preview).toBe(true)
  })
})

describe('takenAnywhere：实例 id 全页唯一', () => {
  it('别的井里占着也算占', () => {
    const hub = createWellHub()
    hub.addWell('d1', fakeWell([]))
    hub.addWell('d2', fakeWell([pane('plugin:e1:main:2')]))
    expect(hub.takenAnywhere('plugin:e1:main')).toBe(false)
    expect(hub.takenAnywhere('plugin:e1:main:2')).toBe(true)
  })
})

describe('命令口与注入钩子', () => {
  it('releaseHost 只收自己那份——新壳先挂、旧壳后收，不能把新的清掉', () => {
    const hub = createWellHub()
    const first = { call: async () => undefined }
    const second = { call: async () => undefined }
    hub.setHost(first)
    hub.releaseHost(second)
    expect(hub.host()).toBe(first)
    hub.releaseHost(first)
    expect(hub.host()).toBeUndefined()
  })

  it('flush 扳的是最新的那个钩子，摘了之后再扳是空操作', () => {
    const hub = createWellHub()
    const calls: string[] = []
    hub.setFlusher(() => calls.push('one'))
    hub.flush()
    hub.setFlusher(() => calls.push('two'))
    hub.flush()
    hub.setFlusher(undefined)
    hub.flush()
    expect(calls).toEqual(['one', 'two'])
  })

  it('switcher 摘了之后是 undefined', () => {
    const hub = createWellHub()
    hub.setSwitcher(() => undefined)
    expect(hub.switcher()).toBeTypeOf('function')
    hub.setSwitcher(undefined)
    expect(hub.switcher()).toBeUndefined()
  })
})

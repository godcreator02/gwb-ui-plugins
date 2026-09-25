import { describe, expect, it } from 'vitest'
import { wellBootPlan } from '../src/layout.js'

/**
 * 容器挂载时开不开默认布局、要不要保存。开默认布局的那几次 addPanel 发生在订阅 onDidLayoutChange 之前，
 * dockview 丢弃订阅之前触发的布局变化，所以开了默认布局就得自己排一次保存——否则第一次开机的布局
 * 要等到人动一下窗格才写进磁盘（收件页 2026-09-13，隔离 home 上实测）。
 */
describe('wellBootPlan', () => {
  it('第一次开机（没有保存的布局、不是运行时新建的桌面）：开默认布局，并排一次防抖保存', () => {
    expect(wellBootPlan({ restored: false, bornEmpty: false })).toEqual({ openDefaults: true, save: 'debounced' })
  })

  it('保存的布局恢复成功：不开默认布局、不保存——磁盘上就是这一份', () => {
    expect(wellBootPlan({ restored: true, bornEmpty: false })).toEqual({ openDefaults: false, save: 'none' })
  })

  it('运行时新建的桌面：保持为空，立刻保存一次，用空快照替换文件里的 null', () => {
    expect(wellBootPlan({ restored: false, bornEmpty: true })).toEqual({ openDefaults: false, save: 'now' })
  })
})

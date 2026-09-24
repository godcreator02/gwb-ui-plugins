import { describe, expect, it } from 'vitest'
import { versionCell, versionsOf } from '../src/versions.js'

const runtime = { electron: '44.1.1', node: '24.19.0', chrome: '140.0.7339.80' }
const manifest = JSON.stringify({ name: '@godcreator/gwb-shell', version: '0.14.0', type: 'module' })

describe('versionsOf', () => {
  it('内核版与安装包版原样取 gwbKernel、外壳版取本包清单的 version、运行时三项照抄', () => {
    expect(versionsOf({ version: '0.5.1', launcherVersion: '0.3.1' }, manifest, runtime)).toEqual({
      kernel: '0.5.1',
      launcher: '0.3.1',
      shell: '0.14.0',
      electron: '44.1.1',
      node: '24.19.0',
      chrome: '140.0.7339.80',
    })
  })

  it('gwbKernel 没有 launcherVersion（从源码启动内核或旧安装包）：回执里没有 launcher 这一项', () => {
    const versions = versionsOf({ version: '0.5.1' }, manifest, runtime)
    expect(versions).not.toHaveProperty('launcher')
    expect(versions.kernel).toBe('0.5.1')
  })
})

describe('versionCell', () => {
  it('状态栏上写安装包与内核两个版本：gwb-electron 与 gwb-kernel', () => {
    const cell = versionCell({ kernel: '0.5.1', launcher: '0.3.1', shell: '0.14.0', ...runtime })
    expect(cell.label).toBe('gwb-electron 0.3.1 · gwb-kernel 0.5.1')
  })

  it('悬停五行：安装包、内核、外壳、Electron 与 Node 同一行、Chromium', () => {
    const cell = versionCell({ kernel: '0.5.1', launcher: '0.3.1', shell: '0.14.0', ...runtime })
    expect(cell.title.split('\n')).toEqual([
      'gwb-electron 0.3.1（安装包）',
      'gwb-kernel 0.5.1（内核）',
      '外壳 0.14.0',
      'Electron 44.1.1 · Node 24.19.0',
      'Chromium 140.0.7339.80',
    ])
  })

  it('没有安装包版本：状态栏写「未知」，悬停提示说明是哪两种情况', () => {
    const cell = versionCell({ kernel: '0.5.1', shell: '0.14.0', ...runtime })
    expect(cell.label).toBe('gwb-electron 未知 · gwb-kernel 0.5.1')
    expect(cell.title.split('\n')[0]).toBe('gwb-electron 未知：内核是从源码启动的，或安装包早于 0.3.1')
  })
})

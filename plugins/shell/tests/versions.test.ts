import { describe, expect, it } from 'vitest'
import { versionCell, versionsOf } from '../src/versions.js'

const runtime = { electron: '44.1.1', node: '24.19.0', chrome: '140.0.7339.80' }
const manifest = JSON.stringify({ name: '@godcreator/gwb-shell', version: '0.14.0', type: 'module' })

describe('versionsOf', () => {
  it('内核版原样取 gwbKernel、外壳版取本包清单的 version、运行时三项照抄', () => {
    expect(versionsOf({ version: '0.7.1' }, manifest, runtime)).toEqual({
      kernel: '0.7.1',
      shell: '0.14.0',
      electron: '44.1.1',
      node: '24.19.0',
      chrome: '140.0.7339.80',
    })
  })
})

describe('versionCell', () => {
  it('状态栏上只写内核版本：gwb-kernel', () => {
    const cell = versionCell({ kernel: '0.7.1', shell: '0.14.0', ...runtime })
    expect(cell.label).toBe('gwb-kernel 0.7.1')
  })

  it('悬停四行：内核、外壳、Electron 与 Node 同一行、Chromium', () => {
    const cell = versionCell({ kernel: '0.7.1', shell: '0.14.0', ...runtime })
    expect(cell.title.split('\n')).toEqual([
      'gwb-kernel 0.7.1（内核）',
      '外壳 0.14.0',
      'Electron 44.1.1 · Node 24.19.0',
      'Chromium 140.0.7339.80',
    ])
  })
})

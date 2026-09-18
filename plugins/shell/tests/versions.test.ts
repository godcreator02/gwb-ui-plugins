import { describe, expect, it } from 'vitest'
import { versionCell, versionsOf } from '../src/versions.js'

const runtime = { electron: '44.1.1', node: '24.19.0', chrome: '140.0.7339.80' }

describe('versionsOf', () => {
  it('内核版原样、外壳版取本包清单的 version、运行时三格照抄', () => {
    const manifest = JSON.stringify({ name: '@godcreator/gwb-shell', version: '0.9.0', type: 'module' })
    expect(versionsOf('0.2.5', manifest, runtime)).toEqual({
      kernel: '0.2.5',
      shell: '0.9.0',
      electron: '44.1.1',
      node: '24.19.0',
      chrome: '140.0.7339.80',
    })
  })
})

describe('versionCell', () => {
  const cell = versionCell({ kernel: '0.2.5', shell: '0.9.0', ...runtime })

  it('格子上只写产品版本：gwb 加内核版', () => {
    expect(cell.label).toBe('gwb 0.2.5')
  })

  it('悬停四行：内核、外壳、Electron 与 Node 同一行、Chromium', () => {
    expect(cell.title.split('\n')).toEqual([
      '内核 0.2.5',
      '外壳 0.9.0',
      'Electron 44.1.1 · Node 24.19.0',
      'Chromium 140.0.7339.80',
    ])
  })
})

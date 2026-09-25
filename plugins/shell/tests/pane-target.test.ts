import { describe, expect, it } from 'vitest'
import { paneTargetIn } from '../src/client/panes.js'
import type { PaneRow } from '../src/client/types.js'

/**
 * 挂载窗格时按 (entryId, 窗格 id) 查当场取到的注册表。窗格容器上的 `data-gwb-plugin` 用这里回的 `pkg`：
 * 布局文件里保存的 `pluginKey` 是开窗格那一刻的包名，包改名之后 entryId 不变、窗格照样挂载，那份旧名却一直留着。
 */

const row = (over: Partial<PaneRow>): PaneRow => ({
  id: 'main',
  title: '单元',
  kind: 'tool',
  entryId: 'home:unit-folder',
  pkg: '@godcreator/gwb-unit-folder',
  client: 'file:///D:/home/node_modules/@godcreator/gwb-unit-folder/dist/client.js',
  ...over,
})

describe('paneTargetIn', () => {
  it('回注册表里的当前包名、地址与窗格类型', () => {
    const rows = [row({ style: 'file:///D:/home/node_modules/@godcreator/gwb-unit-folder/dist/style.css' })]
    expect(paneTargetIn(rows, 'home:unit-folder', 'main')).toEqual({
      pkg: '@godcreator/gwb-unit-folder',
      client: 'file:///D:/home/node_modules/@godcreator/gwb-unit-folder/dist/client.js',
      style: 'file:///D:/home/node_modules/@godcreator/gwb-unit-folder/dist/style.css',
      kind: 'tool',
    })
  })

  it('按 entryId 与窗格 id 一起查，同一条目的别的窗格不算', () => {
    const rows = [row({ id: 'other', kind: 'document' }), row({})]
    expect(paneTargetIn(rows, 'home:unit-folder', 'main').kind).toBe('tool')
  })

  it('没有 style 时回执里 style 是 undefined', () => {
    expect(paneTargetIn([row({})], 'home:unit-folder', 'main').style).toBeUndefined()
  })

  it('注册表里没有这个窗格就抛错', () => {
    expect(() => paneTargetIn([row({})], 'home:unit-folder', 'gone')).toThrow('注册表里没有条目 home:unit-folder 的窗格 gone')
  })

  it('注册时没给 client 就抛错，错误里写的是注册表里的包名', () => {
    const rows = [row({ client: undefined })]
    expect(() => paneTargetIn(rows, 'home:unit-folder', 'main')).toThrow('@godcreator/gwb-unit-folder 注册窗格 main 时没报浏览器侧的地址（client）')
  })
})

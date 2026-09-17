import { describe, expect, it } from 'vitest'
import { mountWhenReady, type MountedTree } from '../src/client/shell-mount.js'

/**
 * 外壳树的挂与拆。要钉住的是换壳时内核页面根的顺序：调旧壳 `dispose()`，紧接着
 * `root.textContent = ''`。拆树若落在清空之后，React 去 removeChild 的节点已经不在
 * 容器里，渲染层报 `NotFoundError`。
 */

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/** 按 DOM 的规矩拆节点：不在容器里的节点 removeChild 就抛，跟浏览器同一句话 */
function fakeContainer() {
  const children = new Set<object>()
  return {
    append(node: object) {
      children.add(node)
    },
    removeChild(node: object) {
      if (!children.delete(node)) throw new Error('NotFoundError: The node to be removed is not a child of this node.')
    },
    clear() {
      children.clear()
    },
    get size() {
      return children.size
    },
  }
}

function treeIn(container: ReturnType<typeof fakeContainer>, log: string[]): () => MountedTree {
  return () => {
    const node = {}
    container.append(node)
    log.push('mount')
    return {
      unmount() {
        container.removeChild(node)
        log.push('unmount')
      },
    }
  }
}

describe('mountWhenReady：换壳时的拆树顺序', () => {
  it('dispose 返回时树已拆完：调用方随后清空容器，拆树不再落到清空之后', async () => {
    const container = fakeContainer()
    const log: string[] = []
    const handle = mountWhenReady(async () => treeIn(container, log), () => log.push('fail'))
    await settle()
    expect(log).toEqual(['mount'])

    expect(() => {
      handle.dispose()
      container.clear()
    }).not.toThrow()
    await settle()
    expect(log).toEqual(['mount', 'unmount'])
  })

  it('准备还没好就 dispose：落树那段永不执行，不留一棵没人拆的树', async () => {
    const container = fakeContainer()
    const log: string[] = []
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const handle = mountWhenReady(async () => {
      await gate
      return treeIn(container, log)
    }, () => log.push('fail'))

    handle.dispose()
    container.clear()
    release()
    await settle()
    expect(log).toEqual([])
    expect(container.size).toBe(0)
  })

  it('准备途中看得见自己已被拆（alive），可以提前收手', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const seen: boolean[] = []
    const handle = mountWhenReady(async (alive) => {
      seen.push(alive())
      await gate
      seen.push(alive())
      return undefined
    }, () => {})
    handle.dispose()
    release()
    await settle()
    expect(seen).toEqual([true, false])
  })

  it('dispose 调两次只拆一次', async () => {
    const container = fakeContainer()
    const log: string[] = []
    const handle = mountWhenReady(async () => treeIn(container, log), () => {})
    await settle()
    handle.dispose()
    expect(() => handle.dispose()).not.toThrow()
    expect(log).toEqual(['mount', 'unmount'])
  })

  it('准备失败、落树抛了：没被拆时报出来', async () => {
    const failed: unknown[] = []
    mountWhenReady(async () => {
      throw new Error('shell.env 没回环境')
    }, (err) => failed.push(String(err)))
    mountWhenReady(async () => () => {
      throw new Error('createRoot 炸了')
    }, (err) => failed.push(String(err)))
    await settle()
    expect(failed).toEqual(['Error: shell.env 没回环境', 'Error: createRoot 炸了'])
  })

  it('拆掉之后迟到的失败不报——容器已经交出去了，不往里写字', async () => {
    let reject!: (err: unknown) => void
    const gate = new Promise<never>((_, r) => (reject = r))
    const failed: unknown[] = []
    const handle = mountWhenReady(async () => gate, (err) => failed.push(err))
    handle.dispose()
    reject(new Error('迟到'))
    await settle()
    expect(failed).toEqual([])
  })
})

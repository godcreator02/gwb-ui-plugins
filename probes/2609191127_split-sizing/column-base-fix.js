async (args) => {
  const root = document.getElementById('root')
  const cKey = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))
  const stack = [root[cKey]]
  let appFiber
  while (stack.length > 0) {
    const f = stack.pop()
    if (!f) continue
    const p = f.memoizedProps
    if (p && typeof p === 'object' && 'initialDoc' in p && 'specs' in p) { appFiber = f; break }
    if (f.child) stack.push(f.child)
    if (f.sibling) stack.push(f.sibling)
  }
  const apis = appFiber.memoizedState.memoizedState
  const desk = document.querySelector('section[data-gwb-desktop][aria-hidden="false"]').getAttribute('data-gwb-desktop')
  const api = apis[desk]
  const params = (key) => ({ pluginKey: '@godcreator/gwb-baseui', entryId: 'home:baseui', paneId: 'plugin-manager', key })
  let n = 200
  const add = (opts) => api.addPanel({ id: `probe:${++n}`, component: 'plugin', tabComponent: 'gwb-tab', title: `P${n}`, params: params(`k${n}`), ...opts })
  const rect = (g) => { const r = g.element.getBoundingClientRect(); return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2) } }
  const snap = () => Object.fromEntries(api.groups.map((g) => [g.id, rect(g)]))
  const clear = () => { for (const p of [...api.panels]) api.removePanel(p) }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  /** 兄弟组里宽或高变了 ≥1px 的：[组 id, 维度, 前, 后] */
  const drift = (before, after, skip) => {
    const out = []
    for (const [id, b] of Object.entries(before)) {
      if (skip.includes(id)) continue
      const a = after[id]
      if (!a) { out.push([id, 'gone']); continue }
      if (Math.abs(a.w - b.w) >= 1) out.push([id, 'w', b.w, a.w])
      if (Math.abs(a.h - b.h) >= 1) out.push([id, 'h', b.h, a.h])
    }
    return out
  }
  const split = async (baseGroup) => {
    const before = snap()
    const d = add({ position: { referenceGroup: baseGroup }, inactive: true })
    d.api.moveTo({ group: baseGroup, position: 'right' })
    await sleep(30)
    const after = snap()
    const skip = [baseGroup.id, d.group.id]
    const raw = drift(before, after, skip)
    // 补偿：基准组的高（跨轴那一维）被 dockview 包分支时吞掉了一份缝的摊额，按 2×原高−现高设回去
    const bb = before[baseGroup.id]; const ba = after[baseGroup.id]
    if (Math.abs(bb.h - ba.h) >= 0.5) baseGroup.api.setSize({ height: 2 * bb.h - ba.h })
    await sleep(30)
    const fixed = snap()
    return {
      raw,
      afterFix: drift(before, fixed, skip),
      base: [before[baseGroup.id], fixed[baseGroup.id]],
      newGroup: fixed[d.group.id],
    }
  }
  /** 左一大组 + 右边一列 k 组，返回列里的组 */
  const column = async (k) => {
    clear()
    const a = add({})
    const col = [add({ position: { referenceGroup: a.group, direction: 'right' } })]
    for (let i = 1; i < k; i++) col.push(add({ position: { referenceGroup: col[i - 1].group, direction: 'below' } }))
    a.group.api.setSize({ width: 600 })
    await sleep(30)
    return col.map((p) => p.group)
  }
  const out = {}
  out.col2_top = await split((await column(2))[0])
  out.col2_bottom = await split((await column(2))[1])
  out.col3_top = await split((await column(3))[0])
  out.col3_mid = await split((await column(3))[1])
  out.col3_bottom = await split((await column(3))[2])
  // 根是竖的：只有上下两组，切上面那组
  {
    clear()
    const a = add({})
    add({ position: { referenceGroup: a.group, direction: 'below' } })
    await sleep(30)
    out.vroot_top = await split(a.group)
  }
  // 行：三组，切最右
  {
    clear()
    const a = add({}); const b = add({ position: { referenceGroup: a.group, direction: 'right' } }); const c = add({ position: { referenceGroup: b.group, direction: 'right' } })
    a.group.api.setSize({ width: 500 }); b.group.api.setSize({ width: 300 })
    await sleep(30)
    out.row_last = await split(c.group)
  }
  clear()
  return out
}

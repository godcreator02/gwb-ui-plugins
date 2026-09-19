async (args) => {
  // 从 React fiber 摸到外壳 App 的 apis（第一个 useState）
  const root = document.getElementById('root')
  const cKey = Object.keys(root).find((k) => k.startsWith('__reactContainer$'))
  let start = root[cKey]
  const stack = [start]
  let appFiber
  while (stack.length > 0) {
    const f = stack.pop()
    if (!f) continue
    const p = f.memoizedProps
    if (p && typeof p === 'object' && 'initialDoc' in p && 'specs' in p) { appFiber = f; break }
    if (f.child) stack.push(f.child)
    if (f.sibling) stack.push(f.sibling)
  }
  if (!appFiber) return { error: 'App fiber not found' }
  const apis = appFiber.memoizedState.memoizedState
  const activeSection = document.querySelector('section[data-gwb-desktop][aria-hidden="false"]')
  const desk = activeSection?.getAttribute('data-gwb-desktop')
  const api = apis[desk]
  if (!api) return { error: 'no api', desk, keys: Object.keys(apis) }

  const params = (key) => ({ pluginKey: '@godcreator/gwb-baseui', entryId: 'home:baseui', paneId: 'plugin-manager', key })
  let n = 0
  const add = (opts) => api.addPanel({ id: `probe:${++n}`, component: 'plugin', tabComponent: 'gwb-tab', title: `P${n}`, params: params(`k${n}`), ...opts })
  const rects = () => api.groups.map((g) => {
    const r = g.element.getBoundingClientRect()
    return { g: g.id, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), tabs: g.panels.map((p) => p.id) }
  })
  const clear = () => { for (const p of [...api.panels]) api.removePanel(p) }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  /** 三组一排、宽度 500 / 300 / 余下 */
  const baseline = async () => {
    clear()
    const a = add({})
    const b = add({ position: { referenceGroup: a.group, direction: 'right' } })
    const c = add({ position: { referenceGroup: b.group, direction: 'right' } })
    a.group.api.setSize({ width: 500 })
    b.group.api.setSize({ width: 300 })
    await sleep(50)
    return { a, b, c }
  }

  const out = { desk, viewport: [innerWidth, innerHeight] }

  // C：带参照、方向 right、不给尺寸（今天的第三档那条）
  {
    const { b } = await baseline()
    const before = rects()
    add({ position: { referenceGroup: b.group, direction: 'right' } })
    await sleep(50)
    out.C_refNoSize_middle = { before, after: rects() }
  }
  // B：带参照、方向 right、initialWidth = 基准组宽的一半（基准组在中间）
  {
    const { b } = await baseline()
    const before = rects()
    add({ position: { referenceGroup: b.group, direction: 'right' }, initialWidth: Math.floor(b.group.api.width / 2) })
    await sleep(50)
    out.B_initialWidth_middle = { before, after: rects() }
  }
  // A：先当标签开进基准组（inactive），再 moveTo 到它右边（基准组在中间）
  {
    const { b } = await baseline()
    const before = rects()
    const d = add({ position: { referenceGroup: b.group }, inactive: true })
    d.api.moveTo({ group: b.group, position: 'right' })
    await sleep(50)
    out.A_moveTo_middle = { before, after: rects(), activeGroup: api.activeGroup?.id, activePanel: api.activePanel?.id, baseActive: b.group.activePanel?.id }
  }
  // B'：基准组在最右
  {
    const { c } = await baseline()
    const before = rects()
    add({ position: { referenceGroup: c.group, direction: 'right' }, initialWidth: Math.floor(c.group.api.width / 2) })
    await sleep(50)
    out.B_initialWidth_last = { before, after: rects() }
  }
  // A'：基准组在最右
  {
    const { c } = await baseline()
    const before = rects()
    const d = add({ position: { referenceGroup: c.group }, inactive: true })
    d.api.moveTo({ group: c.group, position: 'right' })
    await sleep(50)
    out.A_moveTo_last = { before, after: rects() }
  }
  // A''：基准组是一列里的上半（b 下面再叠一组），moveTo 到右边
  {
    const { b } = await baseline()
    add({ position: { referenceGroup: b.group, direction: 'below' } })
    b.group.api.setSize({ width: 300 })
    await sleep(50)
    const before = rects()
    const d = add({ position: { referenceGroup: b.group }, inactive: true })
    d.api.moveTo({ group: b.group, position: 'right' })
    await sleep(50)
    out.A_moveTo_column = { before, after: rects() }
  }
  // B''：同上但走 initialWidth
  {
    const { b } = await baseline()
    add({ position: { referenceGroup: b.group, direction: 'below' } })
    b.group.api.setSize({ width: 300 })
    await sleep(50)
    const before = rects()
    add({ position: { referenceGroup: b.group, direction: 'right' }, initialWidth: Math.floor(b.group.api.width / 2) })
    await sleep(50)
    out.B_initialWidth_column = { before, after: rects() }
  }
  // index：组里三个标签、激活第一个，再带 index=2 开一个
  {
    clear()
    const a = add({})
    add({ position: { referenceGroup: a.group } })
    add({ position: { referenceGroup: a.group } })
    a.api.setActive()
    const idx = a.group.panels.indexOf(a.group.activePanel) + 1
    add({ position: { referenceGroup: a.group, index: idx } })
    const noIdx = add({ position: { referenceGroup: a.group } })
    out.index = { order: a.group.panels.map((p) => p.id), activeWas: 'probe:1', withIndex: `probe:${n - 1}`, noIndex: noIdx.id }
  }
  clear()
  return out
}

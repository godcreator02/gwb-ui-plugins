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
  let n = 100
  const add = (opts) => api.addPanel({ id: `probe:${++n}`, component: 'plugin', tabComponent: 'gwb-tab', title: `P${n}`, params: params(`k${n}`), ...opts })
  const rect = (g) => {
    const r = g.element.getBoundingClientRect()
    return { x: +r.left.toFixed(2), y: +r.top.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), apiW: g.api.width, apiH: g.api.height }
  }
  const snap = (groups) => Object.fromEntries(groups.map((g) => [g.id, rect(g)]))
  const clear = () => { for (const p of [...api.panels]) api.removePanel(p) }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const out = { gap: api.gap ?? null }

  // 行：三组 500/300/余下，moveTo 切中间那组
  {
    clear()
    const a = add({}); const b = add({ position: { referenceGroup: a.group, direction: 'right' } }); add({ position: { referenceGroup: b.group, direction: 'right' } })
    a.group.api.setSize({ width: 500 }); b.group.api.setSize({ width: 300 })
    await sleep(50)
    const groups = [...api.groups]
    const before = snap(groups)
    const d = add({ position: { referenceGroup: b.group }, inactive: true })
    d.api.moveTo({ group: b.group, position: 'right' })
    await sleep(50)
    out.row = { base: b.group.id, before, after: snap([...api.groups]) }
  }
  // 列（最右那列上下两组），moveTo 切上面那组；然后试补偿：把基准组高度设回去
  {
    clear()
    const a = add({}); const b = add({ position: { referenceGroup: a.group, direction: 'right' } })
    const below = add({ position: { referenceGroup: b.group, direction: 'below' } })
    a.group.api.setSize({ width: 600 })
    await sleep(50)
    const before = snap([...api.groups])
    const baseH = b.group.api.height
    const d = add({ position: { referenceGroup: b.group }, inactive: true })
    d.api.moveTo({ group: b.group, position: 'right' })
    await sleep(50)
    const after = snap([...api.groups])
    b.group.api.setSize({ height: baseH })
    await sleep(50)
    out.column = { base: b.group.id, below: below.group.id, before, after, compensated: snap([...api.groups]) }
  }
  clear()
  return out
}

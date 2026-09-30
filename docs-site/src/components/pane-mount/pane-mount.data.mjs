/**
 * 「一个窗格从注册到挂载到关闭」的讲解数据：画面（pane-mount.tsx）与机读版规则（pane-mount.ai.mjs）都只读这一份。
 * 每一步亮哪几个参与者、画哪几条箭头、对应哪段源码。源码片段照抄 plugins/shell/src/，正上方的记号把它钉在源码上。
 */

/**
 * 参与者：外壳 node 侧蓝色，外壳浏览器侧琥珀色，窗格插件绿色，样式表青色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/docfirst-explainer').Role }[]}
 */
export const actors = [
  { id: 'plugin', name: '插件的 apply', sub: 'ctx.gwbShell', role: 'emerald' },
  { id: 'svc', name: '外壳服务', sub: '窗格注册表 · shell.panes', role: 'blue' },
  { id: 'dock', name: 'dockview 面板', sub: "component: 'plugin'", role: 'amber' },
  { id: 'pp', name: 'PluginPane', sub: '挂载 effect', role: 'amber' },
  { id: 'link', name: '样式表', sub: '<link> · loadStyle', role: 'cyan' },
  { id: 'client', name: '插件的 client.js', sub: 'mountPane', role: 'emerald' },
];

/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} MountStep
 * @type {MountStep[]}
 */
export const steps = [
  /* ref file="../plugins/shell/src/index.ts" lines="460-466" hash="764e0d5bea40" blob="ea7cdacc4957" */
  {
    title: '注册：身份由外壳填',
    text:
      '插件在 apply 里调 registerPane，只给 id、title、icon、client、style、kind。外壳从调用方的 fiber 上取条目 id 与包名，交给窗格表检查、登记；' +
      '登记放在插件自己的 ctx.effect 里，插件卸载时自动注销。这一步只有主进程里的一张表变了，页面上什么都没发生。',
    lit: ['plugin', 'svc'],
    shown: ['register'],
    marks: {},
    code: {
      file: 'plugins/shell/src/index.ts',
      start: 451,
      lines: [
        '  registerPane(spec: PaneSpec): () => void {',
        '    const owner = this.ownerOfCaller()',
        '    const unregister = this.paneTable.register(owner, spec)',
        "    this.logInfo(`窗格 ${spec.id}（${spec.title}，${spec.kind === 'document' ? '文档窗格' : '工具窗格'}）登记上了（${owner.pkg}）`)",
        '    this.ctx.effect(() => unregister)',
        '    return unregister',
        '  }',
      ],
      highlight: [452, 453],
    },
  },
  /* ref file="../plugins/shell/src/client/open.ts" lines="255-272" hash="6ca0931992e9" blob="c3574996f7de" */
  {
    title: '打开一份：dockview 多一个面板',
    text:
      '有人打开这个窗格时，外壳算好实例 id 与位置，addPanel 一个 component 为 plugin 的面板，面板参数里放着包名、条目 id、窗格 id、key 与插件自己的参数。' +
      'dockview 渲染 PluginPanel：它把外壳的身份字段与插件的参数分开，把条目 id 闭包绑定进交给插件的 openPane，再渲染 PluginPane。',
    lit: ['dock', 'pp'],
    shown: ['addPanel'],
    marks: { pp: '加载中…' },
    code: {
      file: 'plugins/shell/src/client/open.ts',
      start: 255,
      lines: [
        "function openNewPanel(api: DockviewApi, plan: Extract<OpenPlan, { kind: 'open' }>): void {",
        '  const newPanel: NewPanel = {',
        '    id: plan.id,',
        '    component: plan.spec.component,',
        '    tabComponent: TAB_COMPONENT,',
        '    title: plan.title,',
        '    params: panelParamsOf(plan.spec),',
        '  }',
        '  const { at } = plan',
        "  if ('group' in at) {",
        '    // 不给 index 的话 dockview 追加到组末尾',
        '    api.addPanel({ ...newPanel, position: { referenceGroup: at.group, index: at.index } })',
        "  } else if ('split' in at) {",
        '    splitOpen(api, at.split, newPanel)',
        '  } else {',
        '    api.addPanel(newPanel)',
        '  }',
        '}',
      ],
      highlight: [256, 262],
    },
  },
  /* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="119-126" hash="6a18e42db0ff" blob="056b20dadf53" */
  {
    title: '当场取注册表，先注入样式表',
    text:
      'PluginPane 的挂载 effect 不用开窗格那一刻的快照，而是当场调 shell.panes 取这一条：插件可能运行中才加载，包也可能改过名。' +
      '容器上的 data-gwb-plugin 写此刻的包名；注册时给了 style 就插入 <link> 并等它加载完，加载不了就在窗格里显示「加载失败：原因」、不往下走。' +
      '同一张样式表只插入一次、之后不移除：移除要引用计数，计错了会关一个窗格、另一个窗格的样式跟着没了。',
    lit: ['pp', 'svc', 'link'],
    shown: ['panes', 'style'],
    marks: { pp: '加载中…' },
    code: {
      file: 'plugins/shell/src/client/PluginPane.tsx',
      start: 119,
      lines: [
        '    void (async () => {',
        '      try {',
        '        const target = paneTargetIn(await fetchPanes(host), entryId, paneId)',
        '        // 身份标记取注册表里此刻的包名：面板 params 里的 pluginKey 是开窗格那一刻存进布局文件的，包改名后还是旧名',
        "        container.setAttribute('data-gwb-plugin', target.pkg)",
        '        if (target.style !== undefined && !(await loadStyle(target.style))) {',
        '          throw new Error(`${target.pkg} 注册窗格 ${paneId} 时报的样式表加载不了：${target.style}`)',
        '        }',
      ],
      highlight: [121, 124],
    },
  },
  /* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="17-24" hash="a5a81f216f2b" blob="056b20dadf53" */
  {
    title: '等 importmap，再 import 插件模块',
    text:
      '样式表加载完才 import 插件的 client.js：两件事写在同一个 effect 里，先后顺序由代码保证，不靠两个 effect 的排列顺序。' +
      'import 之前先等内核把 importmap 注入好，插件里按裸名写的 react 才解析得到外壳那一份。模块里没有 mountPane 导出就报错。',
    lit: ['pp', 'client'],
    shown: ['import'],
    marks: { pp: '加载中…' },
    code: {
      file: 'plugins/shell/src/client/PluginPane.tsx',
      start: 17,
      lines: [
        '/** 缺 `mountPane` 导出或它不是函数都抛错 */',
        'async function importMountPane(url: string, who: string): Promise<MountLike> {',
        '  await window.gwb.prepareImports()',
        '  const mod: unknown = await import(/* @vite-ignore */ url)',
        '  const mount = pickMountPane(mod)',
        '  if (mount === undefined) throw new Error(`${who} 的 client.js 没有 mountPane 导出——那是窗格插件的入口名`)',
        '  return mount',
        '}',
      ],
      highlight: [19, 20],
    },
  },
  /* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="131-150" hash="fecd8be7ef65" blob="9c02be810c3b" */
  {
    title: 'mountPane：插件接手容器',
    text:
      '外壳调 mountPane({ host, shell, pane }, 容器)。pane 里是注册时的窗格 id、这一份的实例 id、kind，开这一份时插件传过参数才有 params。' +
      '句柄上的 dispose 必须有：没有就在窗格里报契约不符，写明回的是什么（mountPane 写成 async 回的是 Promise，也点名说出来）。retarget 可选。',
    lit: ['pp', 'client'],
    shown: ['mount'],
    marks: { pp: '已挂载', client: '接手容器' },
    code: {
      file: 'plugins/shell/src/client/PluginPane.tsx',
      start: 131,
      lines: [
        '        const openParams = paneParamsRef.current',
        '        const pane = {',
        '          id: paneId,',
        '          instance: panelId,',
        '          kind: target.kind,',
        '          ...(openParams === undefined ? {} : { params: openParams }),',
        '        }',
        '        const handle = mountPane({ host, shell, pane }, container)',
        '        dispose = pickDispose(handle)',
        '        // retarget 可选：取不到就卸载后重新挂载，不是契约不符',
        '        retargetRef.current = pickRetarget(handle)',
        '        heldRef.current = paramsKeyOf(openParams)',
        '        mountedRef.current = true',
        '        if (dispose === undefined) {',
        '          setError(',
        '            `${pluginKey} 的 mountPane 没按契约回 { dispose() }，回的是${describeHandle(handle)}——关掉窗格时清理不了`,',
        '          )',
        '          return',
        '        }',
        '        if (!disposed) setReady(true)',
      ],
      highlight: [138, 141],
    },
  },
  /* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="168-187" hash="5a46fcf7469f" blob="9c02be810c3b" */
  {
    title: '换内容：原地换内容或卸载后重新挂载',
    text:
      '外壳换了这个面板的参数（预览窗格被下一次预览打开替换时）：插件给了 retarget 就调它，窗格不重新挂载；没给就卸载后重新挂载。' +
      '比较的是参数的稳定序列化（键排序后 JSON），不是对象引用——面板参数每轮渲染都是新对象。插件还没挂载完、或参数就是插件自己上报的那份时什么都不做。',
    lit: ['pp', 'client'],
    shown: ['retarget'],
    marks: { pp: '已挂载', client: '换成新内容' },
    code: {
      file: 'plugins/shell/src/client/PluginPane.tsx',
      start: 168,
      lines: [
        '  /** 外壳换了面板 params：插件给了 `retarget` 就调它原地换内容，没给就卸载后重新挂载；比稳定序列化，不比引用；没挂载完成时什么都不做 */',
        '  const paramsKey = paramsKeyOf(paneParams)',
        '  useEffect(() => {',
        '    if (!mountedRef.current) return',
        '    // 插件手上本来就是这份（自己上报的，或挂载时就是它）',
        '    if (paramsKey === heldRef.current) return',
        '    heldRef.current = paramsKey',
        '    const retarget = retargetRef.current',
        '    if (retarget === undefined) {',
        '      setRemounts((n) => n + 1)',
        '      return',
        '    }',
        '    try {',
        '      retarget(paneParamsRef.current ?? {})',
        '    } catch (err) {',
        '      // 插件的 retarget 抛错时窗格还显示上一份内容，人看到的是点了没反应',
        '      console.error(`[shell] ${pluginKey} 的 retarget 抛了：`, err)',
        '    }',
        '    // 只依赖 paramsKey（pluginKey 只用在报错里），别的都经 ref 读',
        '  }, [paramsKey, pluginKey])',
      ],
      highlight: [176, 181],
    },
  },
  /* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="156-164" hash="7026d1f86140" blob="056b20dadf53" */
  {
    title: '关窗格：dispose 排到提交之外',
    text:
      '面板关掉时，PluginPane 的清理函数在外壳的 React 提交里执行。插件的 dispose 不在这里同步调，而是排进微任务：插件在提交里同步 root.unmount() 会被 React 推迟，' +
      '紧接着清空容器就先于卸载，报 removeChild 的 NotFoundError。移到提交之外以后，插件在 dispose 里「同步卸载树、再清空容器」是合法写法。dispose 抛的错记进 console。',
    lit: ['dock', 'pp', 'client'],
    shown: ['dispose'],
    marks: { pp: '清理 effect', client: 'dispose()' },
    code: {
      file: 'plugins/shell/src/client/PluginPane.tsx',
      start: 156,
      lines: [
        '    return () => {',
        '      disposed = true',
        '      mountedRef.current = false',
        '      retargetRef.current = undefined',
        '      // 卸载路径上的异常没有别的出口，必须记下来',
        '      disposeOutsideCommit(dispose, (err) => {',
        '        console.error(`[shell] ${pluginKey} 的 dispose 抛了：`, err)',
        '      })',
        '    }',
      ],
      highlight: [161, 163],
    },
  },
];

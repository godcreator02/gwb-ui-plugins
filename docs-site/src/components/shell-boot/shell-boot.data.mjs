/**
 * 「外壳怎么接管内核的页面」的讲解数据：画面（shell-boot.tsx）与机读版规则（shell-boot.ai.mjs）都只读这一份。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、#root 此刻显示什么、对应哪段源码。
 * 源码片段照抄 plugins/shell/src/，正上方的记号把它钉在源码上。
 */

/**
 * 参与者：外壳 node 侧是蓝色，外壳浏览器侧是琥珀色，包外的内核与命令总线是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/docfirst-explainer').Role }[]}
 */
export const actors = [
  { id: 'svc', name: '外壳服务', sub: 'src/index.ts', role: 'blue' },
  { id: 'bus', name: '命令总线', sub: 'shell.env · shell.panes …', role: 'slate' },
  { id: 'kernel', name: '内核服务', sub: 'gwbKernel', role: 'slate' },
  { id: 'root', name: '#root', sub: '内核状态页', role: 'amber' },
  { id: 'prep', name: '准备段', sub: 'prepareShell', role: 'amber' },
  { id: 'mount', name: 'mountShell', sub: 'client.js 默认导出', role: 'amber' },
  { id: 'page', name: '内核页面', sub: 'index.html', role: 'slate' },
];

/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} BootStep
 * @type {BootStep[]}
 */
export const steps = [
  /* ref file="../plugins/shell/src/index.ts" lines="145-151" hash="4c4709b8e5ae" blob="d8029385df74" */
  {
    title: '外壳声明「页面归我」',
    text:
      'shell 插件在 node 侧初始化时，先把四个 React 入口的地址交给内核（registerImports），再把 client.js 的 file:// 地址交给内核（setShell）。' +
      '两次调用都包在 ctx.effect 里：插件卸载时自动撤销，内核会往页面推 url 为 null。此刻页面上显示的还是内核自己的状态页。',
    lit: ['svc', 'kernel'],
    shown: ['setShell'],
    marks: {},
    code: {
      file: 'plugins/shell/src/index.ts',
      start: 145,
      lines: [
        '  /** @internal 本插件卸载时页面根自动交还 */',
        '  private takeOverPageRoot(): string {',
        '    this.ctx.effect(() => this.kernel.registerImports(browserImports()))',
        "    const clientEntry = new URL('./client.js', import.meta.url).href",
        '    this.ctx.effect(() => this.kernel.setShell(clientEntry))',
        '    return clientEntry',
        '  }',
      ],
      highlight: [147, 149],
    },
  },
  /* ref file="../plugins/shell/src/client/index.tsx" lines="672-677" hash="241ed54e80f8" blob="144339d9b11c" */
  {
    title: '内核把地址推给页面，页面 import 外壳',
    text:
      '内核记下外壳地址推给页面。页面先调旧外壳的 dispose（有的话）并清空 #root，再等 importmap 注入（prepareImports），然后 import(client.js)，' +
      '把 #root 交给它的默认导出 mountShell，留下返回的 dispose。内核只认这个默认导出的形状，不认识外壳里的任何东西。',
    lit: ['kernel', 'page', 'mount'],
    shown: ['push', 'import'],
    marks: { page: 'prepareImports → import', root: '清空，交给 mountShell' },
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      start: 668,
      lines: [
        '/**',
        ' * 内核契约的默认导出：拿走 `#root`，回 `{ dispose }`。环境问 node 侧的 `shell.env`；',
        ' * shell 的主进程部分登记 react；内核准备好映射后才 import 本模块',
        ' */',
        'export default function mountShell(root: HTMLElement): { dispose(): void } {',
        '  return shellHandle(root, async (alive) => {',
      ],
      highlight: [672, 672],
    },
  },
  /* ref file="../plugins/shell/src/client/index.tsx" lines="676-693" hash="800476b8f2f2" blob="144339d9b11c" */
  {
    title: 'mountShell 问环境',
    text:
      'mountShell 用命令插件的页面客户端 command 调 shell.env，拿回 home、三张样式表的地址、用户外观样式（外观插件装了且设置过才有）与版本号。' +
      '回执不是 ok 就抛错，交给失败处理；这时已经被 dispose 的，到此为止、不再往下准备。之后浏览器侧所有的命令调用都用同一个 command，它就是交给窗格插件的 host.call。',
    lit: ['mount', 'bus'],
    shown: ['env'],
    marks: { root: '空（准备中）' },
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      start: 672,
      lines: [
        'export default function mountShell(root: HTMLElement): { dispose(): void } {',
        '  return shellHandle(root, async (alive) => {',
        '    const reply = (await command<ShellEnv>(ENV_COMMAND)) as {',
        '      ok?: boolean',
        '      data?: ShellEnv',
        '      error?: string',
        '    }',
        '    if (reply.ok !== true || reply.data === undefined) {',
        "      throw new Error(`${ENV_COMMAND} 没回环境：${reply.error ?? '没说原因'}`)",
        '    }',
        '    if (!alive()) return undefined',
        '    const { home, styles, startupCss, versions } = reply.data',
        '    return prepareShell(',
        '      { host: { call: command }, home, styles, startupCss, versions },',
        '      root,',
        '    )',
        '  })',
        '}',
      ],
      highlight: [674, 682],
    },
  },
  /* ref file="../plugins/shell/src/client/index.tsx" lines="615-626" hash="b8e3841fab22" blob="144339d9b11c" */
  {
    title: '准备：样式表、注册表、布局文件',
    text:
      '按顺序插入令牌表、dockview 样式表、外壳样式表并等全部加载完，再把用户外观样式写进 #gwb-theme-style；接着取一次注册表（shell.panes），' +
      '再取一次布局文件（shell.layout.get）——布局要在第一帧之前拿到，否则会先显示默认布局再跳到恢复的那套。' +
      '样式表有一张加载不了、或注册表取不回来，#root 上只写一句「外壳启动失败：原因」；布局文件取不回来不算失败，按默认布局打开、这一轮停止保存。' +
      '这一段只做准备，页面上的副作用一样都还没发生。',
    lit: ['prep', 'bus'],
    shown: ['fetch'],
    marks: { root: '空（准备中）' },
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      start: 611,
      lines: [
        'async function prepareShell(args: ShellArgs, root: HTMLElement): Promise<() => MountedTree> {',
        '  const styleLoaded = await Promise.all(args.styles.map((href) => loadStyle(href)))',
        '  const failedStyles = args.styles.filter((_href, index) => !styleLoaded[index])',
        "  if (failedStyles.length > 0) throw new Error(`外壳的样式表加载不了：${failedStyles.join('、')}`)",
        '  applyStartupCss(args.startupCss)',
        '',
        '  const panes = await fetchPanes(args.host)',
        '  const specs = listOpenable(panes)',
        '  // 布局文件要在第一帧之前取到，否则先显示默认布局再跳到恢复的，会闪一下',
        '  const [layoutReply] = await Promise.allSettled([args.host.call(LAYOUT_GET_COMMAND)])',
        '  const initial = initialLayoutOf(layoutReply)',
        "  if (initial.saveBlockedBy !== undefined) console.error(`[shell] ${initial.saveBlockedBy}——按默认布局打开，这一轮不保存布局`)",
      ],
      highlight: [617, 621],
    },
  },
  /* ref file="../plugins/shell/src/client/index.tsx" lines="628-638" hash="cef6911699ea" blob="144339d9b11c" */
  {
    title: '挂载：同步的一小段',
    text:
      '准备完交回的是一个同步函数：记下命令入口、给 <html> 加 dockview 主题类与 dark、给 #root 标上身份、createRoot(#root) 渲染 App。' +
      '准备途中已经被 dispose 的，这一段永不执行，页面上不会留下半套外壳。',
    lit: ['prep', 'root'],
    shown: ['render'],
    marks: { root: '外壳的 React 树' },
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      start: 624,
      lines: [
        '  return () => {',
        '    wellHub.setHost(args.host)',
        '    document.documentElement.classList.add(...THEME_CLASSES)',
        '    // 深色是默认；卸载时不移除，换外壳时新外壳会再加上，移除反而闪一下亮色',
        "    document.documentElement.classList.add('dark')",
        '    // 只是身份标记，不参与任何选择器；样式隔离靠类名前缀',
        "    root.setAttribute('data-gwb-plugin', SELF)",
        '    const reactRoot = createRoot(root)',
        '    reactRoot.render(',
        '      <App specs={specs} home={args.home} versions={args.versions} initialDoc={initial.doc} initialSaveBlockedBy={initial.saveBlockedBy} />,',
        '    )',
      ],
      highlight: [631, 633],
    },
  },
  /* ref file="../plugins/shell/src/client/index.tsx" lines="639-650" hash="33f4a45599d4" blob="144339d9b11c" */
  {
    title: '换外壳或卸载：dispose 返回时树已卸载',
    text:
      '外壳插件卸载或换了版本，内核推来 null 或新地址，页面调旧外壳的 dispose，紧接着清空 #root。dispose 先把布局立刻保存一次（最多丢最后 400ms 的挪动），' +
      '再同步卸载 React 树、摘掉 dockview 主题类（dark 类留着）与身份标记、交还自己那份命令入口。卸载要是放进 Promise，就会晚于清空 #root，React 报 removeChild 的 NotFoundError。',
    lit: ['page', 'mount', 'root'],
    shown: ['dispose', 'unmount'],
    marks: { root: '清空，等下一个外壳', page: 'dispose → 清空 #root' },
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      start: 635,
      lines: [
        '    return {',
        '      unmount() {',
        '        // 卸载前立刻保存一次，最多丢最后 400ms 的挪动',
        '        wellHub.flush()',
        '        // 同步卸载完：内核页面根在 dispose 之后紧接着清空 #root',
        '        reactRoot.unmount()',
        '        document.documentElement.classList.remove(...THEME_CLASSES)',
        "        root.removeAttribute('data-gwb-plugin')",
        '        // 只清自己那份：换外壳时新外壳先 boot，不判身份会把新外壳的那份清掉',
        '        wellHub.releaseHost(args.host)',
        '      },',
        '    }',
      ],
      highlight: [638, 640],
    },
  },
];

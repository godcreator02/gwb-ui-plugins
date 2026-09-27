/**
 * 「从主进程登记到窗格挂载完成」的全部讲解数据：画面（react-boot.tsx）与机读规则（react-boot.ai.mjs）都只读这一份。
 * 跨三处运行：主进程（外壳的 node 侧与内核）、preload（内核给页面的 window.gwb）、页面（内核的 index.html、外壳与插件的浏览器侧代码）。
 * 每一步列出这一刻四样东西的状态：内核的登记表、页面上已注入的 importmap、<head> 里的样式、#root 里是什么。
 * 地址只写包目录之后的部分，实际是 file:// 开头的完整地址。
 */

/** 三处运行的地方；颜色整页固定 */
export const lanes = [
  { id: 'main', label: '主进程', detail: '外壳 node 侧、内核', role: 'amber' },
  { id: 'preload', label: 'preload', detail: '内核给页面的 window.gwb', role: 'slate' },
  { id: 'page', label: '页面', detail: '内核 index.html、外壳与插件的浏览器侧', role: 'blue' },
];

const REACT_NAMES = [
  ['react', 'gwb-shell/dist/react/react.js'],
  ['react/jsx-runtime', 'gwb-shell/dist/react/react-jsx-runtime.js'],
  ['react-dom', 'gwb-shell/dist/react/react-dom.js'],
  ['react-dom/client', 'gwb-shell/dist/react/react-dom-client.js'],
];

const SHELL_STYLES = ['gwb-shell/dist/theme.css', 'gwb-shell/dist/dockview.css', 'gwb-shell/dist/style.css'];

/**
 * 每一步：lane 是这一步在哪运行；code 是这一步照抄的源码（没有就不画）；
 * registry / importmap 是 [名字, 地址] 列表，styles 是 <head> 里按顺序的样式，root 是 #root 里此刻是什么；
 * changed 标出这一步变了的那一样；fault 表示这一步以报错结束。
 * @typedef {{ file: string, lines: string[], highlight?: [number, number] }} StepCode
 * @typedef {'registry' | 'importmap' | 'styles' | 'root'} StateName
 * @typedef {{ id: string, title: string, text: string, lane: 'main' | 'preload' | 'page', code?: StepCode, registry: string[][], importmap: string[][], styles: string[], root: string, changed: StateName[], fault?: boolean }} BootStep
 * @type {BootStep[]}
 */
/* ref file="../plugins/shell/src/index.ts" lines="145-151" hash="4c4709b8e5ae" blob="d8029385df74" */
/* ref file="../plugins/shell/src/browser-imports.ts" hash="b3a836f060d8" blob="981722f5237b" */
/* ref file="../plugins/shell/src/index.ts" lines="31-41" hash="84186942fe7c" blob="d8029385df74" */
/* ref file="../plugins/shell/src/client/index.tsx" lines="610-614" hash="9b37781495f0" blob="9b2b1fdf837c" */
/* ref file="../plugins/shell/src/client/index.tsx" lines="623-630" hash="5e6aad4b09ad" blob="9b2b1fdf837c" */
/* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="18-24" hash="3c918590d21e" blob="056b20dadf53" */
/* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="119-128" hash="81a0964ad84e" blob="056b20dadf53" */
export const steps = [
  {
    id: 'register',
    title: '外壳在主进程里登记 React 的四个文件',
    text:
      '外壳插件加载时，先把 browserImports() 交给内核的 registerImports：四个包名各对应外壳包里 dist/react/ 下的一个文件。' +
      '整批一起登记，同名同地址的算复用、同名不同地址的直接抛错。登记包在 ctx.effect 里，外壳卸载时自动撤销。',
    lane: 'main',
    code: {
      file: 'plugins/shell/src/index.ts',
      lines: [
        'private takeOverPageRoot(): string {',
        '  this.ctx.effect(() => this.kernel.registerImports(browserImports()))',
        "  const clientEntry = new URL('./client.js', import.meta.url).href",
        '  this.ctx.effect(() => this.kernel.setShell(clientEntry))',
        '  return clientEntry',
        '}',
      ],
      highlight: [2, 2],
    },
    registry: REACT_NAMES,
    importmap: [],
    styles: [],
    root: '空',
    changed: ['registry'],
  },
  {
    id: 'set-shell',
    title: '然后才交出页面根',
    text:
      '同一个函数的下一行把外壳浏览器侧入口 client.js 的地址交给 setShell，内核把它推给页面。顺序不能反：' +
      '页面一收到地址就去要登记表快照、加载外壳，要是那一刻 react 还没登记，外壳产物里的 import … from "react" 就解析不了。',
    lane: 'main',
    code: {
      file: 'plugins/shell/src/index.ts',
      lines: [
        'private takeOverPageRoot(): string {',
        '  this.ctx.effect(() => this.kernel.registerImports(browserImports()))',
        "  const clientEntry = new URL('./client.js', import.meta.url).href",
        '  this.ctx.effect(() => this.kernel.setShell(clientEntry))',
        '  return clientEntry',
        '}',
      ],
      highlight: [3, 4],
    },
    registry: REACT_NAMES,
    importmap: [],
    styles: [],
    root: '空，等外壳地址',
    changed: [],
  },
  {
    id: 'prepare',
    title: '页面先准备 importmap',
    text:
      '内核的页面收到外壳地址后先 await window.gwb.prepareImports()：preload 向主进程要一份登记表快照，把还没注入过的名字写成一段 ' +
      '<script type="importmap"> 追加进 <head>，并记住每个名字注入时的地址。同一个页面里注入过的映射不能撤销也不能改。',
    lane: 'preload',
    registry: REACT_NAMES,
    importmap: REACT_NAMES,
    styles: [],
    root: '空，等外壳地址',
    changed: ['importmap'],
  },
  {
    id: 'import-shell',
    title: '再加载外壳的 client.js',
    text:
      '准备完才动态 import 外壳的 client.js。它构建时把这四个包名留成 external，产物里是裸的 import … from "react"，' +
      '浏览器按 importmap 解析到外壳包里的 react.js；react-dom 的两个文件也 import "react"，解析到同一个文件，全页一份 React。' +
      '然后调它的默认导出 mountShell(#root)。',
    lane: 'page',
    registry: REACT_NAMES,
    importmap: REACT_NAMES,
    styles: [],
    root: '外壳已接管，还没渲染',
    changed: ['root'],
  },
  {
    id: 'styles',
    title: '外壳问 shell.env，注入三张样式表并等它们加载完',
    text:
      '外壳经命令 shell.env 拿到 home、三张样式表的地址和用户的外观样式。三张表的顺序由 node 侧写死：令牌表 theme.css、dockview.css、外壳自己的 style.css。' +
      '全部注入并等到 load 才往下走；有一张加载不了，#root 里写一句「外壳起不来」和那张表的地址。接着把外观插件给的启动样式写进 <style id="gwb-theme-style">，排在三张表之后。',
    lane: 'page',
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      lines: [
        'async function prepareShell(args: ShellArgs, root: HTMLElement): Promise<() => MountedTree> {',
        '  const styleLoaded = await Promise.all(args.styles.map((href) => loadStyle(href)))',
        '  const failedStyles = args.styles.filter((_href, index) => !styleLoaded[index])',
        "  if (failedStyles.length > 0) throw new Error(`外壳的样式表加载不了：${failedStyles.join('、')}`)",
        '  applyStartupCss(args.startupCss)',
      ],
      highlight: [2, 5],
    },
    registry: REACT_NAMES,
    importmap: REACT_NAMES,
    styles: [...SHELL_STYLES, '<style id="gwb-theme-style">'],
    root: '外壳已接管，还没渲染',
    changed: ['styles'],
  },
  {
    id: 'render',
    title: '第一帧之前的最后几件事，然后 createRoot',
    text:
      '取窗格注册表和布局文件（布局要在第一帧之前拿到，否则先显示默认布局再跳过去），然后给 <html> 加上 dockview-theme-gwb 与 dark，' +
      '在 #root 上写身份标记 data-gwb-plugin，最后 createRoot 渲染。身份标记只用来辨认，不参与任何选择器。',
    lane: 'page',
    code: {
      file: 'plugins/shell/src/client/index.tsx',
      lines: [
        '  return () => {',
        '    wellHub.setHost(args.host)',
        '    document.documentElement.classList.add(...THEME_CLASSES)',
        '    // 深色是默认；卸载时不移除，换外壳时新外壳会再加上，移除反而闪一下亮色',
        "    document.documentElement.classList.add('dark')",
        '    // 只是身份标记，不参与任何选择器；样式隔离靠类名前缀',
        "    root.setAttribute('data-gwb-plugin', SELF)",
        '    const reactRoot = createRoot(root)',
      ],
      highlight: [3, 8],
    },
    registry: REACT_NAMES,
    importmap: REACT_NAMES,
    styles: [...SHELL_STYLES, '<style id="gwb-theme-style">'],
    root: '外壳的 React 树：桌面、窗格容器、状态栏',
    changed: ['root'],
  },
  {
    id: 'pane',
    title: '开一个 baseui 的窗格',
    text:
      '外壳从注册表取 baseui 注册时给的两个地址，先写上身份标记，再注入它的样式表并等 load，然后再准备一次 importmap——' +
      '外壳开机之后才登记的名字这时追加成新的一段——最后 import 它的 client.js 并调 mountPane。baseui 的 react 同样解析到外壳包里那一份。' +
      '样式表加载不了就停在这一步，窗格里显示「加载失败」和那张表的地址。',
    lane: 'page',
    code: {
      file: 'plugins/shell/src/client/PluginPane.tsx',
      lines: [
        'async function importMountPane(url: string, who: string): Promise<MountLike> {',
        '  await window.gwb.prepareImports()',
        '  const mod: unknown = await import(/* @vite-ignore */ url)',
        '  …',
        "container.setAttribute('data-gwb-plugin', target.pkg)",
        'if (target.style !== undefined && !(await loadStyle(target.style))) {',
        '  throw new Error(`${target.pkg} 注册窗格 ${paneId} 时报的样式表加载不了：${target.style}`)',
        '}',
        'if (disposed) return',
        'const mountPane = await importMountPane(target.client, target.pkg)',
      ],
      highlight: [6, 10],
    },
    registry: REACT_NAMES,
    importmap: REACT_NAMES,
    styles: [...SHELL_STYLES, '<style id="gwb-theme-style">', 'gwb-baseui/dist/style.css'],
    root: '外壳的 React 树 + baseui 窗格里 baseui 自己的 React 树',
    changed: ['styles', 'root'],
  },
  {
    id: 'changed',
    title: '已注入的名字变了：整页重载',
    text:
      '提供方卸载（登记被撤销）或以别的文件地址重新登记之后，登记表里某个已注入的名字跟页面上注入时的地址对不上。' +
      '下一次 prepareImports 以 GWB_IMPORTS_RELOAD_REQUIRED 开头的错误拒绝：页面上已经加载的 React 模块还活着，不能悄悄改指向。' +
      '这时外壳加载失败、或窗格显示加载失败，要整页重载（shell.reload）后按新的登记表重新来。',
    lane: 'preload',
    registry: [['react', 'gwb-shell/dist/react/react.js（已撤销或换了地址）'], ...REACT_NAMES.slice(1)],
    importmap: REACT_NAMES,
    styles: [...SHELL_STYLES, '<style id="gwb-theme-style">', 'gwb-baseui/dist/style.css'],
    root: 'prepareImports 拒绝，要整页重载',
    changed: ['registry'],
    fault: true,
  },
];

/**
 * 外壳 @godcreator/gwb-shell 的内部接缝图：包首页 <SeamMap module="shell" /> 画的就是它。
 * 虚线框是 plugins/shell/src/ 下的文件或目录（按对外能力分组），方块是它们对外给的函数；
 * 灰色实线框是包外的调用方、被调用的服务与内核。坐标在 shell.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

export const shellGraph = defineSeamGraph({
  id: 'shell',
  title: '外壳内部的文件与接缝',
  intro:
    '外壳内部接缝图：上半张是主进程里的 node 侧（src/index.ts 与注册表），下半张是页面上的浏览器侧（src/client/），中间是两侧各自打包一份的纯模块；' +
    '右边一列是内核，它把两侧接起来。虚线框是包里的文件或目录，框里的方块是它们对外给的函数，灰色实线框是包外的东西。' +
    '外壳对插件只给两个服务方法和一组 shell.* 命令，其余全部经内核与命令总线接到页面上。',
  frameLabel: '文件',
  modules: [
    {
      id: 'plugin-node',
      name: '注册窗格的插件',
      pkg: '任何插件 · node 侧',
      role: null,
      outside: true,
      blurb: '插件在自己的 apply 里经 ctx.gwbShell 注册窗格、报名字，inject 里写 gwbShell。插件卸载时它登记的窗格与名字自动注销。',
      caps: [{ id: 'apply', name: 'apply', ident: 'ctx.gwbShell.registerPane' }],
    },
    {
      id: 'services',
      name: '基础插件',
      pkg: 'gwb-commands · gwb-data · gwb-skills',
      role: null,
      outside: true,
      blurb:
        '外壳注入的三个服务。命令总线与数据是必需依赖（static inject），缺一个外壳就不加载，cordis 在日志里写明在等谁；说明书是局部注入，不在外壳照常运行。',
      caps: [
        { id: 'bus', name: '命令总线', ident: 'gwbCommands' },
        { id: 'data', name: '数据', ident: 'gwbData' },
        { id: 'skills-svc', name: '说明书', ident: 'gwbSkills' },
      ],
    },
    {
      id: 'theme',
      name: '外观插件',
      pkg: '@godcreator/gwb-theme',
      role: null,
      outside: true,
      blurb:
        '可选：没装它外壳照常启动，只是不带用户外观样式。外壳按名字调它的命令 theme.startupCss，它的外观窗格改写页面上 id 为 gwb-theme-style 的样式元素；外壳不 import 它，peer 里也不写它。',
      caps: [
        { id: 'theme-startup', name: '启动样式', ident: 'theme.startupCss' },
        { id: 'theme-pane', name: '外观窗格', ident: '#gwb-theme-style' },
      ],
    },
    {
      id: 'index',
      name: '外壳服务',
      pkg: 'src/index.ts',
      role: 'blue',
      outside: false,
      blurb:
        'node 侧入口，GwbShell 服务类。对插件只有 registerPane、describeSelf 两个方法；其余能力全部登记成 shell.* 命令。初始化时登记四个 React 入口的地址、声明自己是外壳；说明书插件在时登记随包的 gwb-shell 说明书。',
      caps: [
        { id: 'api', name: '服务方法', ident: 'registerPane · describeSelf' },
        { id: 'commands', name: '命令', ident: 'shell.*' },
        { id: 'takeover', name: '接管页面根', ident: 'registerImports · setShell' },
        { id: 'skills', name: '随包说明书', ident: 'skills/gwb-shell' },
      ],
    },
    {
      id: 'kernel',
      name: '内核',
      pkg: '@godcreator/gwb-kernel-desktop',
      role: null,
      outside: true,
      blurb:
        '主进程里的内核服务 gwbKernel（外壳构造时经 requireKernel 取，不写进 inject）与页面 index.html。内核不认识外壳里的任何东西：记下外壳入口的地址推给页面、把浏览器模块的地址写进 importmap、把外壳发的事件推给页面、把页面的请求转给登记了那个通道的插件。',
      caps: [
        { id: 'kernel-svc', name: '内核服务', ident: 'setShell · registerImports · emit' },
        { id: 'kernel-page', name: '页面入口', ident: 'index.html · window.gwb' },
      ],
    },
    {
      id: 'tables',
      name: '注册表',
      pkg: 'pane-registry.ts · plugin-registry.ts · pane-icon.ts',
      role: 'blue',
      outside: false,
      blurb:
        '两张表：窗格表的键是（条目 id，窗格 id），一条条目可以有好几条；插件名表的键是条目 id，一条条目至多一条。登记时检查 id、标题、两个地址与 kind，认不出的图标名只告警。',
      caps: [
        { id: 'pane-table', name: '窗格注册表', ident: 'createPaneRegistry' },
        { id: 'plugin-table', name: '插件名表', ident: 'createPluginRegistry' },
        { id: 'icon', name: '图标名', ident: 'iconProblem' },
      ],
    },
    {
      id: 'react',
      name: 'React 运行时',
      pkg: 'react/ · browser-imports.ts',
      role: 'cyan',
      outside: false,
      blurb:
        '外壳把 react、react/jsx-runtime、react-dom、react-dom/client 四个入口打包进 dist/react/，页面上外壳与所有窗格插件共用这一份 React。browserImports() 给出这四个名字到地址的映射，运行时登记与构建时的外置名单都用它。',
      caps: [
        { id: 'react-imports', name: '模块地址', ident: 'browserImports()' },
        { id: 'react-runtime', name: 'React 单例', ident: 'dist/react/*.js' },
      ],
    },
    {
      id: 'plan',
      name: '开窗格的判断',
      pkg: 'openable.ts · panels.ts · pane-list.ts',
      role: 'emerald',
      outside: false,
      blurb:
        '纯函数：输入一张桌面的快照，输出这次打开该做什么（激活、到别的桌面激活、软换、开新的一份、什么都不做）。面板参数的拼法与保留键、窗格清单的整理也在这里。只有浏览器侧用，全部有单测。',
      caps: [
        { id: 'plan-open', name: '目标组与查重', ident: 'targetGroup · planOpen' },
        { id: 'plan-send', name: '启动器与送到', ident: 'planLaunch · planSend' },
        { id: 'params', name: '面板参数', ident: 'panels.ts' },
      ],
    },
    {
      id: 'shared',
      name: '两侧共用',
      pkg: 'protocol.ts · layout.ts · desktops.ts · pane-actions.ts …',
      role: 'violet',
      outside: false,
      blurb:
        'protocol.ts、layout.ts、desktops.ts、pane-actions.ts、open-pane.ts 几个纯模块，node 侧与浏览器侧各自打包进自己的产物：命令名、布局文件的形状与校验、node 侧转给页面的三种动作的形状与参数检查。两侧用同一份，不各写一份字符串。',
      caps: [
        { id: 'names', name: '命令名', ident: 'protocol.ts' },
        { id: 'layout-doc', name: '布局文件', ident: 'LayoutDoc' },
        { id: 'actions', name: '转发的动作', ident: '*Action' },
      ],
    },
    {
      id: 'boot',
      name: '页面入口与桌面',
      pkg: 'client/index.tsx · shell-mount.ts · theme-boot.ts · StatusBar.tsx …',
      role: 'amber',
      outside: false,
      blurb:
        'client/ 下的 index.tsx、shell-mount.ts、theme-boot.ts、StatusBar.tsx、DesktopPanel.tsx、TabMenu.tsx、GwbTab.tsx。client.js 的默认导出 mountShell 接管 #root。App 管多张桌面（一张桌面一个 dockview 容器）、布局保存、node 侧转来的动作；状态栏、「桌面」面板、标签右键菜单也在这里。',
      caps: [
        { id: 'mount-shell', name: 'mountShell', ident: 'mountShell · bootShell' },
        { id: 'statusbar', name: '状态栏', ident: 'StatusBar' },
        { id: 'app', name: '桌面与布局', ident: 'App · flushSave' },
      ],
    },
    {
      id: 'open',
      name: '开窗格的执行',
      pkg: 'client/open.ts · well-hub.ts',
      role: 'rose',
      outside: false,
      blurb:
        'wellHub 是页面级状态：各桌面的容器、活动桌面、组的最近激活顺序、命令入口；它从容器当场读出桌面快照交给判断。open.ts 把判断执行成 dockview 的调用。',
      caps: [
        { id: 'open-reg', name: '执行', ident: 'openRegisteredPane · sendPane' },
        { id: 'wellhub', name: '页面级状态', ident: 'wellHub' },
      ],
    },
    {
      id: 'pane',
      name: '窗格挂载',
      pkg: 'client/PluginPane.tsx · plugin-panel.tsx · mount-handle.ts · pane-api.ts …',
      role: 'violet',
      outside: false,
      blurb:
        'client/ 下的 PluginPane.tsx、plugin-panel.tsx、mount-handle.ts、visibility.ts、desktop-context.ts、pane-api.ts 与 types.ts。一个窗格由 PluginPane 承载：当场取注册表、注入样式表、import 插件的 client.js、调 mountPane。交给插件的 args.shell 在这里拼好，条目 id 闭包绑定。',
      caps: [
        { id: 'plugin-pane', name: 'PluginPane', ident: 'PluginPane' },
        { id: 'bridge', name: '给插件的接口', ident: 'args.shell' },
        { id: 'pane-types', name: '类型子路径', ident: 'gwb-shell/pane' },
      ],
    },
    {
      id: 'styles',
      name: '样式表',
      pkg: 'tokens/ · client/styles.css · client/dockview-theme.css',
      role: 'cyan',
      outside: false,
      blurb:
        '令牌表 theme.css（preflight 加令牌的值）、给插件构建时用的类名映射 theme.reference.css、外壳自己的 style.css（类名带 shell: 前缀）与裁过的 dockview.css。原理在外壳目录的样式页与令牌页。',
      caps: [
        { id: 'reference', name: '类名映射', ident: 'theme.reference.css' },
        { id: 'theme-css', name: '令牌表', ident: 'theme.css' },
        { id: 'shell-css', name: '外壳样式', ident: 'style.css · dockview.css' },
      ],
    },
    {
      id: 'plugin-client',
      name: '窗格插件',
      pkg: '任何插件 · 浏览器侧',
      role: null,
      outside: true,
      blurb:
        '注册时给的 client 地址指向它的浏览器侧模块，模块导出 mountPane；样式入口构建时引令牌的类名映射，类名带自己的前缀。它按裸名 import react，由 importmap 指到外壳那一份。',
      caps: [
        { id: 'plugin-client', name: 'mountPane', ident: 'mountPane(args, container)' },
        { id: 'plugin-style', name: '样式入口', ident: '@import theme.reference.css' },
      ],
    },
  ],
  entries: [{ id: 'callers', name: 'agent · 别的插件', to: 'bus' }],
  seams: [
    /* ref file="../plugins/shell/src/index.ts" lines="82-91" hash="f1793bcd6f29" blob="d8029385df74" */
    {
      n: 1,
      name: '注册窗格',
      a: ['apply'],
      b: ['api'],
      iface: 'registerPane(spec: PaneSpec): () => void；describeSelf(info: PluginInfo): () => void',
      convention: false,
      via: 'code',
      text:
        '插件只给 id、title、icon、client、style、kind 几样，身份（条目 id 与包名）由服务从调用方的 fiber 上取，插件报不出别人的名字。登记挂在调用方的 ctx.effect 上，插件卸载时自动注销；返回的注销函数给要提前注销的场景。',
    },
    /* ref file="../plugins/shell/src/pane-registry.ts" lines="38-43" hash="c70ded27b39a" blob="22e4ca8931ac" */
    /* ref file="../plugins/shell/src/plugin-registry.ts" lines="15-20" hash="71f696f43767" blob="ca4b3d2b73d5" */
    {
      n: 2,
      name: '登记进表',
      a: ['api'],
      b: ['pane-table', 'plugin-table'],
      iface: 'register(owner, spec): () => void；describe(owner, info): () => void',
      convention: false,
      via: 'code',
      text:
        '服务把取到的身份与插件给的几样交给表。窗格表在这一步检查：空 id、id 带冒号、空标题、client / style 给了却不是对应后缀的 file:// 地址、kind 不是 tool / document，都当场抛错，抛在插件自己的 apply 里；同一个键重复注册，后来者生效并告警；图标名认不出只告警，标签上画 #。',
    },
    /* ref file="../plugins/shell/src/index.ts" lines="168-171" hash="b3ebb9af8569" blob="d8029385df74" */
    {
      n: 3,
      name: '命令总线',
      a: ['commands'],
      b: ['bus'],
      iface: "commandBus.register({ name, description, usage, plugin: '@godcreator/gwb-shell' }, handler)",
      convention: false,
      via: 'code',
      text:
        '外壳的对外能力都登记成 shell.* 命令：取两张表、页面环境、读写布局文件、整页重载、桌面、跨插件开窗格、窗格。页面、agent、别的插件都按名字经命令总线调它们，包根不导出命令名。命令登记在外壳自己的上下文上，外壳卸载时一起注销。',
    },
    /* ref file="../plugins/shell/src/index.ts" lines="187-205" hash="9857ba5e75dc" blob="d8029385df74" */
    {
      n: 4,
      name: '布局文件',
      a: ['commands'],
      b: ['data'],
      iface: "gwbData.readDoc('layout') · gwbData.writeDoc('layout', doc)",
      convention: false,
      via: 'code',
      text:
        'shell.layout.get 原样回 readDoc 的结果，没存过是 undefined；shell.layout.save 先用 parseLayoutDoc 校验形状，不对就回 ok: false、不写入，对了整份替换。shell.desktop.* 也先读这份文件，检查要动的桌面在不在。',
    },
    /* ref file="../plugins/shell/src/index.ts" lines="153-159" hash="84067ee58a76" blob="d8029385df74" */
    {
      n: 5,
      name: '随包说明书',
      a: ['skills'],
      b: ['skills-svc'],
      iface: "ctx.inject(['gwbSkills'], …) → gwbSkills.register(skills/)",
      convention: false,
      via: 'code',
      text: '说明书插件是局部注入：它在时登记包根 skills/ 下的 gwb-shell 说明书，后加载也会补登记，卸载时自动注销；它不在外壳照常运行。',
    },
    /* ref file="../plugins/shell/src/index.ts" lines="145-151" hash="4c4709b8e5ae" blob="d8029385df74" */
    {
      n: 6,
      name: '接管页面根',
      a: ['takeover'],
      b: ['kernel-svc'],
      iface: 'gwbKernel.registerImports(browserImports()) · gwbKernel.setShell(client.js 的 file:// 地址)',
      convention: false,
      via: 'code',
      text:
        '服务初始化时先登记四个 React 入口的地址，再声明自己是外壳，两样都包在 ctx.effect 里。外壳卸载时两样一起撤销，内核往页面推 url 为 null，页面回到内核自己的状态页。',
    },
    /* ref file="../plugins/shell/src/desktops.ts" lines="3-12" hash="07abbc70c61a" blob="8d8779b5e92e" */
    /* ref file="../plugins/shell/src/pane-actions.ts" lines="4-13" hash="088fa45e97f5" blob="fb1659d884db" */
    /* ref file="../plugins/shell/src/open-pane.ts" lines="4-23" hash="19b25ca16b56" blob="4b59d533f10f" */
    {
      n: 7,
      name: '转发给页面',
      a: ['commands'],
      b: ['kernel-svc'],
      iface: "gwbKernel.emit({ t: 'gwb-shell-desktop' | 'gwb-shell-pane' | 'gwb-shell-open-pane', … })",
      convention: false,
      via: 'code',
      text:
        '窗格容器在页面上，node 侧没有。shell.desktop.switch / new / rename / delete、shell.pane.focus / send / close、shell.openPane 先在 node 侧检查参数与目标在不在（查布局文件、注册表或页面推来的窗格清单），再经内核事件推给页面，页面用 window.gwb.on 收。回执 ok 只代表转发了。',
    },
    /* ref file="../plugins/shell/src/client/index.tsx" lines="668-689" hash="fe3cf968ae4b" blob="9b2b1fdf837c" */
    {
      n: 8,
      name: '页面入口',
      a: ['kernel-page'],
      b: ['mount-shell', 'app', 'plugin-pane'],
      iface:
        "prepareImports() → import(client.js) → default(#root) → { dispose() }；command(name, args) → window.gwb.request('commands.run', …)；window.gwb.on(listener)",
      convention: false,
      via: 'code',
      text:
        '内核页面拿到外壳地址后先等 importmap 注入，再 import client.js，把 #root 交给默认导出 mountShell，留下它回的 dispose；换外壳时先调旧的 dispose、紧接着清空 #root。浏览器侧调命令用命令插件随外壳打包的页面客户端 command，它经内核的 commands.run 请求通道走到命令总线；node 侧转来的动作经 window.gwb.on 收。',
    },
    /* ref file="../plugins/shell/src/startup-style.ts" lines="3-22" hash="19d3ce69dbb1" blob="f4110e1b6678" */
    /* ref file="../plugins/shell/src/client/theme-boot.ts" lines="3-18" hash="be7555a77dbc" blob="20e3479e96b1" */
    {
      n: 9,
      name: '用户外观样式',
      a: ['commands', 'mount-shell'],
      b: ['theme-startup', 'theme-pane'],
      iface: 'theme.startupCss（按名字调）→ shell.env 的 startupCss → <style id="gwb-theme-style">',
      convention: true,
      via: 'code',
      text:
        '处理 shell.env 时，命令表里有 theme.startupCss 才调它，没装外观插件不是错误；回失败或回的不是字符串就记一条 error、这次开机不带用户外观样式。页面在三张样式表之后把它写进 id 为 gwb-theme-style 的样式元素，外观窗格预览时直接改这个元素。命令名与元素 id 两边各写一份字符串，不互相 import。',
    },
    /* ref file="../plugins/shell/src/browser-imports.ts" hash="b3a836f060d8" blob="981722f5237b" */
    {
      n: 10,
      name: 'React 运行时',
      a: ['takeover', 'app', 'plugin-client'],
      b: ['react-imports', 'react-runtime'],
      iface: "browserImports() → { react, 'react/jsx-runtime', 'react-dom', 'react-dom/client' } → importmap",
      convention: false,
      via: 'code',
      text:
        '服务把 browserImports() 的四个名字与地址交给内核登记，内核写进页面的 importmap。外壳自己的 client.js 与每个窗格插件都按裸名 import react，构建时外置这四个名字，运行时由 importmap 指到外壳 dist/react/ 下的同一份，所以整页只有一个 React 实例。',
    },
    /* ref file="../plugins/shell/src/protocol.ts" hash="1329b73d1f65" blob="31064d3d17ac" */
    /* ref file="../plugins/shell/src/layout.ts" lines="85-97" hash="75f023bdd6a8" blob="51963d44d83e" */
    {
      n: 11,
      name: '两侧共用的形状',
      a: ['names', 'layout-doc', 'actions'],
      b: ['commands', 'app'],
      iface: 'PANES_COMMAND · ENV_COMMAND · PANE_SYNC_COMMAND · parseLayoutDoc · DesktopAction · PaneAction · OpenPaneAction',
      convention: false,
      via: 'code',
      text:
        '同一个纯模块分别打包进 dist/index.js 与 dist/client.js：命令名、布局文件的形状、node 侧转给页面的动作形状都只写一份。node 侧用它校验参数、拼事件，页面用它认事件、校验读回来的布局文件。',
    },
    /* ref file="../plugins/shell/src/openable.ts" lines="89-97" hash="b783e6ec744e" blob="bb642a6dd7b3" */
    /* ref file="../plugins/shell/src/openable.ts" lines="284-323" hash="e8d00ab74725" blob="bb642a6dd7b3" */
    {
      n: 12,
      name: '开窗格的判断',
      a: ['open-reg'],
      b: ['plan-open', 'plan-send', 'params'],
      iface: 'planOpen(spec, options, { desk, from?, taken, elsewhere? }, who) → OpenPlan',
      convention: false,
      via: 'code',
      text:
        '执行侧从目标桌面的容器当场读出快照 Desk（各组的标签、活动标签、矩形、组的最近激活顺序）交给纯函数，拿回 focus / reveal / retarget / open / none 之一再执行。读快照、算实例 id、addPanel 在同一段同步代码里，两次并发打开不会算出同一个 id。',
    },
    /* ref file="../plugins/shell/src/client/well-hub.ts" lines="8-19" hash="b7c731d2ae08" blob="b8b54deb9e40" */
    {
      n: 13,
      name: '桌面操作',
      a: ['app'],
      b: ['open-reg', 'wellhub'],
      iface: 'wellHub.setDeskOps({ switchTo, ensureMounted, rows, createDesktop, notify })',
      convention: false,
      via: 'code',
      text:
        'dockview 的面板组件表必须是模块级常量，面板与标签组件访问不到 App 的闭包。App 挂载时把桌面操作注入 wellHub，开窗格、送到、激活都经它切桌面、在后台挂载容器、在状态栏提示。状态栏、「桌面」面板与 node 侧转来的动作调 open.ts 的 launchSpec、focusInstance、sendPane、openRegisteredPane。',
    },
    /* ref file="../plugins/shell/src/client/plugin-panel.tsx" lines="27-32" hash="27aa25925692" blob="009542d6cc55" */
    {
      n: 14,
      name: '插件开窗格',
      a: ['bridge'],
      b: ['open-reg'],
      iface: 'args.shell.openPane(paneId, options) → openRegisteredPane(host, { entryId, paneId }, options, 这一份的实例 id)',
      convention: false,
      via: 'code',
      text:
        'entryId 由 plugin-panel 从面板参数里取出来闭包绑定，插件只开得了自己条目的窗格；来源固定是调它的这一份，新窗格开在它那张桌面上、不切桌面。跨插件开窗格走命令 shell.openPane，页面上执行的是同一个函数。',
    },
    /* ref file="../plugins/shell/src/client/types.ts" lines="115-151" hash="4bd34a61e07d" blob="2d06a12a5550" */
    /* ref file="../plugins/shell/src/client/pane-api.ts" hash="7ffef4f47a76" blob="1b80da1732cf" */
    {
      n: 15,
      name: '挂载窗格插件',
      a: ['plugin-pane', 'pane-types'],
      b: ['plugin-client'],
      iface: 'mountPane({ host, shell, pane }, container) → { dispose(); retarget?(params) }',
      convention: false,
      via: 'code',
      text:
        'PluginPane 当场取注册表里这一条的 client 与 style，先注入样式表并等它加载完，再 prepareImports、动态 import client，调 mountPane。句柄上没有 dispose 就在窗格里报契约不符；有 retarget 就软换，没有就卸载后重新挂载。插件从子路径 @godcreator/gwb-shell/pane 用 import type 取这些类型，子路径只有类型。',
    },
    /* ref file="../plugins/shell/src/index.ts" lines="31-41" hash="84186942fe7c" blob="d8029385df74" */
    {
      n: 16,
      name: '样式表',
      a: ['mount-shell'],
      b: ['theme-css', 'shell-css'],
      iface: 'shell.env 的 styles：[theme.css, dockview.css, style.css] 三个 file:// 地址',
      convention: false,
      via: 'disk',
      text:
        'node 侧回应 shell.env 时给出三张样式表的地址，页面按这个顺序插入 <link> 并等全部加载完；有一张加载不了外壳就不渲染，根节点上只写一句「外壳起不来：原因」。',
    },
    /* ref file="../plugins/shell/package.json" lines="11-12" hash="8dcfe7b086f6" blob="2d44c8a19401" */
    {
      n: 17,
      name: '令牌映射',
      a: ['plugin-style'],
      b: ['reference'],
      iface: "@import '@godcreator/gwb-shell/theme.reference.css'",
      convention: false,
      via: 'code',
      text:
        '插件的样式入口在构建时引这张映射，Tailwind 才认得 bg-primary 这类类名；映射只给出类名到 var(--primary) 的对应，不输出变量的值，值在运行时取页面上令牌表那一份。',
    },
  ],
});

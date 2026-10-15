/**
 * 全局接缝图的内容：首页的 <SeamMap /> 画的就是它。
 * 虚线框是本仓的三个插件，框里的方块是插件对外的能力；内核、基础插件、别的带界面的插件画在框外。
 * 接缝编号按依赖方向排：先是插件接内核（1–4），再是接基础插件（5–9），再是外壳给别的插件的出口（10–14，14 是外观登记启动样式），
 * 最后是只靠命令名对上的 15。每条接缝在首页有同名的一节，这里的 text 是那一节的概括。
 * 坐标不在这里，在 system.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamModule[]} */
const modules = [
  {
    id: 'theme',
    name: '外观',
    pkg: '@godcreator/gwb-theme',
    role: 'amber',
    outside: false,
    blurb: '正文字体、等宽字体与自定义 CSS 三项设置，拼成启动样式交给外壳；有外壳时另登记「外观」窗格。没有外壳也照常加载。',
    caps: [
      { id: 'theme-core', name: '外观设置与命令', ident: 'theme.* · registerStartupStyle' },
      { id: 'theme-pane', name: '外观窗格', ident: 'appearance' },
    ],
  },
  {
    id: 'others',
    name: '别的带界面的插件',
    pkg: 'peer gwb-shell',
    role: null,
    outside: true,
    blurb: '在自己的仓里、把外壳写进 peer 的插件：node 侧登记窗格，浏览器侧导出 mountPane，构建时从外壳取外置名单与令牌映射。',
    caps: [
      { id: 'o-node', name: 'node 侧', ident: 'registerPane' },
      { id: 'o-client', name: '浏览器侧', ident: 'client.js' },
    ],
  },
  {
    id: 'baseui',
    name: '基础界面',
    pkg: '@godcreator/gwb-baseui',
    role: 'emerald',
    outside: false,
    blurb: '基础插件的官方窗格集：日志窗格总是登记，插件管理窗格装了插件管理才登记；有命令总线时另登记查内核日志文件的命令 logger.query。必需依赖只有外壳。',
    caps: [
      { id: 'baseui-apply', name: '窗格与命令登记', ident: 'ctx.inject' },
      { id: 'baseui-panes', name: '日志与插件管理', ident: 'panes/' },
    ],
  },
  {
    id: 'shell',
    name: '外壳',
    pkg: '@godcreator/gwb-shell',
    role: 'blue',
    outside: false,
    blurb: '接管内核的页面根，提供窗格注册服务、窗格容器与桌面、页面用的 React、令牌表和给写界面的人读的说明书。页面上只有一个外壳。',
    caps: [
      { id: 'page', name: '页面入口', ident: 'mountShell' },
      { id: 'service', name: '窗格注册服务', ident: 'gwbShell' },
      { id: 'pane', name: '窗格契约', ident: './pane' },
      { id: 'tokens', name: '令牌表', ident: './theme*.css' },
      { id: 'react', name: 'React 运行时', ident: './browser-imports' },
      { id: 'commands', name: '外壳命令', ident: 'shell.*' },
      { id: 'skill', name: '说明书', ident: 'skills/gwb-shell' },
    ],
  },
  {
    id: 'kernel',
    name: '内核',
    pkg: '@godcreator/gwb-kernel-desktop',
    role: null,
    outside: true,
    blurb: 'Electron 应用本体，在各插件的 peer 里：给插件的上下文类型、页面根、浏览器模块登记、页面与主进程之间的通道。它不认识外壳，也不认识任何窗格。',
    caps: [
      { id: 'k-root', name: '页面根', ident: 'setShell' },
      { id: 'k-types', name: '接口类型', ident: 'GwbContext' },
      { id: 'k-imports', name: '浏览器模块登记', ident: 'registerImports' },
      { id: 'k-channel', name: '页面通道', ident: 'window.gwb' },
    ],
  },
  {
    id: 'base',
    name: '基础插件',
    pkg: 'peer 依赖',
    role: null,
    outside: true,
    blurb: '在别的仓里的几个插件：命令总线、数据、设置、说明书、插件管理各提供一个服务。它们不依赖本仓。',
    caps: [
      { id: 'b-settings', name: '设置', ident: 'gwbSettings · settings.* · credentials.*' },
      { id: 'b-pm', name: '插件管理', ident: 'gwbPluginManager' },
      { id: 'b-skills', name: '说明书', ident: 'gwbSkills' },
      { id: 'b-data', name: '数据', ident: 'gwbData' },
      { id: 'b-commands', name: '命令总线', ident: 'gwbCommands' },
    ],
  },
];

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamEntry[]} */
const entries = [{ id: 'human', name: '人（界面）', to: 'page' }];

/** @type {import('@godcreator/docfirst-explainer/seam-graph').SeamInput[]} */
const seams = [
  /* ref file="../plugins/shell/src/index.ts" lines="5-5" hash="e625505ae75a" blob="d8029385df74" */
  /* ref file="../plugins/shell/src/vocab.ts" lines="3-10" hash="9ad006ba233b" blob="1f37046cda5d" */
  {
    n: 1,
    name: '接口类型',
    a: ['service', 'theme-core', 'baseui-apply'],
    b: ['k-types'],
    iface: "import type { GwbContext, GwbKernelApi } from '@godcreator/gwb-kernel-desktop'；requireKernel(ctx)",
    convention: false,
    via: 'code',
    text: '三个插件的 node 侧从内核包的包根只 import type（包根一加载就启动 Electron 应用），peer 里写内核包。外壳在构造时取 ctx.gwbKernel，不写进 inject，不在 gwb 内核里就当场抛错。',
  },
  /* ref file="../plugins/shell/src/index.ts" lines="157-163" hash="4c4709b8e5ae" blob="f97ef75dc0ff" */
  /* ref file="../plugins/shell/src/client/index.tsx" lines="709-730" hash="300e176c4eac" blob="d5ac26e76c09" */
  {
    n: 2,
    name: '外壳接管',
    a: ['page'],
    b: ['k-root'],
    iface: 'gwbKernel.setShell(url) → 撤销函数；export default mountShell(root: HTMLElement): { dispose(): void }',
    convention: false,
    via: 'code',
    text: '外壳在 ctx.effect 里把 client.js 的地址交给 setShell，内核的页面根 import 它、把 #root 交给默认导出 mountShell，留下回的 dispose。外壳卸载时页面根先调 dispose 再清空 #root，所以 dispose 要同步卸载完。',
  },
  /* ref file="../plugins/shell/src/browser-imports.ts" hash="b3a836f060d8" blob="981722f5237b" */
  /* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="17-24" hash="a5a81f216f2b" blob="056b20dadf53" */
  {
    n: 3,
    name: '浏览器模块',
    a: ['react'],
    b: ['k-imports'],
    iface: 'gwbKernel.registerImports(browserImports()) → 撤销函数；window.gwb.prepareImports()',
    convention: false,
    via: 'code',
    text: '外壳在 setShell 之前把 react、react/jsx-runtime、react-dom、react-dom/client 四个包名登记到自己 dist/react/ 下的文件；页面入口和每个窗格在动态 import 之前先等 prepareImports，所有窗格解析到同一份 React。',
  },
  /* ref file="../plugins/shell/src/desktops.ts" lines="3-4" hash="c69f395af73f" blob="8d8779b5e92e" */
  /* ref file="../plugins/shell/src/pane-actions.ts" lines="4-5" hash="d56d77a3805d" blob="fb1659d884db" */
  /* ref file="../plugins/shell/src/open-pane.ts" lines="4-5" hash="d6947328f824" blob="4b59d533f10f" */
  /* ref file="../plugins/shell/src/client/index.tsx" lines="1-1" hash="047a416dccea" blob="9b2b1fdf837c" */
  {
    n: 4,
    name: '页面通道',
    a: ['page', 'commands'],
    b: ['k-channel'],
    iface: "host.call = command(name, args)（@godcreator/gwb-commands/client）→ window.gwb.request；gwbKernel.emit({ t, … }) → window.gwb.on(cb)",
    convention: false,
    via: 'code',
    text: '页面入口用命令插件的页面客户端 command 调命令（经内核的请求通道到命令总线）、收回执，交给窗格的 host.call 就是它；外壳 node 侧经 gwbKernel.emit 把桌面、窗格、开窗格三类动作推给页面，页面按 t 区分是哪一类。',
  },
  /* ref file="../plugins/shell/src/index.ts" lines="180-183" hash="b510fbb0c95b" blob="f97ef75dc0ff" */
  /* ref file="../plugins/theme/src/index.ts" lines="112-118" hash="6af3eafdd259" blob="c80681eff873" */
  /* ref file="../plugins/baseui/src/index.ts" lines="27-45" hash="28cd476cc2fc" blob="7b7e30b1a7cd" */
  {
    n: 5,
    name: '命令登记',
    a: ['commands', 'theme-core', 'baseui-apply'],
    b: ['b-commands'],
    iface: 'gwbCommands.register({ name, description, usage, effect, plugin? }, handler)',
    convention: false,
    via: 'code',
    text: '外壳、外观与基础界面把各自的命令登记到命令总线，每条都标 effect（read / write），插件卸载时自动注销。外壳与外观的 plugin 写自己的包名，是它们的必需依赖：外壳的窗格注册表只能经命令传到页面。基础界面局部注入命令总线，有它才登记 logger.query，plugin 不写、由命令总线取。',
  },
  /* ref file="../plugins/shell/src/layout.ts" lines="1-8" hash="36d49f61bf66" blob="51963d44d83e" */
  /* ref file="../plugins/shell/src/layout.ts" lines="29-36" hash="50ac701e1f73" blob="51963d44d83e" */
  {
    n: 6,
    name: '布局文件',
    a: ['commands'],
    b: ['b-data'],
    iface: "gwbData.readDoc('layout')；gwbData.writeDoc('layout', { v: 3, active, desktops, saved })",
    convention: false,
    via: 'code',
    text: '外壳把各桌面的布局、重启回到哪张桌面、人起名存下的布局存成数据插件里的一份文档 layout；shell.layout.save 整份替换，写之前校验形状，形状不对不写。',
  },
  /* ref file="../plugins/theme/src/index.ts" lines="63-86" hash="ff74955f188d" blob="8a696cae264c" */
  {
    n: 7,
    name: '外观设置',
    a: ['theme-core'],
    b: ['b-settings'],
    iface: 'gwbSettings.define({ key, title, type, default, description })；get(key)；set(key, value)',
    convention: false,
    via: 'code',
    text: '外观经设置插件声明 font-sans、font-mono、custom-css 三项 home 级设置，缺省空串；theme.values 读、theme.save 一次写齐三项。设置插件是外观的必需依赖。',
  },
  /* ref file="../plugins/shell/src/index.ts" lines="51-52" hash="ad63ef54ee4f" blob="bdace3d0a52a" */
  /* ref file="../plugins/shell/src/index.ts" lines="165-171" hash="84067ee58a76" blob="f97ef75dc0ff" */
  {
    n: 8,
    name: '说明书登记',
    a: ['skill'],
    b: ['b-skills'],
    iface: "ctx.inject(['gwbSkills'], …)；gwbSkills.register(new URL('../skills/', import.meta.url))",
    convention: false,
    via: 'disk',
    text: '外壳局部注入说明书插件，把随包发布的 skills/ 目录交给它，说明书插件从目录里读 gwb-shell/SKILL.md。说明书插件不在时外壳照常运行，后加载时补登记。',
  },
  /* ref file="../plugins/baseui/src/index.ts" lines="19-25" hash="26d4cbff9cc4" blob="7b7e30b1a7cd" */
  /* ref file="../plugins/baseui/src/index.ts" lines="47-54" hash="7a50e224b968" blob="7b7e30b1a7cd" */
  /* ref file="../plugins/baseui/src/client/panes/plugin-manager/receipts.ts" lines="1-12" hash="b79654560522" blob="f838b9d7d2ea" */
  {
    n: 9,
    name: '基础插件的窗格',
    a: ['baseui-apply', 'baseui-panes'],
    b: ['b-pm', 'b-settings'],
    iface: "ctx.inject(['gwbPluginManager'], …)；plugin-manager.*、settings.*、credentials.* 命令；import type … from '@godcreator/gwb-plugin-manager/receipts'",
    convention: false,
    via: 'code',
    text: '基础界面对插件管理的服务做局部注入，服务在才登记插件管理窗格；日志窗格总是登记，它调的 logger.query 是基础界面自己登记的。插件管理窗格里的操作经命令名调 plugin-manager.*、settings.*、credentials.*，插件管理的回执类型从它的 ./receipts 子路径 import type。',
  },
  /* ref file="../plugins/shell/src/index.ts" lines="84-99" hash="2a0c9d5c63f2" blob="f97ef75dc0ff" */
  /* ref file="../plugins/shell/src/pane-registry.ts" lines="4-21" hash="7838b69c2fc9" blob="22e4ca8931ac" */
  {
    n: 10,
    name: '窗格注册',
    a: ['theme-pane', 'baseui-apply', 'o-node'],
    b: ['service'],
    iface: 'ctx.gwbShell.registerPane({ id, title, icon?, client?, style?, kind? }) → 注销函数；describeSelf({ title, icon? })；registerStatusItem({ id, title, icon?, client, style? })',
    convention: false,
    via: 'code',
    text: '带界面的插件在 node 侧登记窗格、报自己的名字，要在状态栏上放按钮的再登记状态栏按钮；条目 id 与包名由外壳从调用方的上下文里取，插件卸载时自动注销。基础界面把外壳写进 inject，外观局部注入外壳。',
  },
  /* ref file="../plugins/shell/src/client/types.ts" lines="127-163" hash="24553ab6e550" blob="74813412c114" */
  {
    n: 11,
    name: '窗格挂载',
    a: ['theme-pane', 'baseui-panes', 'o-client'],
    b: ['pane'],
    iface: 'mountPane(args: PaneArgs, container: HTMLElement): PaneHandle（{ dispose(); retarget?(params) }）',
    convention: false,
    via: 'code',
    text: '打开窗格时外壳 import 注册时给的 client 地址，取导出 mountPane 同步调用，收下 { dispose, retarget? }。类型从只有类型的子路径 @godcreator/gwb-shell/pane import type。',
  },
  /* ref file="../plugins/shell/package.json" lines="17-20" hash="c4d663d53fe3" blob="ef9729d77335" */
  /* ref file="../plugins/theme/build.ts" lines="44-47" hash="9528639d0916" blob="0abda5a1aaeb" */
  {
    n: 12,
    name: '外置名单',
    a: ['theme-pane', 'baseui-panes', 'o-client'],
    b: ['react'],
    iface: "import { browserImports } from '@godcreator/gwb-shell/browser-imports'；esbuild external: Object.keys(browserImports())",
    convention: false,
    via: 'code',
    text: '带界面的插件构建浏览器侧时，把外壳登记的那几个包名当 external，留给页面解析到外壳的那份 React；别的依赖打包进自己的 client.js。',
  },
  /* ref file="../plugins/baseui/src/client/styles.css" lines="6-7" hash="3fb81638baca" blob="58e7b2609682" */
  {
    n: 13,
    name: '令牌映射',
    a: ['theme-pane', 'baseui-panes', 'o-client'],
    b: ['tokens'],
    iface: "@import '@godcreator/gwb-shell/theme.reference.css' theme(reference)；页面上的 theme.css",
    convention: false,
    via: 'disk',
    text: '插件的样式入口在构建期引用外壳的映射文件，bg-primary 这类类名编成 var(--primary)、不输出变量值；值在运行时读外壳最先注入的令牌表。',
  },
  /* ref file="../plugins/shell/src/startup-style.ts" lines="3-11" hash="20015c61fea2" blob="d48c30458e70" */
  /* ref file="../plugins/theme/src/client/index.tsx" lines="18-19" hash="cad6e1e036ba" blob="82cc4b455dbb" */
  /* ref file="../plugins/shell/src/client/theme-boot.ts" lines="3-4" hash="a668bd572a85" blob="20e3479e96b1" */
  {
    n: 14,
    name: '启动样式',
    a: ['theme-core', 'theme-pane'],
    b: ['service', 'page'],
    iface: "gwbShell.registerStartupStyle(read)；shell.env 的 startupCss；样式元素 id gwb-theme-style",
    convention: true,
    via: 'code',
    text: '外观插件局部注入外壳，调 registerStartupStyle 交出读函数，外壳只收一份；外壳答 shell.env 时调它，页面入口把回来的样式写进 id 为 gwb-theme-style 的样式元素、排在三张样式表之后；外观窗格预览时改的也是这张。样式元素的 id 两边各写一份，不互相 import。',
  },
  /* ref file="../plugins/baseui/src/client/panes/plugin-manager/index.tsx" lines="105-106" hash="4d3a00459fe8" blob="4c7bbe6d3b73" */
  {
    n: 15,
    name: '外壳的命令',
    a: ['baseui-panes', 'o-client'],
    b: ['commands'],
    iface: 'shell.plugins、shell.reload、shell.openPane、shell.pane.*、shell.desktop.* 等，经命令总线按名字调',
    convention: true,
    via: 'code',
    text: '别的插件的窗格与 agent 经命令总线按名字调外壳的命令：插件管理窗格取插件名、升级后整页重载，别的插件的窗格跨插件开窗格。外壳的包根不导出命令名，名字与回执形状以命令的 usage 为准。',
  },
];

export const systemGraph = defineSeamGraph({
  id: 'system',
  title: 'gwb 界面插件仓的插件、能力与接缝',
  intro:
    '接缝图：虚线框是本仓的三个插件（外壳、外观、基础界面），框里的方块是插件对外的能力；内核、基础插件、别的带界面的插件画在框外。跨框的线带编号就是接缝，实线是代码调用或 import，虚线是读磁盘上的文件。',
  frameLabel: '插件',
  modules,
  entries,
  seams,
});

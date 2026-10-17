/**
 * 外观插件 @godcreator/gwb-theme 的内部接缝图：包首页 <SeamMap module="theme" /> 画的就是它。
 * 虚线框是包里的文件，方块是文件对外给的东西；灰色实线框是包外的外壳、设置插件与命令总线。坐标在 theme.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/explainer';

/* ref file="../plugins/theme/src/index.ts" lines="19-31" hash="1b69520c5ca3" blob="8a696cae264c" */
/* ref file="../plugins/theme/src/index.ts" lines="144-173" hash="8420553967d9" blob="c80681eff873" */
/* ref file="../plugins/theme/src/startup-css.ts" lines="16-26" hash="0403e4a4a171" blob="694ae7e05e50" */
/* ref file="../plugins/theme/src/client/index.tsx" lines="15-30" hash="9c62cc1f0537" blob="82cc4b455dbb" */
/* ref file="../plugins/theme/src/client/values.ts" hash="5310c8bb18ce" blob="855b1447cb2e" */
/* ref file="../plugins/shell/src/startup-style.ts" lines="13-37" hash="620bc5f52897" blob="d48c30458e70" */
/* ref file="../plugins/shell/src/client/theme-boot.ts" lines="3-18" hash="be7555a77dbc" blob="20e3479e96b1" */
export const themeGraph = defineSeamGraph({
  id: 'theme',
  title: '外观插件内部的文件与接缝',
  intro:
    '外观插件内部接缝图：虚线框是包里的文件，框里的方块是它对外给的东西，灰色实线框是包外的外壳、设置插件与命令总线。' +
    'node 侧只有 src/index.ts 一个入口，浏览器侧是 src/client/ 下的外观窗格；两侧都 import 同一个 startup-css.ts。' +
    '外壳在图的最上面：它经命令总线按名字取启动样式、给外观窗格一个容器、和窗格共用页面上同一个样式元素，但不 import 本包的任何东西。',
  frameLabel: '文件',
  modules: [
    {
      id: 'shell',
      name: '外壳',
      pkg: '@godcreator/gwb-shell',
      role: null,
      outside: true,
      blurb:
        '外壳在本包里是可选的 peer。node 侧答 shell.env 时调本包登记的读函数取启动样式，页面侧把它写进页面、打开外观窗格时调 mountPane。' +
        '启动样式从 node 侧到页面侧是外壳自己经 shell.env 的回执传过去的，本包不经手。',
      caps: [
        { id: 'shell-register', name: '窗格与启动样式的登记', ident: 'registerPane · describeSelf · registerStartupStyle' },
        { id: 'shell-env', name: '启动时取启动样式', ident: 'shell.env → read()' },
        { id: 'shell-pane', name: '打开窗格', ident: 'PluginPane → mountPane' },
        { id: 'shell-apply', name: '写进页面', ident: 'applyStartupCss' },
      ],
    },
    {
      id: 'index',
      name: 'node 侧入口',
      pkg: 'src/index.ts',
      role: 'blue',
      outside: false,
      blurb:
        'apply 做四件事：声明三项 home 级设置（缺省空串）、登记三条命令、在外壳加载时登记「外观」窗格、在外壳加载时登记启动样式。' +
        '必需注入只有 gwbSettings 与 gwbCommands；外壳用局部注入，没有外壳时本插件照常加载。',
      caps: [
        { id: 'settings', name: '三项设置', ident: 'defineThemeSettings' },
        { id: 'register-pane', name: '登记外观窗格', ident: "inject(['gwbShell'])" },
        { id: 'valuesave', name: '取值与保存', ident: 'theme.values · theme.save' },
        { id: 'startup', name: '启动样式', ident: 'theme.startupCss · registerStartupStyle' },
      ],
    },
    {
      id: 'client',
      name: '外观窗格',
      pkg: 'src/client/index.tsx',
      role: 'violet',
      outside: false,
      blurb:
        '浏览器侧打成 dist/client.js。窗格打开先取当前值，取到之前保存按钮禁用、也不预览；输入时改写页面上的启动样式做预览，' +
        '点保存才写回设置；关窗格时把样式元素退回已保存的内容。',
      caps: [
        { id: 'mount', name: '挂载入口', ident: 'mountPane' },
        { id: 'appearance', name: '外观窗格', ident: 'Appearance' },
        { id: 'apply-page', name: '预览写进页面', ident: 'applyToPage' },
      ],
    },
    {
      id: 'settings-svc',
      name: '设置插件',
      pkg: '@godcreator/gwb-settings',
      role: null,
      outside: true,
      blurb: '必需注入。三项外观设置存在这个 home 的设置里，先 define 过的键才许 set。',
      caps: [{ id: 'settings-svc', name: '设置插件', ident: 'gwbSettings.define · get · set' }],
    },
    {
      id: 'commands',
      name: '命令总线',
      pkg: '@godcreator/gwb-commands',
      role: null,
      outside: true,
      blurb: '必需注入。三条命令登记在本插件的上下文上，本插件卸载时一起注销；外观窗格经它按名字调。',
      caps: [{ id: 'commands', name: '命令总线', ident: 'gwbCommands.register' }],
    },
    {
      id: 'startup-css',
      name: '启动样式的拼法',
      pkg: 'src/startup-css.ts',
      role: 'emerald',
      outside: false,
      blurb:
        '纯函数，不碰设置也不碰页面。两个字体各拼成 :root 上的一个变量，自定义 CSS 原样接在后面；三项全空就是空串。' +
        'node 侧的命令 theme.startupCss、登记给外壳的读函数与浏览器侧的预览都调它，保存下来的与预览看到的才是同一份。',
      caps: [{ id: 'build', name: '拼启动样式', ident: 'buildStartupCss(values)' }],
    },
    {
      id: 'values',
      name: '键名换算',
      pkg: 'src/client/values.ts',
      role: 'amber',
      outside: false,
      blurb:
        '命令用的键名是 font-sans / font-mono / custom-css，窗格里是 fontSans 这类字段名，这里在两种写法之间互相换算。' +
        '单放在 .ts 里：这几个键名跟 Tailwind 工具类同名，写在 .tsx 里会被 devkit 的样式检查当成漏了前缀的类名。',
      caps: [{ id: 'convert', name: '键名换算', ident: 'fieldValuesOf · saveArgsOf' }],
    },
  ],
  entries: [],
  seams: [
    {
      n: 1,
      name: '设置',
      a: ['settings'],
      b: ['settings-svc'],
      iface: "define({ key, type: 'string', default: '' }) · get(key) · set(key, value)",
      convention: false,
      via: 'code',
      text:
        'apply 一开始声明 font-sans、font-mono、custom-css 三项，缺省都是空串，空串的意思是「没设置、用令牌表里的默认值」。' +
        '读的时候不是字符串的值一律当空串；写只经 theme.save，逐项 set。',
    },
    {
      n: 2,
      name: '登记命令',
      a: ['valuesave', 'startup'],
      b: ['commands'],
      iface: 'register({ name, description, usage, plugin }, handler)',
      convention: false,
      via: 'code',
      text:
        '三条命令都写包名 @godcreator/gwb-theme。theme.save 的参数是外部输入：三个键必给、值都是字符串，缺键、多键、类型不对都回 ok:false，一项都不写。',
    },
    {
      n: 3,
      name: '登记启动样式',
      a: ['startup'],
      b: ['shell-register', 'shell-env'],
      iface: "inject(['gwbShell']) → registerStartupStyle(() => buildStartupCss(现值))；shell.env 时外壳调 read()",
      convention: false,
      via: 'code',
      text:
        '外壳不 import 本包（本包把外壳写在 peer 里，反过来会成环），所以由本包局部注入外壳、登记读函数，读函数读本插件自己上下文里的设置。' +
        '外壳只收一份；回空白当没设置，读的时候抛错就这次启动不带启动样式、记一条 error。',
    },
    {
      n: 4,
      name: '同一个拼法',
      a: ['startup', 'appearance'],
      b: ['build'],
      iface: 'buildStartupCss({ fontSans, fontMono, customCss }) → string',
      convention: false,
      via: 'code',
      text:
        'theme.startupCss 按设置里的现值调它，外观窗格按输入框里的值调它。两处用同一个函数，所以窗格里预览到的就是重启后外壳注入的那一段。',
    },
    {
      n: 5,
      name: '登记窗格',
      a: ['register-pane'],
      b: ['shell-register'],
      iface: "registerPane({ id: 'appearance', title: '外观', icon: 'palette', client, style }) · describeSelf({ title, icon })",
      convention: false,
      via: 'code',
      text:
        '包在 ctx.inject([\'gwbShell\'], …) 里：外壳在，才登记窗格、报名字；外壳不在，这一段一直等着，不影响三条命令。' +
        'client 与 style 是从本模块的 import.meta.url 算出的 dist/client.js 与 dist/style.css 的 file:// 地址。',
    },
    {
      n: 6,
      name: '挂载窗格',
      a: ['shell-pane'],
      b: ['mount'],
      iface: 'mountPane({ host, shell, pane }, container) → { dispose }',
      convention: false,
      via: 'code',
      text: '外壳打开外观窗格时 import dist/client.js、调 mountPane，交出一个容器。类型从 @godcreator/gwb-shell/pane 引。',
    },
    {
      n: 7,
      name: '取值与保存',
      a: ['appearance'],
      b: ['valuesave'],
      iface: "host.call('theme.values') · host.call('theme.save', { 'font-sans', 'font-mono', 'custom-css' })",
      convention: true,
      via: 'code',
      text:
        '窗格经外壳给的 host 按名字调 node 侧的两条命令，命令名在浏览器侧另写一份。保存一次写齐三项，所以取到当前值之前不许保存：' +
        '否则输入框里初始的空串会把三项设置全部清空。',
    },
    {
      n: 8,
      name: '键名换算',
      a: ['appearance'],
      b: ['convert'],
      iface: 'fieldValuesOf(data) → { fontSans, fontMono, customCss } · saveArgsOf(values)',
      convention: false,
      via: 'code',
      text: 'theme.values 回执的 data 形状不对就抛错、不当成空串：保存时三项都取自窗格里的值，当成空串的话一点保存就清空三项设置。',
    },
    {
      n: 9,
      name: '同一个样式元素',
      a: ['apply-page'],
      b: ['shell-apply'],
      iface: '<style id="gwb-theme-style">',
      convention: true,
      via: 'code',
      text:
        '外壳启动时把启动样式写进这个元素，外观窗格预览时按同一个 id 找到它改内容，没有就新建一个追加到 head 末尾。' +
        'id 两边各写一份、不互相 import；页面上始终只有一个。',
    },
  ],
});

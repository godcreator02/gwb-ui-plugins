/**
 * 基础界面插件 @godcreator/gwb-baseui 的内部接缝图：包首页 <SeamMap module="baseui" /> 画的就是它。
 * 虚线框是包里的文件或目录，方块是它对外给的东西；灰色实线框是包外的外壳与两个基础插件。坐标在 baseui.layout.ts。
 */
import { defineSeamGraph } from '@godcreator/docfirst-explainer/seam-graph';

/* ref file="../plugins/baseui/src/index.ts" lines="19-63" hash="2583acd32ff7" blob="7b7e30b1a7cd" */
/* ref file="../plugins/baseui/src/log-query/query.ts" lines="13-18" hash="51db280a3f1c" blob="279374238193" */
/* ref file="../plugins/baseui/src/client/index.tsx" lines="5-20" hash="863b17ec74d8" blob="d921eca3e035" */
/* ref file="../plugins/baseui/src/client/panes/logger/index.tsx" lines="81-98" hash="daecad3c3be5" blob="96aeb9f838ff" */
/* ref file="../plugins/baseui/src/client/panes/logger/receipts.ts" lines="24-43" hash="1891a30ecae2" blob="c3df10ff09fd" */
/* ref file="../plugins/baseui/src/client/panes/plugin-manager/index.tsx" lines="96-114" hash="8a967b88896d" blob="4c7bbe6d3b73" */
/* ref file="../plugins/baseui/src/client/panes/plugin-manager/receipts.ts" lines="20-48" hash="48f444e7d3a8" blob="f838b9d7d2ea" */
export const baseuiGraph = defineSeamGraph({
  id: 'baseui',
  title: '基础界面插件内部的文件与接缝',
  intro:
    '基础界面插件内部接缝图：虚线框是包里的文件或目录，框里的方块是它对外给的东西，灰色实线框是包外的外壳、插件管理与设置插件。' +
    '右边的 src/index.ts 是 node 侧：必需依赖只有外壳；日志窗格总是登记，插件管理的服务用一次局部注入，服务在才登记插件管理窗格；' +
    '命令总线也用一次局部注入，有它才登记 logger.query，处理函数在中间的 src/log-query/。' +
    '左边是浏览器侧：一个 client.js 按窗格 id 分派给 panes/ 下的各个窗格，窗格之间互不 import，只共用 components/ui。' +
    '窗格的所有操作都经命令总线按名字调，日志窗格调的 logger.query 也不例外。',
  frameLabel: '文件或目录',
  modules: [
    {
      id: 'shell',
      name: '外壳',
      pkg: '@godcreator/gwb-shell',
      role: null,
      outside: true,
      blurb: '唯一的必需依赖。node 侧登记窗格与报名字；页面侧打开窗格时调 mountPane；另有两条命令被插件管理窗格按名字调。',
      caps: [
        { id: 'shell-pane', name: '打开窗格', ident: 'PluginPane → mountPane' },
        { id: 'shell-cmds', name: '外壳命令', ident: 'shell.plugins · shell.reload' },
        { id: 'shell-register', name: '窗格注册', ident: 'registerPane · describeSelf' },
      ],
    },
    {
      id: 'client',
      name: '浏览器侧入口',
      pkg: 'src/client/index.tsx',
      role: 'violet',
      outside: false,
      blurb:
        '所有窗格共用一份 dist/client.js 与 dist/style.css，入口按 pane.id 分派；认不出的 id 在容器里写一句「基础界面没有叫 … 的窗格」。' +
        '窗格 id 在这里和 node 侧 registerPane 里各写一份。',
      caps: [{ id: 'dispatch', name: '按窗格 id 分派', ident: 'mountPane(args) → switch (args.pane.id)' }],
    },
    {
      id: 'pm-pane',
      name: '插件管理窗格',
      pkg: 'panes/plugin-manager/',
      role: 'amber',
      outside: false,
      blurb:
        '「已安装」每条条目一行、展开是那个插件的设置；「可安装」搜源上的包。包与条目、设置、插件名三份数据各取各的、各自失败，' +
        '没有事件推送，每次操作完重新取。升级之后由窗格自己整页刷新。',
      caps: [
        { id: 'pm-ops', name: '插件、配置与外壳操作', ident: 'callPluginManager · settings.* · credentials.* · shell.*' },
        { id: 'pm-mount', name: '插件管理窗格', ident: 'mountPane' },
      ],
    },
    {
      id: 'logger-pane',
      name: '日志窗格',
      pkg: 'panes/logger/',
      role: 'emerald',
      outside: false,
      blurb:
        '只调 logger.query：挂载时取最近一批，所在桌面可见时每秒带上次回执的 cursor 取新写的，切走不调、切回立刻取一次，同一时刻最多一个请求。' +
        '回执在窗格里逐项校验，有一条不对就整批报错。本窗格不许调用 console：页面的 console 也是日志来源，打一条会写进日志文件、下一次拉取时读回来再打。',
      caps: [
        { id: 'logger-data', name: '可见时拉取日志', ident: 'logger.query { after: cursor }' },
        { id: 'logger-mount', name: '日志窗格', ident: 'mountPane' },
      ],
    },
    {
      id: 'ui',
      name: '共享组件',
      pkg: 'components/ui/',
      role: 'cyan',
      outside: false,
      blurb: 'shadcn 命令行生成到本包里的组件源码，类名带 baseui: 前缀，跟着 client.js 一起打包。panes/ 下的窗格只准 import 这一层。',
      caps: [{ id: 'ui', name: '共享组件', ident: 'Button · Select · Switch · AlertDialog · …' }],
    },
    {
      id: 'settings-plugin',
      name: '设置插件',
      pkg: '@godcreator/gwb-settings',
      role: null,
      outside: true,
      blurb: '不写 peer、不注入：插件管理窗格只按命令名调它。设置插件没装时这些命令回失败，窗格照样能用，展开区写明设置取不到的原因。',
      caps: [{ id: 'settings-plugin', name: '设置插件', ident: 'settings.* · credentials.*' }],
    },
    {
      id: 'pm',
      name: '插件管理',
      pkg: '@godcreator/gwb-plugin-manager',
      role: null,
      outside: true,
      blurb:
        '可选 peer。服务 gwbPluginManager 上没有方法，只用来决定登不登记插件管理窗格；窗格的操作全部经 plugin-manager.* 命令，' +
        '回执类型从它只有类型的子路径 ./receipts 以 import type 引。',
      caps: [{ id: 'pm', name: '插件管理', ident: 'gwbPluginManager · plugin-manager.* · ./receipts' }],
    },
    {
      id: 'log-query',
      name: '查日志文件',
      pkg: 'src/log-query/',
      role: 'rose',
      outside: false,
      blurb:
        'logger.query 的参数校验与读文件：读内核写的 <home>/gwb.log 与轮转出的 gwb.log.1，从末尾按块倒着读，凑够 limit 条就停；回执 { file, cursor, entries }。' +
        '末尾内核还没写完的半行不返回；参数认不出、有一行不是内核写的形状都直接报错。',
      caps: [{ id: 'log-query', name: '查日志文件', ident: 'logQueryFrom · queryLogFile' }],
    },
    {
      id: 'index',
      name: 'node 侧入口',
      pkg: 'src/index.ts',
      role: 'blue',
      outside: false,
      blurb:
        'inject 只写 gwbShell。apply 报一次名字「基础界面」，无条件登记日志窗格；对插件管理开一段局部注入：服务在才登记插件管理窗格，服务卸载时窗格跟着注销，后装上时补登记。' +
        '对命令总线也开一段局部注入：有它才登记 logger.query（effect read，plugin 不写），它卸载时命令跟着注销。',
      caps: [
        { id: 'self', name: '报名字', ident: 'describeSelf' },
        { id: 'pm-reg', name: '登记插件管理窗格', ident: "inject(['gwbPluginManager'])" },
        { id: 'logger-reg', name: '登记日志窗格', ident: 'ctx.effect(registerPane)' },
        { id: 'query-reg', name: '登记 logger.query', ident: "inject(['gwbCommands'])" },
      ],
    },
  ],
  entries: [],
  seams: [
    {
      n: 1,
      name: '登记窗格与报名字',
      a: ['self', 'pm-reg', 'logger-reg'],
      b: ['shell-register'],
      iface: "describeSelf({ title: '基础界面', icon: 'layout-grid' }) · registerPane({ id, title, icon, client, style })",
      convention: false,
      via: 'code',
      text:
        '报名字无条件做一次。日志窗格的 registerPane 包在 apply 的 ctx.effect 里，本插件卸载时注销；插件管理窗格的包在局部注入的 ctx.effect 里，服务一卸载就注销。' +
        '每个窗格报的 client 与 style 都是同一对地址：dist/client.js 与 dist/style.css。',
    },
    {
      n: 2,
      name: '插件管理服务在不在',
      a: ['pm-reg'],
      b: ['pm'],
      iface: "ctx.inject(['gwbPluginManager'], …)",
      convention: false,
      via: 'code',
      text:
        '只看服务在不在，不调它的任何方法，只决定登不登记插件管理窗格。插件管理升级自己时服务会短暂不在，这段时间里插件管理窗格也不在注册表里——所以升级后要等它回来再整页刷新。',
    },
    {
      n: 3,
      name: '挂载窗格',
      a: ['shell-pane'],
      b: ['dispatch'],
      iface: 'mountPane({ host, shell, pane }, container) → { dispose }',
      convention: false,
      via: 'code',
      text: '外壳打开本插件的哪个窗格，都 import 同一个 dist/client.js、调它导出的 mountPane。类型从 @godcreator/gwb-shell/pane 引。',
    },
    {
      n: 4,
      name: '按 id 分派',
      a: ['dispatch'],
      b: ['pm-mount', 'logger-mount'],
      iface: "args.pane.id === 'logger' | 'plugin-manager'",
      convention: true,
      via: 'code',
      text: '入口按 pane.id 调对应窗格目录里的 mountPane。id 是 node 侧 registerPane 时写的字符串，两处各写一份，改一处要改另一处。',
    },
    {
      n: 5,
      name: '日志命令',
      a: ['logger-data'],
      b: ['log-query'],
      iface: "host.call('logger.query', {} | { after: cursor }) → { file, cursor, entries }",
      convention: true,
      via: 'code',
      text:
        '窗格经命令总线按名字调，不 import src/log-query/ 的类型，按形状逐项收窄回执，有一条不对就整批报错并显示原因。条目没有序号：每次只取上次 cursor 之后新写的，两批不交叠、不去重；' +
        '失败时 cursor 不动，下一秒再试。底栏显示回执里的 file。',
    },
    {
      n: 6,
      name: '插件管理命令',
      a: ['pm-ops'],
      b: ['pm'],
      iface: "callPluginManager(host, 'plugin-manager.list' | …) → PluginManagerReceipts[命令]",
      convention: false,
      via: 'code',
      text:
        '各条 plugin-manager.* 命令的回执类型从 @godcreator/gwb-plugin-manager/receipts 以 import type 引，两边是同一套类型：' +
        '回执形状对不上在构建时的类型检查里报出来，窗格只按外层 ok 分开成功与失败。',
    },
    {
      n: 7,
      name: '设置与凭据命令',
      a: ['pm-ops'],
      b: ['settings-plugin'],
      iface: "host.call('settings.all' | 'settings.set' | 'settings.delete' | 'credentials.list' | 'credentials.set' | 'credentials.reveal' | 'credentials.delete', …)",
      convention: true,
      via: 'code',
      text:
        '设置插件不导出回执类型，窗格按形状收窄。settings.all 与 credentials.list 合并展示；凭据列表不回原文，本地查看用 credentials.reveal。保存与清除按类型调 settings 或 credentials 命令，有一个失败就全留在草稿里。',
    },
    {
      n: 8,
      name: '外壳命令',
      a: ['pm-ops'],
      b: ['shell-cmds'],
      iface: "host.call('shell.plugins') · host.call('shell.reload')",
      convention: true,
      via: 'code',
      text:
        'shell.plugins 给条目标题与图标，取不到就用条目 id。shell.reload 只在升级回执里升了的与跟着重新加载的条目全部回到运行状态时才调。',
    },
    {
      n: 9,
      name: '只 import 共享组件',
      a: ['logger-mount', 'pm-mount'],
      b: ['ui'],
      iface: "import { … } from '@/components/ui/…'",
      convention: false,
      via: 'code',
      text:
        '一窗格一模块：panes/ 下的窗格之间零 import，只准 import components/ui。所以日志窗格与插件管理窗格各有一份按形状收窄回执的小函数，不互相引用。',
    },
    {
      n: 10,
      name: '登记日志命令',
      a: ['query-reg'],
      b: ['log-query'],
      iface: "gwbCommands.register({ name: 'logger.query', description, usage: QUERY_USAGE, effect: 'read' }, (args) => queryLogFile(logFile, logQueryFrom(args)))",
      convention: false,
      via: 'code',
      text:
        '登记时从内核的 dataDir 算出 gwb.log 的绝对路径，处理函数把参数交给 logQueryFrom 校验、再交给 queryLogFile 读文件。' +
        '命令名、usage 与报错文字都在 src/log-query/query.ts，窗格与 agent 看到的就是这一份。',
    },
  ],
});

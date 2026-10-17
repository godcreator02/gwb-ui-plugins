/**
 * 「切桌面发生什么」的讲解数据：画面（desktop-switch.tsx）与机读版规则（desktop-switch.ai.mjs）都只读这一份。
 * 例子：从桌面 1（d1，开着日志与阅读·a）切到从没去过的桌面 2（d2，布局文件里存着一个查询窗格）。
 * 顺序照抄 client/index.tsx 的 switchTo 与 sweepBodyPortals；每一步给出两张桌面此刻的状态、布局文件里的 active、这一步在页面控制台与插件那头留下的记录。
 */

/** 两张桌面上开着的窗格 */
export const desks = [
  { id: 'd1', name: '桌面 1', panes: ['日志', '阅读·a'] },
  { id: 'd2', name: '桌面 2', panes: ['查询'] },
];

/**
 * 每一步结束时两张桌面的状态：shown 是显示着（否则 visibility:hidden、pointer-events:none、inert），mounted 是容器已挂载
 * @typedef {{ shown: boolean, mounted: boolean }} DeskState
 * @typedef {{ title: string, text: string, active: string, wrote: boolean, d1: DeskState, d2: DeskState, focus: string | null, log: { text: string, kind: 'cmd' | 'out' | 'ok' | 'err' }[] }} SwitchStep
 * @type {SwitchStep[]}
 */
/* ref file="../plugins/shell/src/client/index.tsx" lines="298-319" hash="9a8ddfec2114" blob="d5ac26e76c09" */
/* ref file="../plugins/shell/src/client/index.tsx" lines="95-111" hash="d1eaee67ad3a" blob="d5ac26e76c09" */
export const steps = [
  {
    title: '切之前',
    text:
      '一张桌面一个 dockview 容器，容器挂载后常驻。启动时只挂载活动那张（d1）；d2 从没去过，它的容器还没挂载，开着什么只记在布局文件里。' +
      '点状态栏「桌面」面板里的「桌面 2」，外壳调 switchTo(\'d2\')。',
    active: 'd1',
    wrote: false,
    d1: { shown: true, mounted: true },
    d2: { shown: false, mounted: false },
    focus: null,
    log: [],
  },
  {
    title: '先改 active，立刻整份写一次',
    text:
      '先把活动桌面改成 d2（wellHub 里的那份当场生效，这之后开的窗格落在新桌面上），把 d2 加进要挂载的清单，再立刻整份保存布局：此刻 d1 的容器还在，' +
      'toJSON 读到的是它当下的样子；d2 还没挂载，照抄文件里存的那份。shell.desktop.list 读的是磁盘上的文件，先写它才不会回上一轮的旧数据。',
    active: 'd2',
    wrote: true,
    d1: { shown: true, mounted: true },
    d2: { shown: false, mounted: false },
    focus: null,
    log: [{ kind: 'out', text: "shell.layout.save { v: 3, active: 'd2', desktops: [d1 当下的布局, d2 文件里那份], saved }" }],
  },
  {
    title: '改 React 状态，同时通知可见性',
    text:
      '同一段同步代码里接着改 React 状态（活动桌面是 d2），并按桌面 id 通知可见性：d1 上用 onVisibility 订阅过的窗格收到 false；' +
      'd2 上还没有窗格订阅过，外壳记下它此刻是 true。外壳只通知不强制：藏起来的桌面上插件照常运行，停订阅、停渲染、停视频是插件自己的事。',
    active: 'd2',
    wrote: false,
    d1: { shown: true, mounted: true },
    d2: { shown: false, mounted: false },
    focus: null,
    log: [{ kind: 'ok', text: 'd1 · 日志窗格的监听函数收到 false' }],
  },
  {
    title: 'React 提交：切显隐，d2 第一次挂载',
    text:
      'd1 的 section 加上 visibility:hidden、pointer-events:none 与 inert：只是看不见、点不到，DOM、定时器、订阅都还在运行。' +
      'd2 的 section 显示出来，它的容器第一次挂载，用文件里存的那份布局恢复，查询窗格这时才加载插件；插件在 mountPane 里订阅 onVisibility，订阅那一刻先收到一次当下的值 true。',
    active: 'd2',
    wrote: false,
    d1: { shown: false, mounted: true },
    d2: { shown: true, mounted: true },
    focus: null,
    log: [
      { kind: 'out', text: 'd2 容器挂载：fromJSON 恢复，查询窗格 mountPane' },
      { kind: 'ok', text: 'd2 · 查询窗格订阅 onVisibility，当场收到 true' },
    ],
  },
  {
    title: '焦点交给新桌面',
    text: 'visibility:hidden 的元素不能获得焦点，焦点会丢到 body 上。下一帧把焦点交给 d2 的 section，键盘不用先点一下就能用。',
    active: 'd2',
    wrote: false,
    d1: { shown: false, mounted: true },
    d2: { shown: true, mounted: true },
    focus: 'd2',
    log: [{ kind: 'out', text: 'section[data-gwb-desktop="d2"].focus()' }],
  },
  {
    title: '500ms 后检查 body，只报告不删除',
    text:
      '插件的浮层（下拉菜单、确认框）该挂载到 args.shell.portal，也就是自己那张桌面里的挂载点，桌面藏起来它跟着藏；挂在 body 上的藏不掉，会盖在别的桌面上。' +
      '切完隔 500ms 查 body 的直接子节点，#root、radix 的焦点护栏、标了 data-gwb-status-layer 的状态栏浮层不算，剩下的在控制台报出来。' +
      '隔 500ms 是因为切桌面常常是在状态栏的面板或菜单里点的，那一刻它们还在走退场动画，当场查会把它们误报出来。',
    active: 'd2',
    wrote: false,
    d1: { shown: false, mounted: true },
    d2: { shown: true, mounted: true },
    focus: 'd2',
    log: [{ kind: 'err', text: '[shell] 切到「桌面 2」时 body 上还挂着 1 个节点（多半是哪个插件的浮层没跟着自己桌面走——radix Portal 的挂载点该指到 args.shell.portal）：<div class="…">' }],
  },
];

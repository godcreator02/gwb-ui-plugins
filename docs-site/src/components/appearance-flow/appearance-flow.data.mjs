/**
 * 「外观设置怎么进页面」的全部讲解数据：画面（appearance-flow.tsx）与机读规则（appearance-flow.ai.mjs）都只读这一份。
 * 一个例子贯穿八步：home 里存着等宽字体与一段自定义 CSS，开机时经外壳注入页面；打开外观窗格改等宽字体、保存；
 * 再改正文字体、不保存就关掉窗格。每一步给出设置、这一步的调用、页面 <head> 里的样式元素与启动样式的内容。
 */

/** 设置的三个键，与外观插件 src/index.ts 里的键名一致 */
export const settingKeys = ['font-sans', 'font-mono', 'custom-css'];

const bootSettings = { 'font-sans': '', 'font-mono': 'Consolas, monospace', 'custom-css': ':root { --background: oklch(0.25 0.01 286); }' };
const savedSettings = { ...bootSettings, 'font-mono': 'Cascadia Mono' };

/** buildStartupCss 对上面两份设置拼出来的启动样式，以及窗格里再填上正文字体时的预览 */
/* ref file="../plugins/theme/src/startup-css.ts" lines="16-26" hash="0403e4a4a171" blob="694ae7e05e50" */
/* ref file="../plugins/theme/tests/startup-css.test.ts" lines="27-30" hash="25d9fb3e0653" blob="831a32b340db" */
const bootCss = [':root {', '  --gwb-font-mono: Consolas, monospace;', '}', '', ':root { --background: oklch(0.25 0.01 286); }'];
const editedCss = [':root {', '  --gwb-font-mono: Cascadia Mono;', '}', '', ':root { --background: oklch(0.25 0.01 286); }'];
const unsavedCss = [':root {', '  --gwb-font-sans: Inter;', '  --gwb-font-mono: Cascadia Mono;', '}', '', ':root { --background: oklch(0.25 0.01 286); }'];

/**
 * 页面 <head> 里与外观有关的元素，按文档顺序。layered 为 true 的整张表的规则都在 @layer 里。
 * 外壳的三张表地址与顺序由外壳 node 侧写死，启动样式排在它们之后。
 */
/* ref file="../plugins/shell/src/index.ts" lines="31-41" hash="84186942fe7c" blob="d8029385df74" */
/* ref file="../plugins/shell/src/client/index.tsx" lines="610-614" hash="b956510a4aab" blob="8d8ecbfb40b8" */
/* ref file="../plugins/shell/src/client/theme-boot.ts" lines="3-18" hash="be7555a77dbc" blob="20e3479e96b1" */
export const headElements = {
  tokens: { tag: '<link>', name: '@godcreator/gwb-shell/theme.css', note: '层顺序声明、preflight（在 base 层）、令牌 :root 与 .dark', layered: false },
  dockview: { tag: '<link>', name: 'gwb-shell/dist/dockview.css', note: 'dockview 的基础规则与 gwb 主题，不分层', layered: false },
  shell: { tag: '<link>', name: 'gwb-shell/dist/style.css', note: '外壳自己的工具类，shell: 前缀', layered: true },
  startup: { tag: '<style>', name: '#gwb-theme-style', note: '启动样式：字体变量与自定义 CSS，不分层', layered: false },
  pane: { tag: '<link>', name: 'gwb-theme/dist/style.css', note: '外观窗格的工具类，theme: 前缀', layered: true },
};

/**
 * 八步。actor 是这一步在动的那一方：settings 设置、shell 外壳、page 页面、pane 外观窗格。
 * head 是这一步结束时 <head> 里的元素，mark 标出这一步新加（new）或内容变了（changed）的那个。
 * css 是 #gwb-theme-style 此刻的内容，null 表示页面上还没有它。
 * @typedef {'settings' | 'shell' | 'page' | 'pane'} Actor
 * @typedef {{ key: keyof typeof headElements, mark?: 'new' | 'changed' | 'loading' }} HeadItem
 * @typedef {{ fields: Record<string, string>, dirty: string[], button: 'disabled' | 'enabled', notice: string }} PaneState
 * @typedef {{ id: string, title: string, text: string, actor: Actor, calls: string[], settings: Record<string, string>,
 *   settingsChanged: string[], head: HeadItem[], css: string[] | null, cssChanged: number[], pane: PaneState | null }} FlowStep
 * @type {FlowStep[]}
 */
/* ref file="../plugins/theme/src/index.ts" lines="112-141" hash="2429fca1d8a1" blob="8a696cae264c" */
/* ref file="../plugins/shell/src/startup-style.ts" lines="10-22" hash="20430d1445f0" blob="f4110e1b6678" */
/* ref file="../plugins/theme/src/client/index.tsx" lines="32-95" hash="15576f315894" blob="d52b9b51d84a" */
export const steps = [
  {
    id: 'stored',
    title: '三项设置存在 home 里',
    text:
      '外观插件加载时向设置插件声明 font-sans、font-mono、custom-css 三项，都是 home 级、缺省空串。这个 home 里存着等宽字体与一段自定义 CSS，正文字体没设置。' +
      '外观插件自己不碰页面：它只有设置和三条命令，页面此刻还是空的。',
    actor: 'settings',
    calls: ["gwbSettings.define({ key: 'font-sans' | 'font-mono' | 'custom-css', type: 'string', default: '' })"],
    settings: bootSettings,
    settingsChanged: [],
    head: [],
    css: null,
    cssChanged: [],
    pane: null,
  },
  {
    id: 'ask',
    title: '开机：外壳在 node 侧先问命令在不在',
    text:
      '页面问外壳要开机环境（shell.env）。外壳 node 侧先看命令表里有没有 theme.startupCss：没装外观插件就没有这条，外壳不调，环境里就没有 startupCss 这一项。' +
      '有才调，外观插件用 buildStartupCss 把三项现值拼成一段 CSS 回给外壳；回空白当没设置，回失败或不是字符串就记一条 error、这次开机不带启动样式。',
    actor: 'shell',
    calls: [
      "外壳 → 命令总线：list() 里有 'theme.startupCss'",
      "外壳 → 命令总线：run('theme.startupCss')",
      '外观插件：buildStartupCss(三项现值) → 一段 CSS',
      '外壳：shell.env 回 { home, styles, startupCss, versions }',
    ],
    settings: bootSettings,
    settingsChanged: [],
    head: [],
    css: bootCss,
    cssChanged: [],
    pane: null,
  },
  {
    id: 'sheets',
    title: '页面按顺序加载外壳的三张表，全部等到加载完',
    text:
      '页面按 shell.env 给的顺序追加三张表：令牌表第一个（层顺序由它声明），然后是 dockview 那张、外壳自己那张。每张都等 load 事件，' +
      '有一张加载不了，外壳就停在这一步、在根节点上写明是哪张。启动样式此刻还只在内存里。',
    actor: 'page',
    calls: ['loadStyle(styles[0..2])，都等 load'],
    settings: bootSettings,
    settingsChanged: [],
    head: [
      { key: 'tokens', mark: 'new' },
      { key: 'dockview', mark: 'new' },
      { key: 'shell', mark: 'new' },
    ],
    css: bootCss,
    cssChanged: [],
    pane: null,
  },
  {
    id: 'inject',
    title: '启动样式排在三张表之后、第一帧之前',
    text:
      '三张表都加载完，外壳才建 <style id="gwb-theme-style"> 追加到 head 末尾，然后才 createRoot 画第一帧。排在后面，是为了在同样的选择器上靠文档顺序压过令牌表的默认值；' +
      '在第一帧之前，重启后一打开就是用户的外观，不会先闪一下默认样子。这次没有启动样式时，外壳把上一次留下的这个元素删掉。',
    actor: 'page',
    calls: ['applyStartupCss(startupCss)', "html 加上 dark 类，createRoot(#root)"],
    settings: bootSettings,
    settingsChanged: [],
    head: [{ key: 'tokens' }, { key: 'dockview' }, { key: 'shell' }, { key: 'startup', mark: 'new' }],
    css: bootCss,
    cssChanged: [],
    pane: null,
  },
  {
    id: 'open',
    title: '打开外观窗格：取到当前值之前不预览、不许保存',
    text:
      '外壳加载外观窗格自己的样式表、调 mountPane。窗格先经 host 调 theme.values 取三项现值，取到之前保存按钮是禁用的，也不动页面上的启动样式：' +
      '保存是一次写齐三项，这时输入框里还是空串，一点保存就把三项设置全部清空。取到后窗格记下「已保存的样子」。',
    actor: 'pane',
    calls: ["host.call('theme.values') → { 'font-sans': '', 'font-mono': 'Consolas, monospace', 'custom-css': … }", 'fieldValuesOf(data)：形状不对就报错，不当成空串'],
    settings: bootSettings,
    settingsChanged: [],
    head: [{ key: 'tokens' }, { key: 'dockview' }, { key: 'shell' }, { key: 'startup' }, { key: 'pane', mark: 'new' }],
    css: bootCss,
    cssChanged: [],
    pane: { fields: bootSettings, dirty: [], button: 'enabled', notice: '' },
  },
  {
    id: 'preview',
    title: '输入即预览：改写同一个样式元素',
    text:
      '把等宽字体改成 Cascadia Mono。窗格用同一个 buildStartupCss 按输入框里的值重拼，按 id 找到 #gwb-theme-style 改它的内容，整页立刻换字体。' +
      '设置没动：预览只在页面上。',
    actor: 'pane',
    calls: ['buildStartupCss(输入框里的三项) → applyToPage(css)'],
    settings: bootSettings,
    settingsChanged: [],
    head: [{ key: 'tokens' }, { key: 'dockview' }, { key: 'shell' }, { key: 'startup', mark: 'changed' }, { key: 'pane' }],
    css: editedCss,
    cssChanged: [2],
    pane: { fields: savedSettings, dirty: ['font-mono'], button: 'enabled', notice: '' },
  },
  {
    id: 'save',
    title: '保存：theme.save 一次写齐三项',
    text:
      '点保存，窗格调 theme.save，三个键都给。外观插件先校验参数（缺键、多键、值不是字符串都回 ok:false、一项都不写），再逐项 set。' +
      '成功后窗格把「已保存的样子」换成这一份；下次开机，外壳取到的启动样式就是它。',
    actor: 'pane',
    calls: ["host.call('theme.save', { 'font-sans': '', 'font-mono': 'Cascadia Mono', 'custom-css': … })", 'gwbSettings.set × 3 → { ok: true }'],
    settings: savedSettings,
    settingsChanged: ['font-mono'],
    head: [{ key: 'tokens' }, { key: 'dockview' }, { key: 'shell' }, { key: 'startup' }, { key: 'pane' }],
    css: editedCss,
    cssChanged: [],
    pane: { fields: savedSettings, dirty: [], button: 'enabled', notice: '已保存，重启后仍然生效' },
  },
  {
    id: 'revert',
    title: '没保存就关窗格：退回已保存的样子',
    text:
      '再把正文字体填成 Inter，预览里多了一行 --gwb-font-sans，但没点保存就关了窗格。窗格卸载时把 #gwb-theme-style 写回「已保存的样子」：' +
      '不退回的话，页面上留着的预览重启后就没了，而当时看不出它没存。窗格自己的样式表留在页面上，外壳注入过的表不移除。',
    actor: 'pane',
    calls: ['预览：buildStartupCss(含 Inter) → applyToPage', '关窗格：applyToPage(已保存的那一份)'],
    settings: savedSettings,
    settingsChanged: [],
    head: [{ key: 'tokens' }, { key: 'dockview' }, { key: 'shell' }, { key: 'startup', mark: 'changed' }, { key: 'pane' }],
    css: editedCss,
    cssChanged: [],
    pane: null,
  },
];

/** 最后一步里关窗格之前那一刻的预览，画面上当作「被退回的内容」划掉显示 */
export const revertedPreview = unsavedCss;

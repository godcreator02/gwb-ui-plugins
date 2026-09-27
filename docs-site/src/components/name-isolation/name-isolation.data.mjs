/**
 * 「按位置隔离与按名字隔离」的全部讲解数据：画面（name-isolation.tsx）与机读规则（name-isolation.ai.mjs）都只读这一份。
 * DOM 树按外壳此刻渲染的结构简化：#root 是外壳的根，每张桌面一个 section，窗格容器在 dockview 的几层里面，
 * 这张桌面的浮层挂载点 .gwb-portal-host 是容器的兄弟节点，状态栏在桌面外面。
 * 按位置隔离是没有采用的做法：它的类名不带前缀，规则写成「某个 data-gwb-plugin 底下的 .x」。
 */

/**
 * DOM 树上的节点。bare 是按位置隔离时的写法（类名不带前缀），prefixed 是按名字隔离时的写法；
 * owner 是画出它的插件，决定它的颜色（整页固定：外壳蓝、baseui 绿）。
 * @typedef {{ id: string, depth: number, bare: string, prefixed: string, note: string, owner: 'shell' | 'baseui' | 'none' }} DomNode
 * @type {DomNode[]}
 */
/* ref file="../plugins/shell/src/client/desktop-context.ts" lines="6-19" hash="94bda74a41ae" blob="898ba65fba5e" */
/* ref file="../plugins/shell/src/client/PluginPane.tsx" lines="194-196" hash="630170c3e816" blob="056b20dadf53" */
export const nodes = [
  { id: 'body', depth: 0, bare: '<body>', prefixed: '<body>', note: '', owner: 'none' },
  {
    id: 'root',
    depth: 1,
    bare: '<div id="root" data-gwb-plugin="@godcreator/gwb-shell">',
    prefixed: '<div id="root" data-gwb-plugin="@godcreator/gwb-shell">',
    note: '外壳的根',
    owner: 'shell',
  },
  { id: 'desk', depth: 2, bare: '<section data-gwb-desktop="d1">', prefixed: '<section data-gwb-desktop="d1">', note: '一张桌面', owner: 'shell' },
  {
    id: 'pane',
    depth: 3,
    bare: '<div class="@container" data-gwb-plugin="@godcreator/gwb-baseui">',
    prefixed: '<div class="shell:@container" data-gwb-plugin="@godcreator/gwb-baseui">',
    note: '窗格容器（中间隔着 dockview 的几层）',
    owner: 'shell',
  },
  { id: 'btn', depth: 4, bare: '<button class="px-2">', prefixed: '<button class="baseui:px-2">', note: 'baseui 窗格里的按钮', owner: 'baseui' },
  { id: 'row', depth: 4, bare: '<div class="flex">', prefixed: '<div class="baseui:flex">', note: 'baseui 窗格里的一行', owner: 'baseui' },
  { id: 'host', depth: 3, bare: '<div class="gwb-portal-host">', prefixed: '<div class="gwb-portal-host">', note: '这张桌面的浮层挂载点', owner: 'shell' },
  {
    id: 'menu',
    depth: 4,
    bare: '<div role="menu" class="px-2">',
    prefixed: '<div role="menu" class="baseui:px-2">',
    note: 'baseui 的下拉菜单，portal 到这里',
    owner: 'baseui',
  },
  { id: 'bar', depth: 2, bare: '<div class="flex">', prefixed: '<div class="shell:flex">', note: '外壳的状态栏', owner: 'shell' },
];

/**
 * 每种情况：一条规则的选择器、写法（bare / prefixed）、它实际命中哪些节点，以及其中哪些是错的。
 * missed 是该命中却没命中的，leaked 是不该命中却命中的。
 * @typedef {{ id: string, label: string, text: string, mode: 'bare' | 'prefixed', selector: string, owner: 'shell' | 'baseui', matched: string[], missed: string[], leaked: string[] }} IsolationCase
 * @type {IsolationCase[]}
 */
export const cases = [
  {
    id: 'scope-portal',
    label: '按位置限定 baseui 的规则',
    text:
      '规则写成「baseui 窗格容器底下的 .px-2」。窗格里的按钮在容器底下，命中；下拉菜单被 radix 的 Portal 渲染到了桌面的浮层挂载点，' +
      '不在容器底下，这条规则碰不到它，整层菜单没有样式。没有任何报错，要等有人打开菜单才看得见。',
    mode: 'bare',
    selector: '[data-gwb-plugin="@godcreator/gwb-baseui"] .px-2',
    owner: 'baseui',
    matched: ['btn'],
    missed: ['menu'],
    leaked: [],
  },
  {
    id: 'scope-shell',
    label: '按位置限定外壳的规则',
    text:
      '外壳自己的规则写成「外壳根底下的 .flex」。外壳的根是每个窗格的祖先，baseui 窗格里写了 flex 的那一行也在它底下，' +
      '外壳的规则照样命中它：外壳改一条自己的样式，就可能改到别的插件画的元素。',
    mode: 'bare',
    selector: '[data-gwb-plugin="@godcreator/gwb-shell"] .flex',
    owner: 'shell',
    matched: ['row', 'bar'],
    missed: [],
    leaked: ['row'],
  },
  {
    id: 'prefix-baseui',
    label: '按名字：baseui 的规则',
    text:
      'baseui 的类名写成 baseui:px-2，编出的规则 .baseui\\:px-2 全页有效，跟元素在 DOM 里的位置无关：窗格里的按钮和渲染到浮层挂载点的菜单都带这个类，都命中。' +
      '别的插件写不出这个名字，所以碰不到别人的元素。',
    mode: 'prefixed',
    selector: '.baseui\\:px-2',
    owner: 'baseui',
    matched: ['btn', 'menu'],
    missed: [],
    leaked: [],
  },
  {
    id: 'prefix-shell',
    label: '按名字：外壳的规则',
    text:
      '外壳的类名是 shell:flex，规则 .shell\\:flex 只命中外壳自己画的状态栏。baseui 窗格里那一行虽然在外壳根底下，' +
      '它的类是 baseui:flex，不是同一个名字，不受影响。',
    mode: 'prefixed',
    selector: '.shell\\:flex',
    owner: 'shell',
    matched: ['bar'],
    missed: [],
    leaked: [],
  },
];

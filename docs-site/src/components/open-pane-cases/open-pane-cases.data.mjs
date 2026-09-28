/**
 * 「开一个窗格落在哪、做什么」的讲解数据：画面（open-pane-cases.tsx）与机读版规则（open-pane-cases.ai.mjs）都只读这一份。
 * 规则照抄 openable.ts 的 targetGroup 与 planOpen；每种情况给出打开之前与之后的桌面、目标组走到了哪一条、查重走到了哪一条、planOpen 回的判断。
 * 例子里的四个窗格：单元树、查询、日志是工具窗格，阅读是文档窗格（key 是它装的那一块）。
 */

/**
 * 目标组规则，placement 缺省（auto）时按顺序取第一个成立的
 * @type {{ id: string, when: string, then: string }[]}
 */
/* ref file="../plugins/shell/src/openable.ts" lines="220-239" hash="a1d81d082be8" blob="bb642a6dd7b3" */
export const autoRules = [
  { id: '1', when: '来源与要开的是同一个窗格定义', then: '来源所在的组' },
  { id: '2', when: '这张桌面上有最近用过的同类组（最近激活过、开着这个窗格）', then: '那一组' },
  { id: '3', when: '有来源', then: '来源组旁边：右边紧挨着有组就是那组，没有就把来源组对半分' },
  { id: '4', when: '有活动组', then: '活动组' },
  { id: '5', when: '桌面是空的', then: '新建一组' },
];

export const sideRule = {
  id: 'side',
  when: "placement: 'side'",
  then: '基准组（来源所在的组，没有来源用活动组）旁边：右边紧挨着有组就是那组，没有就把基准组对半分',
};

/**
 * 查重与结论，按 planOpen 的顺序；kinds 是这一条对哪类窗格适用
 * @type {{ id: string, kinds: ('tool' | 'document')[], text: string }[]}
 */
/* ref file="../plugins/shell/src/openable.ts" lines="284-323" hash="3bc017d2c454" blob="bfaa6b1a34ed" */
export const checks = [
  { id: 'tool-desk', kinds: ['tool'], text: '这张桌面任何一组里有同一窗格、同一 key → 激活它，在哪组就在哪组（是预览、这次正式打开 → 顺带转成正式窗格）' },
  { id: 'tool-else', kinds: ['tool'], text: '本桌没有、别的桌面上有 → 到那张桌面激活它（reveal）' },
  { id: 'doc-group', kinds: ['document'], text: '只在目标组里找同一 key → 激活它（是预览、这次正式打开 → 顺带转成正式窗格）' },
  { id: 'retarget', kinds: ['tool', 'document'], text: '没找到、要 preview、目标组里有这个窗格的预览窗格 → 原地换内容' },
  { id: 'new', kinds: ['tool', 'document'], text: '都没有 → 在目标组开新的一份，插在活动标签右边；要 preview 就标成预览' },
];

/** 例子里的窗格：label 是标签上的名字 */
export const panes = {
  tree: { label: '单元树', kind: 'tool' },
  query: { label: '查询', kind: 'tool' },
  logger: { label: '日志', kind: 'tool' },
  reader: { label: '阅读', kind: 'document' },
};

/**
 * 标签：pane 是哪个窗格，key 是装的内容；result 是这次打开之后它身上发生了什么
 * @typedef {{ pane: 'tree' | 'query' | 'logger' | 'reader', key?: string, active?: true, preview?: true, source?: true, result?: 'new' | 'focus' | 'retarget' | 'kept' }} Tab
 * @typedef {{ id: string, x: number, w: number, tabs: Tab[], target?: true, born?: true }} Group
 * @typedef {{ groups: Group[], other?: { name: string, tabs: Tab[] }, notice?: string }} Desk
 * @typedef {{ id: string, label: string, text: string, call: string, pane: 'tool' | 'document', rule: string, check: string, plan: string, before: Desk, after: Desk }} OpenCase
 * @type {OpenCase[]}
 */
export const cases = [
  {
    id: 'same-def',
    label: '笔记里 Ctrl+单击',
    call: "args.shell.openPane('reader', { key: 'b' })   来源：阅读·a",
    pane: 'document',
    rule: '1',
    check: 'new',
    plan: "{ kind: 'open', at: { group: 'g2', index: 1 } }",
    text:
      '来源与要开的是同一个窗格定义（都是阅读），目标组就是来源所在的 g2。文档窗格只在目标组里查重：g2 里没有装着 b 的那份，开一份新的正式标签，插在活动标签右边。',
    before: {
      groups: [
        { id: 'g1', x: 0, w: 38, tabs: [{ pane: 'tree', active: true }] },
        { id: 'g2', x: 38, w: 62, tabs: [{ pane: 'reader', key: 'a', active: true, source: true }] },
      ],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 38, tabs: [{ pane: 'tree', active: true }] },
        { id: 'g2', x: 38, w: 62, target: true, tabs: [{ pane: 'reader', key: 'a', source: true }, { pane: 'reader', key: 'b', active: true, result: 'new' }] },
      ],
    },
  },
  {
    id: 'recent',
    label: '查询里点一条结果（预览）',
    call: "shell.openPane { paneId: 'reader', key: 'b', preview: true, from: 查询 }",
    pane: 'document',
    rule: '2',
    check: 'retarget',
    plan: "{ kind: 'retarget', id: 阅读·a 那一份, params: { …, key: 'b', preview: true } }",
    text:
      '查询与阅读是两个插件，跨插件开窗格走命令，from 是查询那一份的实例 id。来源跟阅读不是同一个定义；这张桌面上最近激活过、又开着阅读的是 g2，目标就是它。' +
      'g2 里没有装着 b 的；要预览，g2 里已有阅读的预览窗格 → 原地换成 b，位置不动、窗格数不变。',
    before: {
      groups: [
        { id: 'g1', x: 0, w: 42, tabs: [{ pane: 'query', active: true, source: true }] },
        { id: 'g2', x: 42, w: 58, tabs: [{ pane: 'reader', key: 'a', preview: true, active: true }] },
      ],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 42, tabs: [{ pane: 'query', active: true, source: true }] },
        { id: 'g2', x: 42, w: 58, target: true, tabs: [{ pane: 'reader', key: 'b', preview: true, active: true, result: 'retarget' }] },
      ],
    },
  },
  {
    id: 'split',
    label: '单元树里第一次点开文件',
    call: "shell.openPane { paneId: 'reader', key: 'x', preview: true, from: 单元树 }",
    pane: 'document',
    rule: '3',
    check: 'new',
    plan: "{ kind: 'open', at: { split: 'g1' } }",
    text:
      '没有同定义的来源，这张桌面上也没有开着阅读的组；有来源，就开到来源旁边：单元树右边没有组，把 g1 对半分，右半边是新组，原文不盖住单元树。' +
      '新组是空的，没有可查重的，开一份新的并标成预览。对半分只切 g1 自己的一半，别的组不动。',
    before: {
      groups: [{ id: 'g1', x: 0, w: 100, tabs: [{ pane: 'tree', active: true, source: true }] }],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 50, tabs: [{ pane: 'tree', active: true, source: true }] },
        { id: 'g3', x: 50, w: 50, target: true, born: true, tabs: [{ pane: 'reader', key: 'x', preview: true, active: true, result: 'new' }] },
      ],
    },
  },
  {
    id: 'side',
    label: 'Ctrl+Alt+单击：开到旁边',
    call: "args.shell.openPane('reader', { key: 'b', placement: 'side' })   来源：阅读·a",
    pane: 'document',
    rule: 'side',
    check: 'new',
    plan: "{ kind: 'open', at: { group: 'g2', index: 1 } }",
    text:
      "placement: 'side' 不看定义：基准组是来源所在的 g1，它右边紧挨着 g2，就开进 g2，不再分出新组。「右边紧挨着」按组的矩形判：左边沿在基准组右边沿 16px 以内、竖向有重叠。",
    before: {
      groups: [
        { id: 'g1', x: 0, w: 50, tabs: [{ pane: 'reader', key: 'a', active: true, source: true }] },
        { id: 'g2', x: 50, w: 50, tabs: [{ pane: 'reader', key: 'c', active: true }] },
      ],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 50, tabs: [{ pane: 'reader', key: 'a', active: true, source: true }] },
        { id: 'g2', x: 50, w: 50, target: true, tabs: [{ pane: 'reader', key: 'c' }, { pane: 'reader', key: 'b', active: true, result: 'new' }] },
      ],
    },
  },
  {
    id: 'hit-preview',
    label: '正式打开已预览的内容',
    call: "shell.openPane { paneId: 'reader', key: 'a', from: 查询 }",
    pane: 'document',
    rule: '2',
    check: 'doc-group',
    plan: "{ kind: 'focus', id: 阅读·a 那一份, keep: true }",
    text: '目标组照规则 2 是 g2；g2 里有装着 a 的那份 → 激活它。它是预览窗格、这次是正式打开，顺带转成正式窗格：面板参数上的 preview 删掉，标签上的空心圆点消失。',
    before: {
      groups: [
        { id: 'g1', x: 0, w: 42, tabs: [{ pane: 'query', active: true, source: true }] },
        { id: 'g2', x: 42, w: 58, tabs: [{ pane: 'reader', key: 'c' }, { pane: 'reader', key: 'a', preview: true, active: true }] },
      ],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 42, tabs: [{ pane: 'query', active: true, source: true }] },
        { id: 'g2', x: 42, w: 58, target: true, tabs: [{ pane: 'reader', key: 'c' }, { pane: 'reader', key: 'a', active: true, result: 'kept' }] },
      ],
    },
  },
  {
    id: 'other-group',
    label: '别的组开着同一内容',
    call: "args.shell.openPane('reader', { key: 'a' })   来源：阅读·b",
    pane: 'document',
    rule: '1',
    check: 'new',
    plan: "{ kind: 'open', at: { group: 'g2', index: 1 } }",
    text:
      '同一内容在别的组开着不算命中：文档窗格只在目标组里查重。目标组是来源所在的 g2，g2 里没有 a，就在 g2 再开一份；g1 那份原样留着。要去已开的那份，用状态栏的「桌面」面板。',
    before: {
      groups: [
        { id: 'g1', x: 0, w: 50, tabs: [{ pane: 'reader', key: 'a', active: true }] },
        { id: 'g2', x: 50, w: 50, tabs: [{ pane: 'reader', key: 'b', active: true, source: true }] },
      ],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 50, tabs: [{ pane: 'reader', key: 'a', active: true }] },
        { id: 'g2', x: 50, w: 50, target: true, tabs: [{ pane: 'reader', key: 'b', source: true }, { pane: 'reader', key: 'a', active: true, result: 'new' }] },
      ],
    },
  },
  {
    id: 'tool-here',
    label: '工具窗格：本桌已有',
    call: "shell.openPane { paneId: 'logger' }",
    pane: 'tool',
    rule: '4',
    check: 'tool-desk',
    plan: "{ kind: 'focus', id: 日志那一份 }",
    text:
      '没有来源，最近激活顺序里也没有开着日志的组（整页重载后顺序从空开始），目标组是活动组 g2。但工具窗格查的是整张桌面：g1 里有同一窗格、同一 key（空串）的那份 → 在 g1 激活它，不挪到目标组。',
    before: {
      groups: [
        { id: 'g1', x: 0, w: 40, tabs: [{ pane: 'logger' }, { pane: 'tree', active: true }] },
        { id: 'g2', x: 40, w: 60, tabs: [{ pane: 'reader', key: 'a', active: true }] },
      ],
    },
    after: {
      groups: [
        { id: 'g1', x: 0, w: 40, tabs: [{ pane: 'logger', active: true, result: 'focus' }, { pane: 'tree' }] },
        { id: 'g2', x: 40, w: 60, target: true, tabs: [{ pane: 'reader', key: 'a', active: true }] },
      ],
    },
  },
  {
    id: 'tool-elsewhere',
    label: '工具窗格：开在别的桌面上',
    call: "shell.openPane { paneId: 'logger' }",
    pane: 'tool',
    rule: '4',
    check: 'tool-else',
    plan: "{ kind: 'reveal', desktop: 'd2', id: 日志那一份 }",
    text:
      '工具窗格整页至多一份：这张桌面没有、别的桌面上有 → 到那张桌面激活它，本桌不再开一份。插件与命令开的不切桌面，状态栏提示「『日志』在『桌面 2』· 切过去」；人在状态栏「新建」里点的会切过去。',
    before: {
      groups: [{ id: 'g1', x: 0, w: 100, tabs: [{ pane: 'reader', key: 'a', active: true }] }],
      other: { name: '桌面 2', tabs: [{ pane: 'tree' }, { pane: 'logger', active: true }] },
    },
    after: {
      groups: [{ id: 'g1', x: 0, w: 100, target: true, tabs: [{ pane: 'reader', key: 'a', active: true }] }],
      other: { name: '桌面 2', tabs: [{ pane: 'tree' }, { pane: 'logger', active: true, result: 'focus' }] },
      notice: '『日志』在『桌面 2』· 切过去',
    },
  },
  {
    id: 'empty',
    label: '桌面是空的',
    call: "shell.openPane { paneId: 'reader', key: 'a' }",
    pane: 'document',
    rule: '5',
    check: 'new',
    plan: '{ kind: \'open\', at: { empty: true } }',
    text: '这张桌面上一个组都没有：新建一组，开一份新的。运行时新建的桌面就是这样开始的，窗格由人自己开。',
    before: { groups: [] },
    after: { groups: [{ id: 'g1', x: 0, w: 100, target: true, born: true, tabs: [{ pane: 'reader', key: 'a', active: true, result: 'new' }] }] },
  },
];

/**
 * 「两张子集表叠进同一层」的全部讲解数据：画面（subset-sheets.tsx）与机读规则（subset-sheets.ai.mjs）都只读这一份。
 * 例子：基础界面（baseui）的元素写了 p-4 与 px-2，外观插件（theme）只用到 p-4；先看不加前缀时后加载的表怎样覆盖先加载的，再看加上前缀之后。
 * 规则里的 calc(var(--gwb-spacing) * n) 是令牌映射文件接管 --spacing 之后 Tailwind 编出的写法，--gwb-spacing 的值是 0.25rem。
 */

/** 两张表各自的来源与颜色（整页固定：baseui 蓝、theme 紫） */
export const sheets = {
  baseui: { file: 'baseui/dist/style.css', role: 'blue' },
  theme: { file: 'theme/dist/style.css', role: 'violet' },
};

const P4 = 'padding: calc(var(--gwb-spacing) * 4)';
const PX2 = 'padding-inline: calc(var(--gwb-spacing) * 2)';

/**
 * 每一步：
 * - classAttr：baseui 那个元素的 class
 * - compiled：还没进页面时两张表各有哪些规则（只有第一步有）
 * - layer：页面上 @layer utilities 里的规则，按加载先后；matches 是它命中不命中 baseui 的元素
 * - winner：决定这个元素左右内边距的那一条（layer 里的 key）
 * - paddingInline：这个元素最终的左右内边距（rem）；ok 是它跟写的一样不一样
 * @typedef {{ key: string, sheet: 'baseui' | 'theme', selector: string, decl: string, matches: boolean }} LayerRule
 * @typedef {{ id: string, title: string, text: string, classAttr: string, compiled?: Record<'baseui' | 'theme', { selector: string, decl: string }[]>, layer: LayerRule[], winner?: string, paddingInline?: number, ok?: boolean }} SheetStep
 * @type {SheetStep[]}
 */
export const steps = [
  {
    id: 'compile',
    title: '每个插件只编自己用到的类',
    text:
      'Tailwind 按需编译：扫描源码，用到哪个类才输出哪条规则。baseui 的元素写了 p-4 px-2，它的表里就有这两条；' +
      'theme 只用到 p-4，它的表里只有这一条。两张表都是全集的子集，而且各不相同。这一步先不加前缀，看不加会怎样。',
    classAttr: 'p-4 px-2',
    compiled: {
      baseui: [
        { selector: '.p-4', decl: P4 },
        { selector: '.px-2', decl: PX2 },
      ],
      theme: [{ selector: '.p-4', decl: P4 }],
    },
    layer: [],
  },
  {
    id: 'first',
    title: 'baseui 的表先加载',
    text:
      '外壳开 baseui 的窗格时注入它的表，两条规则进入页面的 @layer utilities。.px-2 排在 .p-4 后面，同层同权重时排在后面的生效：' +
      '上下 1rem、左右 0.5rem，跟写的一样。',
    classAttr: 'p-4 px-2',
    layer: [
      { key: 'b-p4', sheet: 'baseui', selector: '.p-4', decl: P4, matches: true },
      { key: 'b-px2', sheet: 'baseui', selector: '.px-2', decl: PX2, matches: true },
    ],
    winner: 'b-px2',
    paddingInline: 0.5,
    ok: true,
  },
  {
    id: 'second',
    title: 'theme 的表后加载，规则追加到同一层末尾',
    text:
      '再开 theme 的窗格，它的表注入在后面，那条 .p-4 追加到同一层的末尾。同层同权重，谁生效只看文档顺序：' +
      'theme 的 .p-4 排在 baseui 的 .px-2 之后，而且同样命中 baseui 的元素，左右内边距被改回 1rem。' +
      '两张表都编对了、都加载成功了，控制台里没有任何报错。',
    classAttr: 'p-4 px-2',
    layer: [
      { key: 'b-p4', sheet: 'baseui', selector: '.p-4', decl: P4, matches: true },
      { key: 'b-px2', sheet: 'baseui', selector: '.px-2', decl: PX2, matches: true },
      { key: 't-p4', sheet: 'theme', selector: '.p-4', decl: P4, matches: true },
    ],
    winner: 't-p4',
    paddingInline: 1,
    ok: false,
  },
  {
    id: 'prefix',
    title: '类名带上各自的前缀',
    text:
      '每个插件的类名带自己的前缀：baseui 写 baseui:p-4 baseui:px-2，编出 .baseui\\:p-4 与 .baseui\\:px-2；theme 编出 .theme\\:p-4。' +
      'theme 那条仍排在最后，但 baseui 的元素上没有 theme:p-4 这个类，它不命中；加载顺序不再影响结果。',
    classAttr: 'baseui:p-4 baseui:px-2',
    layer: [
      { key: 'b-p4', sheet: 'baseui', selector: '.baseui\\:p-4', decl: P4, matches: true },
      { key: 'b-px2', sheet: 'baseui', selector: '.baseui\\:px-2', decl: PX2, matches: true },
      { key: 't-p4', sheet: 'theme', selector: '.theme\\:p-4', decl: P4, matches: false },
    ],
    winner: 'b-px2',
    paddingInline: 0.5,
    ok: true,
  },
];

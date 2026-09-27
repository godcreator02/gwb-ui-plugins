/**
 * 「一个颜色令牌在构建时与运行时各经过哪几处」的全部讲解数据：画面（token-flow.tsx）与机读规则（token-flow.ai.mjs）都只读这一份。
 * 例子是 baseui 元素上的 baseui:bg-primary：构建时只查映射、不带值，运行时从页面上那份令牌读值；最后一步是反例——把变量值文件也引进插件构建。
 * 文件的颜色整页固定：外壳的令牌文件琥珀、baseui 的文件蓝、页面紫。
 */

/**
 * 每一步画几个文件卡片：file 是卡片标题，role 是颜色，lines 是卡片里的代码行，highlight 是高亮的行（1 起）。
 * swatch 是这一步元素最终读到的颜色：dark 表示 <html> 上有没有 dark 类，value 是 --primary 解析出的值。
 * @typedef {{ file: string, role: 'amber' | 'blue' | 'violet' | 'rose', note?: string, lines: string[], highlight?: [number, number] }} FileCard
 * @typedef {{ id: string, title: string, text: string, when: '构建时' | '运行时', cards: FileCard[], swatch?: { dark: boolean, value: string } }} TokenStep
 * @type {TokenStep[]}
 */
/* ref file="../plugins/shell/src/tokens/theme.reference.css" lines="1-6" hash="8da63830d4d9" blob="f5bcf4c3f472" */
/* ref file="../plugins/shell/src/tokens/theme.reference.css" lines="35-53" hash="ec12795b9aca" blob="f5bcf4c3f472" */
/* ref file="../plugins/baseui/src/client/styles.css" lines="6-8" hash="de446da5ccca" blob="58e7b2609682" */
/* ref file="../plugins/shell/build.ts" lines="145-154" hash="6cc8e157e7a5" blob="4dc419913506" */
/* ref file="../plugins/shell/src/tokens/tokens.css" lines="55-61" hash="e036e713f1aa" blob="ce74d1a59f41" */
/* ref file="../plugins/shell/src/tokens/tokens.css" lines="76-83" hash="061f161c432c" blob="ce74d1a59f41" */
export const steps = [
  {
    id: 'map',
    title: '映射文件只说「类名查哪个变量」',
    text:
      '外壳包里的 theme.reference.css 用 @theme inline 把颜色名映射到令牌变量：--color-primary 对应 var(--primary)。' +
      '它不输出任何变量值，只让 Tailwind 知道 bg-primary 这类类名存在、编出来引用哪个变量。',
    when: '构建时',
    cards: [
      {
        file: '@godcreator/gwb-shell/theme.reference.css',
        role: 'amber',
        lines: ['@custom-variant dark (&:is(.dark *));', '', '@theme inline {', '  --color-background: var(--background);', '  --color-primary: var(--primary);', '  …', '}'],
        highlight: [5, 5],
      },
    ],
  },
  {
    id: 'compile',
    title: 'baseui 编自己的表：规则里只有 var()',
    text:
      'baseui 的样式入口以 theme(reference) 引用这个映射文件，并在 Tailwind 主题那一行写 prefix(baseui)。编出的规则是 .baseui\\:bg-primary，' +
      '值是 var(--primary)：产物里没有 :root，也没有任何一个颜色值。',
    when: '构建时',
    cards: [
      {
        file: 'baseui/src/client/styles.css（样式入口）',
        role: 'blue',
        lines: [
          "@import 'tailwindcss/theme.css' theme(reference) prefix(baseui);",
          "@import '@godcreator/gwb-shell/theme.reference.css' theme(reference);",
          "@import 'tailwindcss/utilities.css' layer(utilities) source(none);",
        ],
        highlight: [2, 2],
      },
      {
        file: 'baseui/dist/style.css（编译产物）',
        role: 'blue',
        lines: ['@layer utilities {', '  .baseui\\:bg-primary {', '    background-color: var(--primary);', '  }', '}'],
        highlight: [3, 3],
      },
    ],
  },
  {
    id: 'inject',
    title: '页面最先加载令牌表 theme.css',
    text:
      '外壳开机时第一个注入的是自己包里的 theme.css：先声明层顺序，再把 preflight 包进 base 层，然后是令牌的值——亮色写在 :root，暗色写在 .dark。' +
      '全页只有这一份值。',
    when: '运行时',
    cards: [
      {
        file: '@godcreator/gwb-shell/theme.css',
        role: 'amber',
        note: '由 build.ts 拼成：层顺序 + preflight + tokens.css',
        lines: [
          '@layer theme, base, components, utilities;',
          '@layer base { /* preflight */ }',
          ':root {',
          '  --primary: oklch(0.21 0.006 285.885);',
          '}',
          '.dark {',
          '  --primary: oklch(0.92 0.004 286.32);',
          '}',
        ],
        highlight: [3, 8],
      },
    ],
  },
  {
    id: 'read-dark',
    title: '元素读值：<html> 上有 dark',
    text:
      '外壳开机时给 <html> 加上 dark 类，深色是默认。baseui 元素上的 baseui:bg-primary 读 var(--primary)，沿 DOM 继承读到 .dark 那一份值。' +
      '值不在 baseui 的产物里，所以 baseui 不知道、也不用知道它此刻是多少。',
    when: '运行时',
    cards: [
      {
        file: '页面',
        role: 'violet',
        lines: ['<html class="dockview-theme-gwb dark">', '  …', '    <div class="baseui:bg-primary">'],
        highlight: [1, 1],
      },
    ],
    swatch: { dark: true, value: 'oklch(0.92 0.004 286.32)' },
  },
  {
    id: 'read-light',
    title: '切到亮色：只去掉一个类',
    text:
      '状态栏的亮暗开关只切换 <html> 上的 dark 类。去掉之后，同一条 var(--primary) 读到 :root 那一份值；所有插件一起变，一个都不用重新构建。',
    when: '运行时',
    cards: [
      {
        file: '页面',
        role: 'violet',
        lines: ['<html class="dockview-theme-gwb">', '  …', '    <div class="baseui:bg-primary">'],
        highlight: [1, 1],
      },
    ],
    swatch: { dark: false, value: 'oklch(0.21 0.006 285.885)' },
  },
  {
    id: 'duplicate',
    title: '反例：把值文件也引进插件构建',
    text:
      'theme(reference) 只拦得住 @theme 块的输出，拦不住普通规则。插件的样式入口要是引了 tokens.css，产物里就多出一整份 :root 与 .dark。' +
      '这张表在窗格打开时才注入，排在令牌表和用户的外观样式之后，同权重时后来的生效：插件构建那一刻的旧值覆盖页面上的值，' +
      '外壳改了令牌、用户在外观里改了颜色，这个插件都换不到。所以值与映射分成两个文件，插件只引映射。',
    when: '构建时',
    cards: [
      {
        file: 'baseui/dist/style.css（引了 tokens.css 时）',
        role: 'rose',
        lines: [':root {', '  --primary: oklch(0.21 0.006 285.885);', '  …', '}', '.dark { … }', '@layer utilities { … }'],
        highlight: [1, 5],
      },
    ],
  },
];

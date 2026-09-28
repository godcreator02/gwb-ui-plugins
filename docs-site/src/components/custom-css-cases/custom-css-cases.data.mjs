/**
 * 「自定义 CSS 跟谁比」的讲解数据：画面（custom-css-cases.tsx）与机读规则（custom-css-cases.ai.mjs）都只读这一份。
 * 同一个元素上两条规则设置同一个属性时，浏览器依次比三样：在不在 @layer 里、选择器特异性、文档顺序，前一样分出胜负就不再往下比。
 * 用户的自定义 CSS 在 #gwb-theme-style 里：不分层，排在外壳三张表之后。每种情况各拿一条设置同一个属性的另一条规则跟它比。
 */

/** 三样依次比，前一样分出胜负就不再往下比（!important 与样式来源这里都用不到，不列） */
export const criteria = ['在不在 @layer 里', '选择器特异性', '文档顺序'];

/**
 * outcome：mine 是自定义 CSS 这一样赢，rival 是另一条规则赢，tie 是这一样相同、接着比下一样，skip 是前面已分出胜负、不用比。
 * @typedef {'mine' | 'rival' | 'tie' | 'skip'} Outcome
 * @typedef {{ rival: string, mine: string, outcome: Outcome }} Comparison
 * @typedef {{ id: string, label: string, text: string, rivalSource: string, rivalLines: string[], mineLines: string[],
 *   comparisons: Comparison[], winner: 'mine' | 'rival' }} CssCase
 * @type {CssCase[]}
 */
/* ref file="../plugins/shell/build.ts" lines="145-154" hash="6cc8e157e7a5" blob="4dc419913506" */
/* ref file="../plugins/shell/src/tokens/tokens.css" lines="55-55" hash="6618e9993c4b" blob="ce74d1a59f41" */
/* ref file="../plugins/shell/src/tokens/tokens.css" lines="76-77" hash="66c5be5a5ca2" blob="ce74d1a59f41" */
/* ref file="../plugins/shell/src/client/dockview-theme.css" lines="125-128" hash="60b7501ac77f" blob="88651873c676" */
/* ref file="../plugins/shell/src/client/StatusBar.tsx" lines="282-288" hash="f167fad29959" blob="a14c05f4f333" */
export const cases = [
  {
    id: 'utilities',
    label: '插件的工具类',
    text:
      '插件样式表里的工具类都在 @layer utilities 里，自定义 CSS 不分层。不分层的规则压过所有 @layer 里的规则，第一样就分出胜负，' +
      '插件那条的特异性再高、排得再靠后也一样。所以自定义 CSS 能改到任何一个插件的界面；反过来，选择器范围写得太宽（比如直接写 button）会改到所有插件。',
    rivalSource: '某个插件的 dist/style.css（示意）',
    rivalLines: ['@layer utilities {', '  .baseui\\:px-2 { padding-inline: …; }', '}'],
    mineLines: ['button { padding-inline: 0; }'],
    comparisons: [
      { rival: '在 @layer utilities 里', mine: '不分层', outcome: 'mine' },
      { rival: '(0,1,0)', mine: '(0,0,1)', outcome: 'skip' },
      { rival: '外观窗格等插件的表在后', mine: '在前', outcome: 'skip' },
    ],
    winner: 'mine',
  },
  {
    id: 'tokens',
    label: '令牌表的默认值',
    text:
      '令牌表里的变量值写在 :root 与 .dark 上，也不分层；两个选择器特异性都是 (0,1,0)，跟自定义 CSS 里的 :root 相同，最后比文档顺序：' +
      '#gwb-theme-style 排在令牌表之后，所以它赢。html 上有没有 dark 类都一样——.dark 那条也排在它前面，所以写在 :root 上的值亮暗两套都换掉。',
    rivalSource: '@godcreator/gwb-shell/theme.css（令牌表）',
    rivalLines: [':root {', '  --background: oklch(1 0 0);', '}', '.dark {', '  --background: oklch(0.19 0.005 286.033);', '}'],
    mineLines: [':root { --background: oklch(0.25 0.01 286); }'],
    comparisons: [
      { rival: '不分层', mine: '不分层', outcome: 'tie' },
      { rival: '(0,1,0)', mine: '(0,1,0)', outcome: 'tie' },
      { rival: '第 1 张', mine: '排在外壳三张表之后', outcome: 'mine' },
    ],
    winner: 'mine',
  },
  {
    id: 'dark-only',
    label: '只改暗色',
    text:
      '亮暗开关在外壳的状态栏里，只给 html 加上或去掉 dark 类，不经过外观插件，也不存进设置：每次启动外壳都先加上 dark。' +
      '令牌表的暗色值写在 .dark 上，所以只想改暗色，就在自定义 CSS 里也写 .dark：前两样跟令牌表的 .dark 相同，按文档顺序赢；切到亮色时 html 上没有 dark 类，这条不生效。',
    rivalSource: '@godcreator/gwb-shell/theme.css（令牌表）',
    rivalLines: ['.dark {', '  --background: oklch(0.19 0.005 286.033);', '}'],
    mineLines: ['.dark { --background: oklch(0.16 0.02 260); }'],
    comparisons: [
      { rival: '不分层', mine: '不分层', outcome: 'tie' },
      { rival: '(0,1,0)', mine: '(0,1,0)', outcome: 'tie' },
      { rival: '第 1 张', mine: '排在外壳三张表之后', outcome: 'mine' },
    ],
    winner: 'mine',
  },
  {
    id: 'dockview',
    label: 'dockview 的规则',
    text:
      'dockview 那张表不分层，选择器都挂在 .dockview-theme-gwb 下面，特异性是 (0,2,0)。自定义 CSS 只写 .dv-tab 是 (0,1,0)，第二样就输了，排得再靠后也没用。' +
      '要改 dockview 画的标签条、分隔条，选择器至少写到同样具体：.dockview-theme-gwb .dv-tab，再靠文档顺序赢。',
    rivalSource: 'gwb-shell/dist/dockview.css',
    rivalLines: ['.dockview-theme-gwb .dv-tab {', '  border-radius: var(--dv-tab-border-radius);', '  padding: 0;', '}'],
    mineLines: ['.dv-tab { padding: 0 8px; }'],
    comparisons: [
      { rival: '不分层', mine: '不分层', outcome: 'tie' },
      { rival: '(0,2,0)', mine: '(0,1,0)', outcome: 'rival' },
      { rival: '第 2 张', mine: '排在后面', outcome: 'skip' },
    ],
    winner: 'rival',
  },
];

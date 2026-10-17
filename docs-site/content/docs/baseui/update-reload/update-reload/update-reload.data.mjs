/**
 * 「升级之后要不要整页刷新」的讲解数据：画面（update-reload.tsx）与机读规则（update-reload.ai.mjs）都只读这一份。
 * 插件管理窗格点「更新」或「全部更新」后走四步：plugin-manager.update 的回执 → describeUpdateReceipt 写成几行话并定下要不要刷新
 * → 插件管理自己也升了就等它的条目重新加载起来 → shell.reload 整页重新加载。每种回执各走到哪一步为止。
 * 每种情况的回执与窗格上显示的文字取自 baseui 的测试 tests/panes/update-receipt.test.ts 与 update-receipt.ts 的拼法。
 */

/** 四步，按先后 */
export const stations = [
  { id: 'update', name: '更新命令', ident: 'plugin-manager.update' },
  { id: 'describe', name: '写成几行话', ident: 'describeUpdateReceipt' },
  { id: 'wait', name: '等插件管理自己', ident: 'waitForOwnRemount' },
  { id: 'reload', name: '整页重新加载', ident: 'shell.reload' },
];

/**
 * 每一步在这种情况下：pass 走过、stop 停在这里、skip 没走到或不用走。
 * @typedef {'pass' | 'stop' | 'skip'} StationState
 * @typedef {{ id: string, label: string, text: string, receipt: string[], shown: string[], failureLines: number[],
 *   states: Record<string, StationState>, notes: Record<string, string>, reloads: boolean }} UpdateCase
 * @type {UpdateCase[]}
 */
/* ref file="../plugins/baseui/src/client/panes/plugin-manager/update-receipt.ts" lines="31-100" hash="8de31aec8e1f" blob="3cde760c6c6f" */
/* ref file="../plugins/baseui/src/client/panes/plugin-manager/update-receipt.ts" lines="102-149" hash="51ac0956c072" blob="3cde760c6c6f" */
/* ref file="../plugins/baseui/src/client/panes/plugin-manager/index.tsx" lines="897-933" hash="62ec5f74a429" blob="4c7bbe6d3b73" */
/* ref file="../plugins/shell/src/client/panes.ts" lines="14-20" hash="0d94da49505d" blob="2530ca0a34f6" */
/* ref file="../plugins/baseui/tests/panes/update-receipt.test.ts" lines="8-37" hash="313e2181d4c0" blob="894159a7987a" */
/* ref file="../plugins/baseui/tests/panes/update-receipt.test.ts" lines="39-60" hash="70cfe602724a" blob="894159a7987a" */
/* ref file="../plugins/baseui/tests/panes/update-receipt.test.ts" lines="95-124" hash="991cdb49323c" blob="894159a7987a" */
/* ref file="../plugins/baseui/tests/panes/update-receipt.test.ts" lines="134-137" hash="c859cb24de18" blob="894159a7987a" */
/* ref file="../plugins/baseui/tests/panes/update-receipt.test.ts" lines="144-152" hash="aa9492c90169" blob="894159a7987a" */
export const cases = [
  {
    id: 'reload',
    label: '升了，条目都回来了',
    text:
      '回执里升了的包与跟着重新加载的包（dependents），每个条目都是 remounted 且回到 ACTIVE（停用着的 skipped 不算失败）。' +
      '窗格逐包列出版本与条目，接着自己调 shell.reload 整页重新加载：开着的窗格还在用旧的浏览器端代码，不刷新就用不上新版本。',
    receipt: [
      'ok: true',
      "updated: @x/gwb-hello 0.2.0 → 0.2.1，条目 hello（remounted，ACTIVE）、hello-2（skipped，disabled）",
      'updated: @x/gwb-tokens 0.0.5 → 0.0.6，没有条目',
      'dependents: 无；selfDeferred: false',
    ],
    shown: [
      '升了 2 个包：',
      '@x/gwb-hello 0.2.0 → 0.2.1：hello（remounted，ACTIVE）、hello-2（skipped，disabled）',
      '@x/gwb-tokens 0.0.5 → 0.0.6（没有条目）',
      '接着整页重新加载界面',
    ],
    failureLines: [],
    states: { update: 'pass', describe: 'pass', wait: 'skip', reload: 'pass' },
    notes: { wait: '插件管理自己没动，不用等' },
    reloads: true,
  },
  {
    id: 'self',
    label: '插件管理自己也升了',
    text:
      '回执的 selfDeferred 为真：插件管理自己的条目要在回执发出之后才重新加载，这段时间里它的服务不在，插件管理窗格也不在外壳的注册表里。' +
      '这时整页刷新，恢复出来的插件管理窗格挂载时按当场的注册表找不到自己，只显示一句「注册表里没有条目 … 的窗格 plugin-manager」。所以窗格先每 0.5 秒调一次 plugin-manager.list，' +
      '等插件管理自己的条目全部加载起来（或本来就停用）再刷新；每轮先等再问，马上问会问到还没卸载的旧的那份。30 秒还没加载起来就不刷新，把最后一次的原因显示出来。',
    receipt: [
      'ok: true',
      'updated: @godcreator/gwb-plugin-manager 0.12.1 → 0.13.0，条目 plugin-manager（deferred，ACTIVE）',
      'dependents: 无；selfDeferred: true',
    ],
    shown: [
      '升了 1 个包：',
      '@godcreator/gwb-plugin-manager 0.12.1 → 0.13.0：plugin-manager（deferred，ACTIVE）',
      '插件管理自己也升级了：等它重新加载完，再整页重新加载界面',
    ],
    failureLines: [],
    states: { update: 'pass', describe: 'pass', wait: 'pass', reload: 'pass' },
    notes: { wait: '每 0.5 秒问一次 plugin-manager.list，最多 30 秒' },
    reloads: true,
  },
  {
    id: 'failed',
    label: '有条目没回来',
    text:
      '重新加载时出错（failed），或重新加载了却停在 ACTIVE 以外的状态，都算没回到运行状态。窗格把回执算作失败，逐条列出，不自动刷新：' +
      '整页一刷新，这份失败清单就没了，人只能去日志里翻。代价是界面停在旧的浏览器端代码上，直到人看完原因点状态栏的「刷新」。',
    receipt: [
      'ok: true',
      'updated: @x/gwb-hello 0.2.0 → 0.2.1，条目 hello（failed，Error: boom）、hello-2（remounted，PENDING）、hello-3（skipped，disabled）',
      'dependents: @x/gwb-dep，条目 dep（remounted，FAILED）；selfDeferred: false',
    ],
    shown: [
      '升了 1 个包：',
      '@x/gwb-hello 0.2.0 → 0.2.1：hello（failed，Error: boom）、hello-2（remounted，PENDING）、hello-3（skipped，disabled）',
      '跟着重新加载 1 个包（自己没升级，依赖的包换了版本）：',
      '@x/gwb-dep：dep（remounted，FAILED）',
      '3 条条目没回到运行状态：',
      '@x/gwb-hello 的 hello：重新加载时出错：Error: boom',
      '@x/gwb-hello 的 hello-2：重新加载了，停在 PENDING',
      '@x/gwb-dep 的 dep：重新加载了，停在 FAILED',
      '看完上面的失败原因（日志里也有），点状态栏的「刷新」整页重新加载界面',
    ],
    failureLines: [5, 6, 7, 8],
    states: { update: 'pass', describe: 'stop', wait: 'skip', reload: 'skip' },
    notes: { describe: '有条目没回到运行状态，不自动刷新' },
    reloads: false,
  },
  {
    id: 'latest',
    label: '全都最新',
    text: '回执里 updated 与 dependents 都是空的，没有要换的浏览器端代码。窗格只显示回执的 note，不刷新。',
    receipt: ['ok: true', 'updated: 无；dependents: 无；selfDeferred: false', 'note: 全都最新'],
    shown: ['全都最新'],
    failureLines: [],
    states: { update: 'pass', describe: 'stop', wait: 'skip', reload: 'skip' },
    notes: { describe: '什么都没升，不刷新' },
    reloads: false,
  },
  {
    id: 'error',
    label: '命令没成',
    text:
      '失败的原因只在回执外层的 error 里，插件管理已经把 pnpm 输出的最后几行拼在里面，窗格一个字不改地显示出来。一条条目都没动，不刷新。',
    receipt: ['ok: false', 'error: pnpm add 没成（退出码 1）。一条条目都没动', '       ERR_PNPM_NO_MATCHING_VERSION'],
    shown: ['pnpm add 没成（退出码 1）。一条条目都没动', 'ERR_PNPM_NO_MATCHING_VERSION'],
    failureLines: [1, 2],
    states: { update: 'pass', describe: 'stop', wait: 'skip', reload: 'skip' },
    notes: { describe: '回执 ok: false，原样显示 error，不刷新' },
    reloads: false,
  },
];

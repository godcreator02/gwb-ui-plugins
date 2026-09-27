/**
 * 「一张桌面挂载时从哪份布局开始、要不要写盘」的讲解数据：画面（layout-boot.tsx）与机读版规则（layout-boot.ai.mjs）都只读这一份。
 * 每种情况走同一条路：开机读回的回执 → initialLayoutOf → 容器挂载时的 wellBootPlan → 磁盘上的布局文件，最后是状态栏上看得到什么。
 * 判断照抄 layout.ts 的 initialLayoutOf 与 wellBootPlan、client/index.tsx 的 onWellReady。
 */

/** 四个环节的标题 */
export const stages = [
  { id: 'reply', title: '开机时 shell.layout.get 回的' },
  { id: 'initial', title: 'initialLayoutOf：从哪份布局开始' },
  { id: 'boot', title: '容器挂载：wellBootPlan' },
  { id: 'disk', title: '磁盘上的布局文件' },
];

/**
 * @typedef {{ id: string, label: string, text: string, reply: string, initial: string, boot: string, disk: string, bar: string, tone: 'good' | 'warn' | 'bad' }} BootCase
 * @type {BootCase[]}
 */
/* ref file="../plugins/shell/src/layout.ts" lines="115-147" hash="b2a0d222a7c0" blob="51963d44d83e" */
/* ref file="../plugins/shell/src/client/index.tsx" lines="243-261" hash="06af3c3dcdf4" blob="9b2b1fdf837c" */
/* ref file="../plugins/shell/src/client/index.tsx" lines="279-280" hash="00cdc6b523b0" blob="9b2b1fdf837c" */
export const cases = [
  {
    id: 'first',
    label: '第一次开机',
    reply: '{ ok: true, data: undefined }',
    initial: '{ doc: defaultDoc() }：一张「桌面 1」，layout 为 null',
    boot: '{ restored: false, bornEmpty: false } → { openDefaults: true, save: \'debounced\' }',
    disk: '400ms 后整份写入：桌面 1 的默认布局',
    bar: '没有告警',
    tone: 'good',
    text:
      '只有回执 ok、data 是 undefined（gwbData 对不存在的文档回 undefined）才算第一次开机。桌面 1 没有保存过的布局，按默认布局打开：注册表里有几个窗格开几个，' +
      '全放在一组里；工具窗格整页别的桌面上已开着的不再开。打开默认布局那几次 addPanel 发生在订阅布局变化之前，dockview 丢掉订阅之前的变化，所以外壳自己排一次防抖保存。',
  },
  {
    id: 'restore',
    label: '读回一份 v3',
    reply: "{ ok: true, data: { v: 3, active: 'd2', desktops: […], saved: […] } }",
    initial: "{ doc }：原样用，活动桌面是 d2",
    boot: '桌面 d2 fromJSON 成功 → { openDefaults: false, save: \'none\' }',
    disk: '不写；之后布局一变，400ms 防抖后整份替换',
    bar: '没有告警',
    tone: 'good',
    text:
      '开机只挂载活动那张桌面（d2），用保存的布局 fromJSON 恢复，每一份窗格拿回自己的 key 与参数。恢复成功不用保存。别的桌面第一次切过去才挂载，挂载时同样先恢复它保存的那份。',
  },
  {
    id: 'unreachable',
    label: '读的命令调不通',
    reply: 'Promise.allSettled 的这一项是 rejected',
    initial: "{ doc: defaultDoc(), saveBlockedBy: 'shell.layout.get 调不通：…' }",
    boot: "{ openDefaults: true, save: 'debounced' }，但 flushSave 看到 saveBlockedBy 就不写",
    disk: '不写：磁盘上那份原样留着，下次开机还能再读',
    bar: '「布局没读回来，不保存」，悬停写着原因',
    tone: 'bad',
    text:
      '读不回来不阻止外壳启动：照样按默认布局打开，但这一轮不写盘，页面控制台一条 error。否则默认布局一打开就排一次保存，磁盘上那份读不回来的真布局被覆盖掉，再也找不回来。' +
      '点状态栏那一项弹确认框，人确认「覆盖」之后才用当前布局整份写一次、恢复自动保存。',
  },
  {
    id: 'not-ok',
    label: '读的命令回失败',
    reply: "{ ok: false, error: '…' }",
    initial: "{ doc: defaultDoc(), saveBlockedBy: 'shell.layout.get 没回布局文件：…' }",
    boot: "{ openDefaults: true, save: 'debounced' }，但不写",
    disk: '不写，原样留着',
    bar: '「布局没读回来，不保存」',
    tone: 'bad',
    text: '跟调不通一样处理，原因里带上回执的 error。回的不是一个回执对象也算这一种。',
  },
  {
    id: 'version',
    label: '版本认不出',
    reply: '{ ok: true, data: { v: 2, … } }',
    initial: "{ doc: defaultDoc(), saveBlockedBy: '磁盘上的布局文件认不出（v=2，外壳只认 v3）' }",
    boot: "{ openDefaults: true, save: 'debounced' }，但不写",
    disk: '不写，原样留着',
    bar: '「布局没读回来，不保存」，原因里写明读到的版本',
    tone: 'bad',
    text:
      '外壳只认 v3：别的版本（老的 v1、v2，将来的版本）、形状坏了、内容是 null，一律按读不回来处理。没有版本迁移——它从来没有使用者，外壳 0.15 删掉了。',
  },
  {
    id: 'restore-fail',
    label: '某张桌面恢复不了',
    reply: '{ ok: true, data: { v: 3, … } }',
    initial: '{ doc }：原样用',
    boot: "那张桌面 fromJSON 抛错 → saveBlockedBy 记下原因 → { openDefaults: true, save: 'debounced' }，但不写",
    disk: '不写，原样留着',
    bar: '「布局没读回来，不保存」，原因写着是哪张桌面',
    tone: 'bad',
    text:
      '文件认得出，但某张桌面保存的布局交给 dockview 恢复时抛错（文件坏了、dockview 升了版本）：这张桌面按默认布局打开，整页从这一刻起停止写盘，跟开机读不回来是同一个开关。',
  },
  {
    id: 'born',
    label: '运行时新建的桌面',
    reply: '不经过开机读取：createDesktop 加一行 layout: null，并记进「新建时为空」',
    initial: '—',
    boot: "{ restored: false, bornEmpty: true } → { openDefaults: false, save: 'now' }",
    disk: '立刻整份写一次：这张桌面的空快照替换文件里的 null',
    bar: '没有告警',
    tone: 'good',
    text:
      '新建的桌面为空，窗格由人自己开。空容器不触发布局事件，文件里这张桌面的 layout 会一直是 null，重启时就被当成「没保存过」按默认布局开满窗格；' +
      '所以容器挂载那一刻立刻保存一次。「送到新桌面」新建时不切过去、也先不保存，等挂载时这一次保存写进去。',
  },
];

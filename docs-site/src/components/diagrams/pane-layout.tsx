'use client'

/**
 * 窗格容器、同一个文档窗格开两份、布局文件的保存与恢复：上面两张桌面（第二张还没挂载），
 * 中间是保存命令，下面是 gwbData 里的 layout 文档，右边那条折线是开机时读回来恢复。
 */

import { Arrow, Box, Elbow, Frame, Note } from './parts'
import { StepControls, StepText, useSteps } from './steps'

type Part = 'desk1' | 'desk2' | 'copies' | 'save' | 'doc' | 'restore'

const STEPS: { title: string; detail: string; lit: Part[] }[] = [
  { title: '全貌', detail: '每张桌面一个窗格容器（一个 dockview 实例）；所有桌面的布局存在 gwbData 的同一份文档 layout 里。', lit: [] },
  { title: '一张桌面一个容器', detail: '开机只挂载活动那张桌面的容器；别的桌面第一次切过去才挂载，挂载后一直保留。', lit: ['desk1', 'desk2'] },
  {
    title: '同一个文档窗格开两份',
    detail: '同一个文档窗格用不同的 key 打开两次，得到两份实例：第一份的 id 就是基名 plugin:<entryId>:<窗格 id>，第二份追加 :2。key 与插件传的 params 存在面板的 params 里。',
    lit: ['copies'],
  },
  {
    title: '自动保存',
    detail: '任何一个容器的布局变了（onDidLayoutChange），400ms 防抖后按当下重新拼出整份文档（每张桌面的布局、active、saved），经 shell.layout.save 整份替换。切桌面时不等防抖，立刻保存一次。',
    lit: ['desk1', 'save', 'doc'],
  },
  {
    title: '开机恢复',
    detail: '开机时 shell.layout.get 读回这份文档，活动桌面的容器用 fromJSON 恢复，两份文档窗格各自拿回自己的 key 与 params。没有这份文档或认不出，就按默认布局打开注册表里的窗格。',
    lit: ['doc', 'restore', 'desk1', 'copies'],
  },
  {
    title: '起名保存的布局',
    detail: '状态栏「布局」菜单把活动容器的布局起名存进 saved（同名覆盖）；点清单里哪一条，就把它恢复到活动容器上。',
    lit: ['doc', 'desk1'],
  },
]

export function PaneLayout() {
  const state = useSteps(STEPS.length, 3400)
  const current = STEPS[state.step]!
  const lit = (part: Part) => (current.lit.includes(part) ? 'a' : undefined)
  const saving = current.lit.includes('save')
  const restoring = current.lit.includes('restore')

  return (
    <>
      <svg viewBox="0 0 400 452" role="img" aria-label="窗格容器、开两份的文档窗格与布局文件的保存和恢复">
        <Frame x={10} y={8} w={380} h={168} label="桌面 1（当前）· 窗格容器" lit={lit('desk1') === 'a'} />
        <Box x={24} y={40} w={80} h={32} lines={['日志']} />
        <Box x={112} y={40} w={124} h={32} lines={['文档']} tone={lit('copies')} />
        <Box x={244} y={40} w={132} h={32} lines={['文档 (2)']} tone={lit('copies')} />
        <Box x={24} y={86} w={170} h={76} lines={['第一份', 'plugin:…:doc', "key: 'a.md'"]} tone={lit('copies')} mono />
        <Box x={206} y={86} w={170} h={76} lines={['第二份', 'plugin:…:doc:2', "key: 'b.md'"]} tone={lit('copies')} mono />

        <Frame x={10} y={186} w={380} h={40} label="桌面 2（没切去过，容器还没挂载）" lit={lit('desk2') === 'a'} dashed />

        <Arrow from={[120, 226]} to={[120, 262]} label="布局一变 · 400ms 防抖" tone={saving ? 'a' : undefined} flow={saving} />
        <Box x={20} y={262} w={360} h={52} lines={['shell.layout.save', '整份替换']} tone={lit('save')} mono />
        <Arrow from={[120, 314]} to={[120, 340]} tone={saving ? 'a' : undefined} flow={saving} />
        <Box x={20} y={340} w={360} h={72} lines={['gwbData 文档 layout', 'desktops：每张桌面的名字与布局', 'active · saved（起名保存的布局）']} tone={lit('doc')} />

        <Elbow points={[[380, 376], [395, 376], [395, 100], [390, 100]]} tone={restoring ? 'a' : undefined} flow={restoring} />
        <Note x={20} y={436} color={restoring ? 'var(--diagram-a)' : undefined}>
          开机：shell.layout.get 读回 → 活动桌面 fromJSON
        </Note>
      </svg>
      <StepText title={current.title} detail={current.detail} />
      <StepControls count={STEPS.length} state={state} />
    </>
  )
}

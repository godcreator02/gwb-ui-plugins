'use client';
/**
 * 「外壳怎么接管内核的页面」：上面一条泳道是主进程（外壳服务、命令总线、内核服务），下面一条是页面（#root、准备段、mountShell、内核页面）。
 * 每一步亮起这一步参与的方块、画出这一步走过的箭头，下面给出这一步对应的源码。讲解文字与源码在 shell-boot.data.mjs。
 */
import type { JSX } from 'react';
import { Stepper } from '@godcreator/explainer-player';
import { CodeBlock, Lanes } from '../shell-lanes/lanes';
import type { LaneActor, LaneBand, LaneFlow } from '../shell-lanes/lanes';
import { actors, steps } from './shell-boot.data.mjs';

const VIEW = { w: 760, h: 300 };

const BANDS: LaneBand[] = [
  { label: '主进程', y: 8, h: 112 },
  { label: '页面', y: 136, h: 156 },
];

const BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  svc: { x: 24, y: 44, w: 190, h: 56 },
  bus: { x: 280, y: 44, w: 236, h: 56 },
  kernel: { x: 566, y: 44, w: 170, h: 56 },
  root: { x: 24, y: 200, w: 140, h: 56 },
  prep: { x: 186, y: 200, w: 160, h: 56 },
  mount: { x: 370, y: 200, w: 150, h: 56 },
  page: { x: 566, y: 200, w: 170, h: 56 },
};

const FLOWS: LaneFlow[] = [
  { id: 'setShell', points: [[119, 44], [119, 28], [651, 28], [651, 44]], label: 'registerImports · setShell', labelAt: [385, 23] },
  { id: 'push', points: [[651, 100], [651, 200]], label: 'onShell({ url })', labelAt: [700, 160] },
  { id: 'import', points: [[566, 228], [520, 228]] },
  { id: 'env', points: [[445, 200], [445, 100]], label: 'shell.env', labelAt: [445, 160] },
  { id: 'fetch', points: [[300, 200], [300, 100]], label: 'shell.panes · shell.layout.get', labelAt: [300, 160] },
  { id: 'render', points: [[186, 228], [164, 228]] },
  { id: 'dispose', points: [[566, 244], [520, 244]] },
  { id: 'unmount', points: [[445, 256], [445, 276], [94, 276], [94, 256]], label: 'unmount', labelAt: [270, 286] },
];

function placed(actor: (typeof actors)[number]): LaneActor {
  const box = BOX[actor.id];
  if (box === undefined) throw new Error(`外壳接管图的布局表里没有参与者「${actor.id}」`);
  return { ...actor, ...box };
}

const ACTORS = actors.map(placed);

export function ShellBootSteps(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={steps} label="外壳怎么接管内核的页面" interval={6000}>
        {(step) => (
          <>
            <Lanes view={VIEW} bands={BANDS} actors={ACTORS} flows={FLOWS} lit={step.lit} shown={step.shown} marks={step.marks} label={step.title} />
            <CodeBlock code={step.code} role={step.code.file.includes('/client/') ? 'amber' : 'blue'} />
          </>
        )}
      </Stepper>
    </div>
  );
}

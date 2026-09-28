'use client';
/**
 * 「一个窗格从注册到挂载到关闭」：上面一条泳道是主进程（插件的 apply、外壳服务），下面一条是页面
 * （dockview 面板、PluginPane、样式表、插件的 client.js）。每一步亮起参与的方块、画出走过的箭头，下面给出对应的源码。
 * 讲解文字与源码在 pane-mount.data.mjs。
 */
import type { JSX } from 'react';
import { Stepper } from '@godcreator/docfirst-explainer';
import { CodeBlock, Lanes } from '../shell-lanes/lanes';
import type { LaneActor, LaneBand, LaneFlow } from '../shell-lanes/lanes';
import { actors, steps } from './pane-mount.data.mjs';

const VIEW = { w: 760, h: 300 };

const BANDS: LaneBand[] = [
  { label: '主进程', y: 8, h: 112 },
  { label: '页面', y: 136, h: 156 },
];

const BOX: Record<string, { x: number; y: number; w: number; h: number }> = {
  plugin: { x: 24, y: 44, w: 190, h: 56 },
  svc: { x: 300, y: 44, w: 236, h: 56 },
  dock: { x: 24, y: 200, w: 150, h: 56 },
  pp: { x: 200, y: 200, w: 160, h: 56 },
  link: { x: 386, y: 200, w: 150, h: 56 },
  client: { x: 566, y: 200, w: 170, h: 56 },
};

/** PluginPane 到插件模块的几条箭头走同一条路：从下面绕过样式表 */
const TO_CLIENT: [number, number][] = [[280, 256], [280, 276], [651, 276], [651, 256]];

const FLOWS: LaneFlow[] = [
  { id: 'register', points: [[214, 72], [300, 72]], label: 'registerPane', labelAt: [257, 64] },
  { id: 'addPanel', points: [[174, 228], [200, 228]] },
  { id: 'panes', points: [[330, 200], [330, 100]], label: 'shell.panes', labelAt: [330, 160] },
  { id: 'style', points: [[360, 228], [386, 228]] },
  { id: 'import', points: TO_CLIENT, label: 'prepareImports → import(client)', labelAt: [465, 287] },
  { id: 'mount', points: TO_CLIENT, label: 'mountPane({ host, shell, pane }, container)', labelAt: [465, 287] },
  { id: 'retarget', points: TO_CLIENT, label: 'retarget(params) 或卸载后重新挂载', labelAt: [465, 287] },
  { id: 'dispose', points: TO_CLIENT, label: 'queueMicrotask → dispose()', labelAt: [465, 287] },
];

function placed(actor: (typeof actors)[number]): LaneActor {
  const box = BOX[actor.id];
  if (box === undefined) throw new Error(`窗格挂载图的布局表里没有参与者「${actor.id}」`);
  return { ...actor, ...box };
}

const ACTORS = actors.map(placed);

export function PaneMountSteps(): JSX.Element {
  return (
    <div className="not-prose">
      <Stepper steps={steps} label="一个窗格从注册到挂载到关闭" interval={6000}>
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

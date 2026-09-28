'use client';
/**
 * 「从主进程登记到窗格挂载完成」：上面一排是三处运行的地方，这一步在哪运行就亮哪一格；中间是这一步照抄的源码；
 * 下面四块是这一刻的状态——内核登记表、页面上已注入的 importmap、<head> 里的样式、#root——这一步变了的那块描边加深。
 * 讲解文字与状态都在 react-boot.data.mjs，机读版由 react-boot.ai.mjs 读同一份数据生成。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill, Stepper } from '@godcreator/docfirst-explainer';
import type { Role } from '@godcreator/docfirst-explainer';
import { lanes, steps } from './react-boot.data.mjs';
import './react-boot.css';

type BootStep = (typeof steps)[number];

function Lanes({ step }: { step: BootStep }): JSX.Element {
  return (
    <div className="rb-lanes">
      {lanes.map((lane) => (
        <div key={lane.id} className="rb-lane" data-role={lane.role} data-on={lane.id === step.lane}>
          <span className="rb-lane-label">{lane.label}</span>
          <span className="rb-lane-detail">{lane.detail}</span>
        </div>
      ))}
    </div>
  );
}

function Pairs({ pairs, empty }: { pairs: readonly (readonly string[])[]; empty: string }): JSX.Element {
  if (pairs.length === 0) return <p className="rb-empty">{empty}</p>;
  return (
    <ul className="rb-list">
      {pairs.map(([name, url]) => (
        <li key={name}>
          <code>{name}</code> → <code className="rb-url">{url}</code>
        </li>
      ))}
    </ul>
  );
}

function State({ step }: { step: BootStep }): JSX.Element {
  const changed = (name: string) => (step.changed as readonly string[]).includes(name);
  return (
    <div className="rb-state">
      <div className="rb-cell" data-changed={changed('registry')}>
        <Pane title="内核的登记表（主进程）" role={'amber' as Role}>
          <Pairs pairs={step.registry} empty="空" />
        </Pane>
      </div>
      <div className="rb-cell" data-changed={changed('importmap')}>
        <Pane title="页面上已注入的 importmap" role={'slate' as Role}>
          <Pairs pairs={step.importmap} empty="还没有" />
        </Pane>
      </div>
      <div className="rb-cell" data-changed={changed('styles')}>
        <Pane title="<head> 里的样式（按顺序）" role={'violet' as Role}>
          {step.styles.length === 0 ? (
            <p className="rb-empty">还没有</p>
          ) : (
            <ol className="rb-list rb-ol">
              {step.styles.map((style) => (
                <li key={style}>
                  <code className="rb-url">{style}</code>
                </li>
              ))}
            </ol>
          )}
        </Pane>
      </div>
      <div className="rb-cell" data-changed={changed('root')}>
        <Pane title="#root" role={'blue' as Role}>
          <p className="rb-root">{step.root}</p>
        </Pane>
      </div>
    </div>
  );
}

function Scene({ step }: { step: BootStep }): JSX.Element {
  return (
    <div className="rb-scene">
      <Lanes step={step} />
      {step.code !== undefined ? (
        <Pane title={step.code.file} role="slate" icon="file">
          <CodeLines lines={step.code.lines} highlight={step.code.highlight ?? null} tone="info" />
        </Pane>
      ) : null}
      <State step={step} />
      {step.fault ? (
        <Pill key={step.id} tone="bad" dot>
          GWB_IMPORTS_RELOAD_REQUIRED：要整页重载
        </Pill>
      ) : null}
    </div>
  );
}

export function ReactBoot(): JSX.Element {
  return (
    <Stepper steps={steps} label="从主进程登记到窗格挂载完成" interval={6000}>
      {(step) => <Scene step={step} />}
    </Stepper>
  );
}

'use client';
/**
 * 「切桌面发生什么」：上面是磁盘上布局文件里的 active，中间是两张桌面此刻的状态（显示、隐藏还是没挂载，焦点在哪），
 * 下面是到这一步为止页面控制台与插件那头留下的记录。讲解文字与例子在 desktop-switch.data.mjs。
 */
import type { JSX } from 'react';
import { CodeLines, Pane, Pill, Stepper, Terminal } from '@godcreator/docfirst-explainer';
import type { Role, TerminalLine } from '@godcreator/docfirst-explainer';
import { desks, steps } from './desktop-switch.data.mjs';
import './desktop-switch.css';

type SwitchStep = (typeof steps)[number];

/** 两张桌面各一种颜色 */
const DESK_ROLE: Record<string, Role> = { d1: 'blue', d2: 'violet' };

function fileLines(active: string): string[] {
  return ['{', '  "v": 3,', `  "active": "${active}",`, '  "desktops": [ { "id": "d1", … }, { "id": "d2", … } ],', '  "saved": []', '}'];
}

function DeskCard({ desk, step }: { desk: (typeof desks)[number]; step: SwitchStep }): JSX.Element {
  const state = desk.id === 'd1' ? step.d1 : step.d2;
  const label = !state.mounted ? '容器没挂载' : state.shown ? '显示' : '隐藏';
  return (
    <Pane
      title={`${desk.name}（${desk.id}）`}
      role={DESK_ROLE[desk.id]}
      extra={
        <Pill tone={!state.mounted ? 'pending' : state.shown ? 'good' : undefined} dot>
          {label}
        </Pill>
      }
    >
      <div className="ds-desk" data-shown={state.shown} data-mounted={state.mounted}>
        <div className="ds-panes">
          {desk.panes.map((pane) => (
            <span key={pane} className="ds-pane">
              {pane}
            </span>
          ))}
        </div>
        <div className="ds-note">
          {!state.mounted
            ? '开着什么只记在布局文件里，插件还没加载'
            : state.shown
              ? '看得见、点得到'
              : 'visibility:hidden · pointer-events:none · inert——DOM、定时器、订阅都还活着'}
        </div>
        {step.focus === desk.id ? <span className="ds-focus">焦点在这张桌面的 section 上</span> : null}
      </div>
    </Pane>
  );
}

function Scene({ step, index }: { step: SwitchStep; index: number }): JSX.Element {
  const log: TerminalLine[] = steps.slice(0, index + 1).flatMap((s) => s.log);
  return (
    <>
      <Pane
        title="磁盘上的布局文件（gwbData 的 layout 文档）"
        role="emerald"
        icon="file"
        extra={step.wrote ? <Pill tone="info">刚整份写入</Pill> : undefined}
      >
        <CodeLines lines={fileLines(index === 0 ? 'd1' : 'd2')} highlight={step.wrote ? [3, 3] : null} tone="info" changed={step.wrote ? [3] : []} />
      </Pane>
      <div className="ds-desks">
        {desks.map((desk) => (
          <DeskCard key={desk.id} desk={desk} step={step} />
        ))}
      </div>
      <Terminal title="页面控制台与插件" lines={log.length === 0 ? ['（还没有记录）'] : log} />
    </>
  );
}

export function DesktopSwitchSteps(): JSX.Element {
  return (
    <div className="desktop-switch not-prose">
      <Stepper steps={steps} label="切桌面发生什么" interval={6000}>
        {(step, index) => <Scene step={step} index={index} />}
      </Stepper>
    </div>
  );
}

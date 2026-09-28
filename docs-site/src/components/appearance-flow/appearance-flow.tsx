'use client';
/**
 * 「外观设置怎么进页面」：分步讲一个例子从 home 里的设置、经外壳在启动时注入页面，到外观窗格预览、保存、不保存就关掉。
 * 四块画面各管一方：设置（amber）、这一步的调用、页面 <head> 里的样式（cyan）、#gwb-theme-style 的内容（emerald），
 * 外观窗格（violet）在最下面。执行这一步的那一方标上「这一步」。讲解文字与数据都在 appearance-flow.data.mjs。
 */
import type { JSX, ReactNode } from 'react';
import { CodeLines, Diff, Pane, Pill, Stepper } from '@godcreator/docfirst-explainer';
import type { Role } from '@godcreator/docfirst-explainer';
import { headElements, revertedPreview, settingKeys, steps } from './appearance-flow.data.mjs';

type FlowStep = (typeof steps)[number];
type Actor = FlowStep['actor'];

const ACTOR_ROLE: Record<Actor, Role> = { settings: 'amber', shell: 'blue', page: 'cyan', pane: 'violet' };

function actorMark(step: FlowStep, actor: Actor): ReactNode {
  return step.actor === actor ? <Pill role={ACTOR_ROLE[actor]}>这一步</Pill> : null;
}

/** 空串就是没设置，显示成一句话，不留一个看不出有没有值的空格 */
function shown(value: string): string {
  return value === '' ? '（空，用令牌表的默认值）' : value;
}

function KeyRows({ values, changed }: { values: Record<string, string>; changed: readonly string[] }): JSX.Element {
  return (
    <div className="grid gap-1 font-mono text-xs">
      {settingKeys.map((key) => {
        const hit = changed.includes(key);
        return (
          <div
            key={key}
            data-role={hit ? 'amber' : undefined}
            className="grid grid-cols-[7.5em_minmax(0,1fr)] gap-2 rounded-md px-1.5 py-0.5"
            style={hit ? { background: 'color-mix(in srgb, var(--dx-c) 14%, transparent)' } : undefined}
          >
            <span style={{ color: 'var(--dx-dim)' }}>{key}</span>
            <span className="break-all" style={(values[key] ?? '') === '' ? { color: 'var(--dx-dim)' } : undefined}>
              {shown(values[key] ?? '')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Calls({ lines }: { lines: readonly string[] }): JSX.Element {
  return (
    <ol className="m-0 grid list-none gap-1 p-0 font-mono text-xs">
      {lines.map((line, i) => (
        <li key={line} className="flex gap-2">
          <span style={{ color: 'var(--dx-dim)' }}>{i + 1}.</span>
          <span className="break-all">{line}</span>
        </li>
      ))}
    </ol>
  );
}

const MARK_TEXT = { new: '这一步新加', changed: '这一步改了内容', loading: '加载中' } as const;

function Head({ step }: { step: FlowStep }): JSX.Element {
  if (step.head.length === 0) return <p className="m-0 text-xs" style={{ color: 'var(--dx-dim)' }}>还没有外壳的样式表</p>;
  return (
    <ol className="m-0 grid list-none gap-1.5 p-0">
      {step.head.map((item, i) => {
        const element = headElements[item.key];
        const isStartup = item.key === 'startup';
        return (
          <li
            key={item.key}
            data-role={isStartup ? 'emerald' : 'slate'}
            className="grid gap-0.5 rounded-lg border px-2 py-1"
            style={{
              borderColor: 'color-mix(in srgb, var(--dx-c) 35%, transparent)',
              background: item.mark === undefined ? undefined : 'color-mix(in srgb, var(--dx-c) 12%, transparent)',
              transition: 'background-color .3s',
            }}
          >
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
              <span style={{ color: 'var(--dx-dim)' }}>{i + 1}</span>
              <span>{element.tag}</span>
              <span className="font-semibold break-all">{element.name}</span>
              <span className="ml-auto flex gap-1">
                <Pill tone={element.layered ? 'info' : 'warn'}>{element.layered ? '在 @layer 里' : '不分层'}</Pill>
                {item.mark === undefined ? null : <Pill role={isStartup ? 'emerald' : 'cyan'}>{MARK_TEXT[item.mark]}</Pill>}
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--dx-dim)' }}>
              {element.note}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StartupCss({ step }: { step: FlowStep }): JSX.Element {
  if (step.css === null) return <p className="m-0 text-xs" style={{ color: 'var(--dx-dim)' }}>还没有拼出来</p>;
  if (step.id === 'revert') return <Diff old={revertedPreview} now={step.css} />;
  const inPage = step.head.some((item) => item.key === 'startup');
  const first = step.cssChanged[0];
  return (
    <>
      <CodeLines lines={step.css} highlight={first === undefined ? null : [first, step.cssChanged.at(-1)!]} tone="warn" />
      {inPage ? null : (
        <p className="m-0 text-xs" style={{ color: 'var(--dx-dim)' }}>
          这一段还在 shell.env 的回执里，页面上没有它
        </p>
      )}
    </>
  );
}

function AppearancePane({ step }: { step: FlowStep }): JSX.Element {
  const pane = step.pane;
  if (pane === null) {
    return (
      <p className="m-0 text-xs" style={{ color: 'var(--dx-dim)' }}>
        {step.id === 'revert' ? '已关掉：卸载时把 #gwb-theme-style 写回已保存的那一份' : '没打开'}
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <KeyRows values={pane.fields} changed={pane.dirty} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Pill tone={pane.button === 'enabled' ? 'good' : 'pending'} dot>
          保存按钮{pane.button === 'enabled' ? '可用' : '禁用'}
        </Pill>
        {pane.dirty.length > 0 ? <Pill tone="warn">有没保存的改动</Pill> : null}
        {pane.notice === '' ? null : <span style={{ color: 'var(--dx-dim)' }}>{pane.notice}</span>}
      </div>
    </div>
  );
}

function Scene({ step }: { step: FlowStep }): JSX.Element {
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 @2xl:grid-cols-2">
        <Pane title="home 里的三项设置" role="amber" icon="folder" extra={actorMark(step, 'settings')}>
          <KeyRows values={step.settings} changed={step.settingsChanged} />
        </Pane>
        <Pane title="这一步的调用" role="blue" icon="server" extra={actorMark(step, 'shell')}>
          <Calls lines={step.calls} />
        </Pane>
        <Pane title="页面 <head> 里的样式，按文档顺序" role="cyan" icon="file" extra={actorMark(step, 'page')}>
          <Head step={step} />
        </Pane>
        <Pane title="#gwb-theme-style 的内容" role="emerald" icon="file">
          <StartupCss step={step} />
        </Pane>
      </div>
      <Pane title="外观窗格" role="violet" icon="user" extra={actorMark(step, 'pane')}>
        <AppearancePane step={step} />
      </Pane>
    </div>
  );
}

export function AppearanceFlow(): JSX.Element {
  return (
    <Stepper steps={steps} label="外观设置怎么进页面" interval={6000}>
      {(step) => <Scene step={step} />}
    </Stepper>
  );
}

'use client';
/**
 * 「升级之后要不要整页刷新」：选一种回执，上面四步从左到右（窄屏从上到下）标出走过、停下、没走到，
 * 下面左边是回执的要点、右边是窗格上显示的几行话，失败的那几行标红。讲解文字与数据都在 update-reload.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, CodeLines, Pane, Pill } from '@godcreator/explainer-player';
import type { Tone } from '@godcreator/explainer-player';
import { cases, stations } from './update-reload.data.mjs';

type UpdateCase = (typeof cases)[number];
type StationState = UpdateCase['states'][string];

const STATE: Record<StationState, { tone?: Tone; text: string }> = {
  pass: { tone: 'good', text: '走过' },
  stop: { tone: 'warn', text: '停在这里' },
  skip: { text: '没走到' },
};

function Station({ item, index }: { item: UpdateCase; index: number }): JSX.Element {
  const station = stations[index]!;
  const state = item.states[station.id] ?? 'skip';
  const look = STATE[state];
  const note = item.notes[station.id];
  return (
    <div
      data-tone={look.tone}
      className="grid content-start gap-1 rounded-xl border p-2 text-xs"
      style={{
        borderColor: state === 'skip' ? 'var(--dx-line)' : 'color-mix(in srgb, var(--dx-c) 45%, transparent)',
        background: state === 'skip' ? undefined : 'color-mix(in srgb, var(--dx-c) 9%, transparent)',
        opacity: state === 'skip' ? 0.45 : 1,
        transition: 'opacity .3s, background-color .3s, border-color .3s',
      }}
    >
      <span className="font-semibold">
        {index + 1}. {station.name}
      </span>
      <code className="break-all" style={{ fontFamily: 'var(--dx-mono)', color: 'var(--dx-dim)' }}>
        {station.ident}
      </code>
      {look.tone === undefined ? <Pill>{look.text}</Pill> : <Pill tone={look.tone}>{look.text}</Pill>}
      {note === undefined ? null : <span style={{ color: 'var(--dx-dim)' }}>{note}</span>}
    </div>
  );
}

function Scene({ item }: { item: UpdateCase }): JSX.Element {
  const first = item.failureLines[0];
  const last = item.failureLines.at(-1);
  return (
    <div className="grid gap-2">
      <div className="grid gap-2 @xl:grid-cols-4">
        {stations.map((station, i) => (
          <Station key={station.id} item={item} index={i} />
        ))}
      </div>
      <div className="grid gap-2 @2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Pane title="plugin-manager.update 的回执" role="slate" icon="server">
          <CodeLines lines={item.receipt} />
        </Pane>
        <Pane
          title="插件管理窗格上显示的回执"
          role="amber"
          icon="user"
          extra={<Pill tone={item.reloads ? 'good' : 'warn'}>{item.reloads ? '接着整页刷新' : '不刷新'}</Pill>}
        >
          <CodeLines lines={item.shown} highlight={first === undefined || last === undefined ? null : [first, last]} tone="bad" />
        </Pane>
      </div>
    </div>
  );
}

export function UpdateReloadCases(): JSX.Element {
  return (
    <CasePicker cases={cases} label="插件管理窗格升级之后要不要整页刷新">
      {(item) => <Scene item={item} />}
    </CasePicker>
  );
}

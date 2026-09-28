'use client';
/**
 * 「一张桌面挂载时从哪份布局开始、要不要写盘」：选一种情况，四个环节排成一行（窄屏竖排），
 * 每个环节写这种情况下它得到什么，最后一行是状态栏上看得到什么。内容全在 layout-boot.data.mjs。
 */
import type { JSX } from 'react';
import { CasePicker, Pane, Pill } from '@godcreator/docfirst-explainer';
import type { Role } from '@godcreator/docfirst-explainer';
import { cases, stages } from './layout-boot.data.mjs';
import './layout-boot.css';

type BootCase = (typeof cases)[number];

/** 每个环节一种颜色：回执灰、initialLayoutOf 蓝、容器挂载琥珀、磁盘绿 */
const STAGE_ROLE: Record<string, Role> = { reply: 'slate', initial: 'blue', boot: 'amber', disk: 'emerald' };

function valueOf(item: BootCase, stageId: string): string {
  if (stageId === 'reply') return item.reply;
  if (stageId === 'initial') return item.initial;
  if (stageId === 'boot') return item.boot;
  if (stageId === 'disk') return item.disk;
  throw new Error(`布局开机图没有环节「${stageId}」`);
}

function Picture({ item }: { item: BootCase }): JSX.Element {
  return (
    <>
      <div className="lb-flow">
        {stages.map((stage, i) => (
          <div key={stage.id} className="lb-stage">
            {i === 0 ? null : (
              <span className="lb-arrow" aria-hidden="true">
                →
              </span>
            )}
            <Pane title={stage.title} role={STAGE_ROLE[stage.id]}>
              <code className="lb-value" data-empty={valueOf(item, stage.id) === '—'}>
                {valueOf(item, stage.id)}
              </code>
            </Pane>
          </div>
        ))}
      </div>
      <div className="lb-bar">
        <span className="lb-bar-label">状态栏</span>
        <Pill tone={item.tone} dot>
          {item.bar}
        </Pill>
      </div>
    </>
  );
}

export function LayoutBootCases(): JSX.Element {
  return (
    <div className="layout-boot not-prose">
      <CasePicker cases={cases} label="桌面挂载时从哪份布局开始">
        {(item) => <Picture item={item} />}
      </CasePicker>
    </div>
  );
}

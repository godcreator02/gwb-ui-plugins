/**
 * 基础界面插件内部接缝图（baseui.data.mjs）的坐标与图标。外壳在最上面一整行；左列是浏览器侧（入口、两个窗格、共享组件），
 * 中列是插件管理窗格按名字调的两个基础插件与日志窗格调的 src/log-query/，右列是 node 侧入口。插件管理与日志各占一行，
 * 窗格、被调的一方、登记三者在同一行上；登记 logger.query 在右列最下面，线折回中列的 src/log-query/。
 */
import { Cog, Component, FileSearch, Package, PanelsTopLeft, Puzzle, ScrollText, Settings, Split } from 'lucide-react';
import { cap } from '@godcreator/explainer/site';
import type { SeamLayout } from '@godcreator/explainer/site';

export const baseuiLayout: SeamLayout = {
  view: { w: 1200, h: 730 },
  caps: {
    'shell-pane': cap(54, 52, 220),
    'shell-cmds': cap(560, 52, 240),
    'shell-register': cap(954, 52, 212),

    dispatch: cap(54, 202, 492),
    'settings-plugin': cap(640, 202, 260),
    self: cap(954, 202, 212),

    'pm-mount': cap(54, 352, 120),
    'pm-ops': cap(184, 352, 362),
    pm: cap(600, 352, 300),
    'pm-reg': cap(954, 352, 212),

    'logger-mount': cap(54, 502, 120),
    'logger-data': cap(184, 502, 362),
    'log-query': cap(614, 502, 272),
    'logger-reg': cap(954, 502, 212),

    ui: cap(54, 652, 492),
    'query-reg': cap(954, 652, 212),
  },
  groups: {
    shell: { x: 20, y: 20, w: 1160, h: 94 },
    client: { x: 40, y: 170, w: 520, h: 94 },
    'pm-pane': { x: 40, y: 320, w: 520, h: 94 },
    'logger-pane': { x: 40, y: 470, w: 520, h: 94 },
    ui: { x: 40, y: 620, w: 520, h: 94 },
    'settings-plugin': null,
    pm: null,
    'log-query': { x: 600, y: 470, w: 300, h: 94 },
    index: { x: 940, y: 170, w: 240, h: 544 },
  },
  // 线只画到一端的：接缝 1 只从「报名字」画上去，接缝 9 只从日志窗格画下去；另一端在固定高亮时照样亮
  seamPaths: {
    '1': { d: 'M1060,100 V202', badge: [1060, 150] },
    '2': { d: 'M954,376 H900', badge: [927, 376] },
    '3': { d: 'M164,100 V202', badge: [164, 150] },
    '4': { d: 'M114,250 V352 M54,226 H28 V526 H54', badge: [114, 300] },
    '5': { d: 'M546,526 H614', badge: [580, 526] },
    '6': { d: 'M546,376 H600', badge: [573, 376] },
    '7': { d: 'M520,352 V302 H760 V250', badge: [700, 302] },
    '8': { d: 'M600,100 V282 H460 V352', badge: [600, 190] },
    '9': { d: 'M114,550 V652', badge: [114, 600] },
    '10': { d: 'M954,676 H750 V550', badge: [850, 676] },
  },
  entries: {},
  moduleIcons: {
    shell: PanelsTopLeft,
    client: Split,
    'pm-pane': Puzzle,
    'logger-pane': ScrollText,
    ui: Component,
    'settings-plugin': Settings,
    pm: Package,
    'log-query': FileSearch,
    index: Cog,
  },
  entryIcons: {},
};

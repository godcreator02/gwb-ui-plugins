/**
 * 全局接缝图（system.data.mjs）的坐标与图标。按依赖方向从上往下三行：用外壳的插件（外观、别的带界面的插件、基础界面），
 * 外壳，内核；基础插件在右边一列，接缝从右侧横着接进去。
 * 竖线落在外壳框、内核框的标题下方时停在框边上（1、2、10、14），接的是哪一处能力看高亮。
 */
import { Boxes, Cpu, LayoutGrid, Palette, PanelsTopLeft, Puzzle, User } from 'lucide-react';
import { cap } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';

export const systemLayout: SeamLayout = {
  view: { w: 1260, h: 494 },
  caps: {
    'theme-core': cap(130, 96, 127),
    'theme-pane': cap(265, 96, 127),
    'o-node': cap(428, 96, 128),
    'o-client': cap(564, 96, 128),
    'baseui-apply': cap(727, 96, 128),
    'baseui-panes': cap(863, 96, 128),

    page: cap(130, 246, 116),
    service: cap(254, 246, 116),
    pane: cap(378, 246, 116),
    tokens: cap(502, 246, 116),
    react: cap(626, 246, 116),
    commands: cap(750, 246, 116),
    skill: cap(874, 246, 116),

    'k-root': cap(130, 416, 116),
    'k-types': cap(254, 416, 116),
    'k-imports': cap(626, 416, 116),
    'k-channel': cap(750, 416, 116),

    'b-settings': cap(1054, 72, 176),
    'b-logger': cap(1054, 128, 176),
    'b-pm': cap(1054, 184, 176),
    'b-skills': cap(1054, 246, 176),
    'b-data': cap(1054, 322, 176),
    'b-commands': cap(1054, 384, 176),
  },
  groups: {
    theme: { x: 120, y: 64, w: 282, h: 94 },
    others: { x: 418, y: 64, w: 283, h: 94 },
    baseui: { x: 717, y: 64, w: 283, h: 94 },
    shell: { x: 120, y: 214, w: 880, h: 94 },
    kernel: { x: 120, y: 384, w: 756, h: 94 },
    base: { x: 1040, y: 40, w: 204, h: 404 },
  },
  seamPaths: {
    '1': { d: 'M312,294 V384', badge: [312, 346] },
    '2': { d: 'M188,294 V384', badge: [188, 346] },
    '3': { d: 'M684,294 V416', badge: [684, 346] },
    '4': { d: 'M780,294 V416', badge: [780, 346] },
    '5': { d: 'M830,294 V366 H1020 V408 H1054', badge: [1020, 387] },
    '6': { d: 'M856,294 V346 H1054', badge: [950, 346] },
    '7': { d: 'M193,64 V30 H1220 V72', badge: [700, 30] },
    '8': { d: 'M990,270 H1054', badge: [1020, 270] },
    '9': { d: 'M1000,140 H1054', badge: [1020, 140] },
    '10': { d: 'M312,158 V214', badge: [312, 186] },
    '11': { d: 'M436,158 V246', badge: [436, 186] },
    '12': { d: 'M684,158 V246', badge: [684, 186] },
    '13': { d: 'M560,158 V246', badge: [560, 186] },
    '14': { d: 'M188,158 V214', badge: [188, 186] },
    '15': { d: 'M808,158 V246', badge: [808, 186] },
  },
  entries: {
    human: { box: { x: 12, y: 246, w: 96, h: 48 }, arrow: [108, 270, 130, 270] },
  },
  moduleIcons: {
    theme: Palette,
    others: Puzzle,
    baseui: LayoutGrid,
    shell: PanelsTopLeft,
    kernel: Cpu,
    base: Boxes,
  },
  entryIcons: { human: User },
};

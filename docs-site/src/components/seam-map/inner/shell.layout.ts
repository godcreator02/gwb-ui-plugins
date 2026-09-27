/**
 * 外壳内部接缝图（shell.data.mjs）的坐标与图标。左边从上往下：插件的 node 侧、外壳服务、注册表与 React 运行时、
 * 两侧共用的纯模块与开窗格的判断、页面入口与执行、窗格挂载与样式表、插件的浏览器侧；右边一列是外观插件与内核。
 * 跨很多行的线走两列之间的空隙（x≈864–874）、最左的空隙（x=10）与最右的空隙（x=1232），不压在方块上。
 */
import { AppWindow, Atom, Blocks, Bot, Cpu, MousePointerClick, Paintbrush, Palette, PanelTop, Puzzle, Route, Server, Share2, Table } from 'lucide-react';
import { cap } from '../seam-diagram';
import type { SeamLayout } from '../seam-diagram';

export const shellLayout: SeamLayout = {
  view: { w: 1240, h: 1164 },
  caps: {
    apply: cap(34, 102, 212),
    bus: cap(294, 102, 180),
    data: cap(484, 102, 180),
    'skills-svc': cap(674, 102, 172),
    'theme-startup': cap(894, 102, 156),
    'theme-pane': cap(1060, 102, 146),

    api: cap(34, 252, 212),
    commands: cap(256, 252, 250),
    takeover: cap(516, 252, 178),
    skills: cap(704, 252, 142),
    'kernel-svc': cap(894, 252, 312),

    'pane-table': cap(34, 402, 140),
    'plugin-table': cap(184, 402, 150),
    icon: cap(344, 402, 86),
    'react-imports': cap(474, 402, 180),
    'react-runtime': cap(664, 402, 182),

    'plan-open': cap(34, 552, 130),
    'plan-send': cap(174, 552, 126),
    params: cap(310, 552, 90),
    names: cap(448, 552, 120),
    'layout-doc': cap(578, 552, 130),
    actions: cap(718, 552, 128),

    'mount-shell': cap(34, 722, 170),
    statusbar: cap(214, 722, 150),
    app: cap(374, 722, 172),
    'open-reg': cap(594, 722, 160),
    wellhub: cap(764, 722, 82),
    'kernel-page': cap(894, 722, 312),

    'plugin-pane': cap(34, 932, 170),
    bridge: cap(214, 932, 170),
    'pane-types': cap(394, 932, 152),
    reference: cap(594, 932, 190),
    'theme-css': cap(794, 932, 180),
    'shell-css': cap(984, 932, 222),

    'plugin-client': cap(34, 1082, 250),
    'plugin-style': cap(294, 1082, 252),
  },
  groups: {
    'plugin-node': { x: 20, y: 70, w: 240, h: 94 },
    services: { x: 280, y: 70, w: 580, h: 94 },
    theme: { x: 880, y: 70, w: 340, h: 94 },
    index: { x: 20, y: 220, w: 840, h: 94 },
    kernel: { x: 880, y: 220, w: 340, h: 564 },
    tables: { x: 20, y: 370, w: 420, h: 94 },
    react: { x: 460, y: 370, w: 400, h: 94 },
    plan: { x: 20, y: 520, w: 394, h: 94 },
    shared: { x: 434, y: 520, w: 426, h: 94 },
    boot: { x: 20, y: 690, w: 540, h: 94 },
    open: { x: 580, y: 690, w: 280, h: 94 },
    pane: { x: 20, y: 900, w: 540, h: 94 },
    styles: { x: 580, y: 900, w: 640, h: 94 },
    'plugin-client': { x: 20, y: 1050, w: 540, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M140,150 V252', badge: [140, 201] },
    '2': { d: 'M104,300 V402 M215,300 V402', badge: [104, 351] },
    '3': { d: 'M384,150 V252', badge: [384, 201] },
    '4': { d: 'M495,150 V252', badge: [495, 201] },
    '5': { d: 'M775,150 V252', badge: [775, 201] },
    '6': { d: 'M605,300 V330 H864 V266 H894', badge: [790, 330] },
    '7': { d: 'M300,300 V346 H874 V286 H894', badge: [700, 346] },
    '8': { d: 'M1050,770 V820 H119 V770 M460,820 V770 M160,820 V932', badge: [980, 820] },
    '9': { d: 'M972,150 V190 H460 V252 M1133,150 V182 H1232 V858 H60 V770', badge: [700, 190] },
    '10': { d: 'M585,300 V402 M846,426 H870 V634 H530 V722 M530,634 H10 V1106 H34', badge: [585, 351] },
    '11': { d: 'M450,300 V552 M500,600 V722', badge: [450, 494] },
    '12': { d: 'M674,722 V668 H99 V600 M237,668 V600 M355,668 V600', badge: [620, 668] },
    '13': { d: 'M546,746 H594', badge: [570, 746] },
    '14': { d: 'M330,932 V876 H720 V770', badge: [600, 876] },
    '15': { d: 'M119,980 V1082 M470,980 V1022 H250 V1082', badge: [119, 1031] },
    '16': { d: 'M80,770 V840 H884 V932 M1095,840 V932', badge: [700, 840] },
    '17': { d: 'M546,1106 H689 V980', badge: [620, 1106] },
  },
  entries: {
    callers: { box: { x: 294, y: 14, w: 180, h: 30 }, arrow: [384, 44, 384, 102] },
  },
  moduleIcons: {
    'plugin-node': Puzzle,
    services: Blocks,
    theme: Palette,
    index: Server,
    kernel: Cpu,
    tables: Table,
    react: Atom,
    plan: Route,
    shared: Share2,
    boot: AppWindow,
    open: MousePointerClick,
    pane: PanelTop,
    styles: Paintbrush,
    'plugin-client': Puzzle,
  },
  entryIcons: { callers: Bot },
};

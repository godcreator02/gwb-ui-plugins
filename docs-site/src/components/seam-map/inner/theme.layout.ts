/**
 * 外观插件内部接缝图（theme.data.mjs）的坐标与图标。外壳在最上面一整行；中间一行左边是 node 侧入口、右边是外观窗格；
 * 最下一行是设置插件、命令总线、启动样式的拼法与键名换算，各自在连着它的方块下面。
 */
import { ArrowLeftRight, Blocks, Cog, Palette, PanelsTopLeft, Radio, Settings } from 'lucide-react';
import { cap } from '@godcreator/explainer-player';
import type { SeamLayout } from '@godcreator/explainer-player';

export const themeLayout: SeamLayout = {
  view: { w: 1200, h: 430 },
  caps: {
    'shell-register': cap(180, 52, 200),
    'shell-env': cap(470, 52, 210),
    'shell-pane': cap(700, 52, 170),
    'shell-apply': cap(990, 52, 176),

    settings: cap(34, 202, 146),
    'register-pane': cap(190, 202, 150),
    valuesave: cap(350, 202, 176),
    startup: cap(536, 202, 130),

    mount: cap(714, 202, 120),
    appearance: cap(844, 202, 130),
    'apply-page': cap(984, 202, 182),

    'settings-svc': cap(34, 352, 220),
    commands: cap(290, 352, 270),
    build: cap(594, 352, 272),
    convert: cap(914, 352, 252),
  },
  groups: {
    shell: { x: 20, y: 20, w: 1160, h: 94 },
    index: { x: 20, y: 170, w: 660, h: 94 },
    client: { x: 700, y: 170, w: 480, h: 94 },
    'settings-svc': null,
    commands: null,
    'startup-css': { x: 580, y: 320, w: 300, h: 94 },
    values: { x: 900, y: 320, w: 280, h: 94 },
  },
  seamPaths: {
    '1': { d: 'M107,250 V352', badge: [107, 300] },
    '2': { d: 'M400,250 V352 M550,250 V352', badge: [400, 300] },
    '3': { d: 'M601,100 V202', badge: [601, 162] },
    // 两条支线在拼法上方汇成一条：node 侧的命令与浏览器侧的窗格用的是同一个函数
    '4': { d: 'M630,250 V296 H900 V250 M730,296 V352', badge: [730, 324] },
    '5': { d: 'M265,100 V202', badge: [265, 162] },
    '6': { d: 'M774,100 V202', badge: [774, 162] },
    '7': { d: 'M480,202 V132 H880 V202', badge: [690, 132] },
    '8': { d: 'M950,250 V352', badge: [950, 300] },
    '9': { d: 'M1075,100 V202', badge: [1075, 162] },
  },
  entries: {},
  moduleIcons: {
    shell: PanelsTopLeft,
    index: Cog,
    client: Palette,
    'settings-svc': Settings,
    commands: Radio,
    'startup-css': Blocks,
    values: ArrowLeftRight,
  },
  entryIcons: {},
};

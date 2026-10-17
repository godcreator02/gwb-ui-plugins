/**
 * 「切桌面发生什么」的讲解数据：画面（desktop-switch.tsx）与机读版规则（desktop-switch.ai.mjs）都只读这一份。
 * 例子：从桌面 1（d1，开着日志与阅读·a）切到从没去过的桌面 2（d2，布局文件里存着一个查询窗格）。
 * 顺序照抄 client/index.tsx 的 switchTo 与 sweepBodyPortals；每一步给出两张桌面此刻的状态、布局文件里的 active、这一步在页面控制台与插件那头留下的记录。
 */
/** 两张桌面上开着的窗格 */
export const desks: {
    id: string;
    name: string;
    panes: string[];
}[];
/**
 * 每一步结束时两张桌面的状态：shown 是显示着（否则 visibility:hidden、pointer-events:none、inert），mounted 是容器已挂载
 * @typedef {{ shown: boolean, mounted: boolean }} DeskState
 * @typedef {{ title: string, text: string, active: string, wrote: boolean, d1: DeskState, d2: DeskState, focus: string | null, log: { text: string, kind: 'cmd' | 'out' | 'ok' | 'err' }[] }} SwitchStep
 * @type {SwitchStep[]}
 */
export const steps: SwitchStep[];
/**
 * 每一步结束时两张桌面的状态：shown 是显示着（否则 visibility:hidden、pointer-events:none、inert），mounted 是容器已挂载
 */
export type DeskState = {
    shown: boolean;
    mounted: boolean;
};
/**
 * 每一步结束时两张桌面的状态：shown 是显示着（否则 visibility:hidden、pointer-events:none、inert），mounted 是容器已挂载
 */
export type SwitchStep = {
    title: string;
    text: string;
    active: string;
    wrote: boolean;
    d1: DeskState;
    d2: DeskState;
    focus: string | null;
    log: {
        text: string;
        kind: "cmd" | "out" | "ok" | "err";
    }[];
};

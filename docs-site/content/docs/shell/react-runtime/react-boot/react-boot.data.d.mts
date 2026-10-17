/**
 * 「从主进程登记到窗格挂载完成」的全部讲解数据：画面（react-boot.tsx）与机读规则（react-boot.ai.mjs）都只读这一份。
 * 跨三处运行：主进程（外壳的 node 侧与内核）、preload（内核给页面的 window.gwb）、页面（内核的 index.html、外壳与插件的浏览器侧代码）。
 * 每一步列出这一刻四样东西的状态：内核的登记表、页面上已注入的 importmap、<head> 里的样式、#root 里是什么。
 * 地址只写包目录之后的部分，实际是 file:// 开头的完整地址。
 */
/** 三处运行的地方；颜色整页固定 */
export const lanes: {
    id: string;
    label: string;
    detail: string;
    role: string;
}[];
/**
 * 每一步：lane 是这一步在哪运行；code 是这一步照抄的源码（没有就不画）；
 * registry / importmap 是 [名字, 地址] 列表，styles 是 <head> 里按顺序的样式，root 是 #root 里此刻是什么；
 * changed 标出这一步变了的那一样；fault 表示这一步以报错结束。
 * @typedef {{ file: string, lines: string[], highlight?: [number, number] }} StepCode
 * @typedef {'registry' | 'importmap' | 'styles' | 'root'} StateName
 * @typedef {{ id: string, title: string, text: string, lane: 'main' | 'preload' | 'page', code?: StepCode, registry: string[][], importmap: string[][], styles: string[], root: string, changed: StateName[], fault?: boolean }} BootStep
 * @type {BootStep[]}
 */
export const steps: BootStep[];
/**
 * 每一步：lane 是这一步在哪运行；code 是这一步照抄的源码（没有就不画）；
 * registry / importmap 是 [名字, 地址] 列表，styles 是 <head> 里按顺序的样式，root 是 #root 里此刻是什么；
 * changed 标出这一步变了的那一样；fault 表示这一步以报错结束。
 */
export type StepCode = {
    file: string;
    lines: string[];
    highlight?: [number, number];
};
/**
 * 每一步：lane 是这一步在哪运行；code 是这一步照抄的源码（没有就不画）；
 * registry / importmap 是 [名字, 地址] 列表，styles 是 <head> 里按顺序的样式，root 是 #root 里此刻是什么；
 * changed 标出这一步变了的那一样；fault 表示这一步以报错结束。
 */
export type StateName = "registry" | "importmap" | "styles" | "root";
/**
 * 每一步：lane 是这一步在哪运行；code 是这一步照抄的源码（没有就不画）；
 * registry / importmap 是 [名字, 地址] 列表，styles 是 <head> 里按顺序的样式，root 是 #root 里此刻是什么；
 * changed 标出这一步变了的那一样；fault 表示这一步以报错结束。
 */
export type BootStep = {
    id: string;
    title: string;
    text: string;
    lane: "main" | "preload" | "page";
    code?: StepCode;
    registry: string[][];
    importmap: string[][];
    styles: string[];
    root: string;
    changed: StateName[];
    fault?: boolean;
};

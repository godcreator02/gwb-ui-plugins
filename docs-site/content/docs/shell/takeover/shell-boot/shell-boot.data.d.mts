/**
 * 「外壳怎么接管内核的页面」的讲解数据：画面（shell-boot.tsx）与机读版规则（shell-boot.ai.mjs）都只读这一份。
 * 每一步是一个固定状态：亮哪几个参与者、画哪几条箭头、#root 此刻显示什么、对应哪段源码。
 * 源码片段照抄 plugins/shell/src/，正上方的记号把它钉在源码上。
 */
/**
 * 参与者：外壳 node 侧是蓝色，外壳浏览器侧是琥珀色，包外的内核与命令总线是灰色
 * @type {{ id: string, name: string, sub: string, role: import('@godcreator/explainer/site').Role }[]}
 */
export const actors: {
    id: string;
    name: string;
    sub: string;
    role: import("@godcreator/explainer/site").Role;
}[];
/**
 * @typedef {{ file: string, start: number, lines: string[], highlight?: [number, number] }} Code
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} BootStep
 * @type {BootStep[]}
 */
export const steps: BootStep[];
export type Code = {
    file: string;
    start: number;
    lines: string[];
    highlight?: [number, number];
};
export type BootStep = {
    title: string;
    text: string;
    lit: string[];
    shown: string[];
    marks: Record<string, string>;
    code: Code;
};

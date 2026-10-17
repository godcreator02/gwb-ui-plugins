/**
 * 「一个窗格从注册到挂载到关闭」的讲解数据：画面（pane-mount.tsx）与机读版规则（pane-mount.ai.mjs）都只读这一份。
 * 每一步亮哪几个参与者、画哪几条箭头、对应哪段源码。源码片段照抄 plugins/shell/src/，正上方的记号把它钉在源码上。
 */
/**
 * 参与者：外壳 node 侧蓝色，外壳浏览器侧琥珀色，窗格插件绿色，样式表青色
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
 * @typedef {{ title: string, text: string, lit: string[], shown: string[], marks: Record<string, string>, code: Code }} MountStep
 * @type {MountStep[]}
 */
export const steps: MountStep[];
export type Code = {
    file: string;
    start: number;
    lines: string[];
    highlight?: [number, number];
};
export type MountStep = {
    title: string;
    text: string;
    lit: string[];
    shown: string[];
    marks: Record<string, string>;
    code: Code;
};

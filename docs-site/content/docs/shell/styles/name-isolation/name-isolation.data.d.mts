/**
 * 「按位置隔离与按名字隔离」的全部讲解数据：画面（name-isolation.tsx）与机读规则（name-isolation.ai.mjs）都只读这一份。
 * DOM 树按外壳此刻渲染的结构简化：#root 是外壳的根，每张桌面一个 section，窗格容器在 dockview 的几层里面，
 * 这张桌面的浮层挂载点 .gwb-portal-host 是容器的兄弟节点，状态栏在桌面外面。
 * 按位置隔离是没有采用的做法：它的类名不带前缀，规则写成「某个 data-gwb-plugin 底下的 .x」。
 */
/**
 * DOM 树上的节点。bare 是按位置隔离时的写法（类名不带前缀），prefixed 是按名字隔离时的写法；
 * owner 是画出它的插件，决定它的颜色（整页固定：外壳蓝、baseui 绿）。
 * @typedef {{ id: string, depth: number, bare: string, prefixed: string, note: string, owner: 'shell' | 'baseui' | 'none' }} DomNode
 * @type {DomNode[]}
 */
export const nodes: DomNode[];
/**
 * 每种情况：一条规则的选择器、写法（bare / prefixed）、它实际命中哪些节点，以及其中哪些是错的。
 * missed 是该命中却没命中的，leaked 是不该命中却命中的。
 * @typedef {{ id: string, label: string, text: string, mode: 'bare' | 'prefixed', selector: string, owner: 'shell' | 'baseui', matched: string[], missed: string[], leaked: string[] }} IsolationCase
 * @type {IsolationCase[]}
 */
export const cases: IsolationCase[];
/**
 * DOM 树上的节点。bare 是按位置隔离时的写法（类名不带前缀），prefixed 是按名字隔离时的写法；
 * owner 是画出它的插件，决定它的颜色（整页固定：外壳蓝、baseui 绿）。
 */
export type DomNode = {
    id: string;
    depth: number;
    bare: string;
    prefixed: string;
    note: string;
    owner: "shell" | "baseui" | "none";
};
/**
 * 每种情况：一条规则的选择器、写法（bare / prefixed）、它实际命中哪些节点，以及其中哪些是错的。
 * missed 是该命中却没命中的，leaked 是不该命中却命中的。
 */
export type IsolationCase = {
    id: string;
    label: string;
    text: string;
    mode: "bare" | "prefixed";
    selector: string;
    owner: "shell" | "baseui";
    matched: string[];
    missed: string[];
    leaked: string[];
};

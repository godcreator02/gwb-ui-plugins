/**
 * 「一个颜色令牌在构建时与运行时各经过哪几处」的全部讲解数据：画面（token-flow.tsx）与机读规则（token-flow.ai.mjs）都只读这一份。
 * 例子是 baseui 元素上的 baseui:bg-primary：构建时只查映射、不带值，运行时从页面上那份令牌读值；最后一步是反例——把变量值文件也引进插件构建。
 * 文件的颜色整页固定：外壳的令牌文件琥珀、baseui 的文件蓝、页面紫。
 */
/**
 * 每一步画几个文件卡片：file 是卡片标题，role 是颜色，lines 是卡片里的代码行，highlight 是高亮的行（1 起）。
 * swatch 是这一步元素最终读到的颜色：dark 表示 <html> 上有没有 dark 类，value 是 --primary 解析出的值。
 * @typedef {{ file: string, role: 'amber' | 'blue' | 'violet' | 'rose', note?: string, lines: string[], highlight?: [number, number] }} FileCard
 * @typedef {{ id: string, title: string, text: string, when: '构建时' | '运行时', cards: FileCard[], swatch?: { dark: boolean, value: string } }} TokenStep
 * @type {TokenStep[]}
 */
export const steps: TokenStep[];
/**
 * 每一步画几个文件卡片：file 是卡片标题，role 是颜色，lines 是卡片里的代码行，highlight 是高亮的行（1 起）。
 * swatch 是这一步元素最终读到的颜色：dark 表示 <html> 上有没有 dark 类，value 是 --primary 解析出的值。
 */
export type FileCard = {
    file: string;
    role: "amber" | "blue" | "violet" | "rose";
    note?: string;
    lines: string[];
    highlight?: [number, number];
};
/**
 * 每一步画几个文件卡片：file 是卡片标题，role 是颜色，lines 是卡片里的代码行，highlight 是高亮的行（1 起）。
 * swatch 是这一步元素最终读到的颜色：dark 表示 <html> 上有没有 dark 类，value 是 --primary 解析出的值。
 */
export type TokenStep = {
    id: string;
    title: string;
    text: string;
    when: "\u6784\u5EFA\u65F6" | "\u8FD0\u884C\u65F6";
    cards: FileCard[];
    swatch?: {
        dark: boolean;
        value: string;
    };
};

export namespace sheets {
    namespace baseui {
        let file: string;
        let role: string;
    }
    namespace theme {
        let file_1: string;
        export { file_1 as file };
        let role_1: string;
        export { role_1 as role };
    }
}
/**
 * 每一步：
 * - classAttr：baseui 那个元素的 class
 * - compiled：还没进页面时两张表各有哪些规则（只有第一步有）
 * - layer：页面上 @layer utilities 里的规则，按加载先后；matches 是它命中不命中 baseui 的元素
 * - winner：决定这个元素左右内边距的那一条（layer 里的 key）
 * - paddingInline：这个元素最终的左右内边距（rem）；ok 是它跟写的一样不一样
 * @typedef {{ key: string, sheet: 'baseui' | 'theme', selector: string, decl: string, matches: boolean }} LayerRule
 * @typedef {{ id: string, title: string, text: string, classAttr: string, compiled?: Record<'baseui' | 'theme', { selector: string, decl: string }[]>, layer: LayerRule[], winner?: string, paddingInline?: number, ok?: boolean }} SheetStep
 * @type {SheetStep[]}
 */
export const steps: SheetStep[];
/**
 * 每一步：
 * - classAttr：baseui 那个元素的 class
 * - compiled：还没进页面时两张表各有哪些规则（只有第一步有）
 * - layer：页面上
 */
export type LayerRule = {
    key: string;
    sheet: "baseui" | "theme";
    selector: string;
    decl: string;
    matches: boolean;
};
/**
 * 每一步：
 * - classAttr：baseui 那个元素的 class
 * - compiled：还没进页面时两张表各有哪些规则（只有第一步有）
 * - layer：页面上
 */
export type SheetStep = {
    id: string;
    title: string;
    text: string;
    classAttr: string;
    compiled?: Record<"baseui" | "theme", {
        selector: string;
        decl: string;
    }[]>;
    layer: LayerRule[];
    winner?: string;
    paddingInline?: number;
    ok?: boolean;
};

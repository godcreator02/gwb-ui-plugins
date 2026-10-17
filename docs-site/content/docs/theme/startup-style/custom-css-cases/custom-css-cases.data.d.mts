/**
 * 「自定义 CSS 跟谁比」的讲解数据：画面（custom-css-cases.tsx）与机读规则（custom-css-cases.ai.mjs）都只读这一份。
 * 同一个元素上两条规则设置同一个属性时，浏览器依次比三样：在不在 @layer 里、选择器特异性、文档顺序，前一样分出胜负就不再往下比。
 * 用户的自定义 CSS 在 #gwb-theme-style 里：不分层，排在外壳三张表之后。每种情况各拿一条设置同一个属性的另一条规则跟它比。
 */
/** 三样依次比，前一样分出胜负就不再往下比（!important 与样式来源这里都用不到，不列） */
export const criteria: string[];
/**
 * outcome：mine 是自定义 CSS 这一样赢，rival 是另一条规则赢，tie 是这一样相同、接着比下一样，skip 是前面已分出胜负、不用比。
 * @typedef {'mine' | 'rival' | 'tie' | 'skip'} Outcome
 * @typedef {{ rival: string, mine: string, outcome: Outcome }} Comparison
 * @typedef {{ id: string, label: string, text: string, rivalSource: string, rivalLines: string[], mineLines: string[],
 *   comparisons: Comparison[], winner: 'mine' | 'rival' }} CssCase
 * @type {CssCase[]}
 */
export const cases: CssCase[];
/**
 * outcome：mine 是自定义 CSS 这一样赢，rival 是另一条规则赢，tie 是这一样相同、接着比下一样，skip 是前面已分出胜负、不用比。
 */
export type Outcome = "mine" | "rival" | "tie" | "skip";
/**
 * outcome：mine 是自定义 CSS 这一样赢，rival 是另一条规则赢，tie 是这一样相同、接着比下一样，skip 是前面已分出胜负、不用比。
 */
export type Comparison = {
    rival: string;
    mine: string;
    outcome: Outcome;
};
/**
 * outcome：mine 是自定义 CSS 这一样赢，rival 是另一条规则赢，tie 是这一样相同、接着比下一样，skip 是前面已分出胜负、不用比。
 */
export type CssCase = {
    id: string;
    label: string;
    text: string;
    rivalSource: string;
    rivalLines: string[];
    mineLines: string[];
    comparisons: Comparison[];
    winner: "mine" | "rival";
};

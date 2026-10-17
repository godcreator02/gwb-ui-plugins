/**
 * 「开一个窗格落在哪、做什么」的讲解数据：画面（open-pane-cases.tsx）与机读版规则（open-pane-cases.ai.mjs）都只读这一份。
 * 规则照抄 openable.ts 的 targetGroup 与 planOpen；每种情况给出打开之前与之后的桌面、目标组走到了哪一条、查重走到了哪一条、planOpen 回的判断。
 * 例子里的四个窗格：单元树、查询、日志是工具窗格，阅读是文档窗格（key 是它装的那一块）。
 */
/**
 * 目标组规则，placement 缺省（auto）时按顺序取第一个成立的
 * @type {{ id: string, when: string, then: string }[]}
 */
export const autoRules: {
    id: string;
    when: string;
    then: string;
}[];
export namespace sideRule {
    let id: string;
    let when: string;
    let then: string;
}
/**
 * 查重与结论，按 planOpen 的顺序；kinds 是这一条对哪类窗格适用
 * @type {{ id: string, kinds: ('tool' | 'document')[], text: string }[]}
 */
export const checks: {
    id: string;
    kinds: ("tool" | "document")[];
    text: string;
}[];
export namespace panes {
    namespace tree {
        let label: string;
        let kind: string;
    }
    namespace query {
        let label_1: string;
        export { label_1 as label };
        let kind_1: string;
        export { kind_1 as kind };
    }
    namespace logger {
        let label_2: string;
        export { label_2 as label };
        let kind_2: string;
        export { kind_2 as kind };
    }
    namespace reader {
        let label_3: string;
        export { label_3 as label };
        let kind_3: string;
        export { kind_3 as kind };
    }
}
/**
 * 标签：pane 是哪个窗格，key 是装的内容；result 是这次打开之后它身上发生了什么
 * @typedef {{ pane: 'tree' | 'query' | 'logger' | 'reader', key?: string, active?: true, preview?: true, source?: true, result?: 'new' | 'focus' | 'retarget' | 'kept' }} Tab
 * @typedef {{ id: string, x: number, w: number, tabs: Tab[], target?: true, born?: true }} Group
 * @typedef {{ groups: Group[], other?: { name: string, tabs: Tab[] }, notice?: string }} Desk
 * @typedef {{ id: string, label: string, text: string, call: string, pane: 'tool' | 'document', rule: string, check: string, plan: string, before: Desk, after: Desk }} OpenCase
 * @type {OpenCase[]}
 */
export const cases: OpenCase[];
/**
 * 标签：pane 是哪个窗格，key 是装的内容；result 是这次打开之后它身上发生了什么
 */
export type Tab = {
    pane: "tree" | "query" | "logger" | "reader";
    key?: string;
    active?: true;
    preview?: true;
    source?: true;
    result?: "new" | "focus" | "retarget" | "kept";
};
/**
 * 标签：pane 是哪个窗格，key 是装的内容；result 是这次打开之后它身上发生了什么
 */
export type Group = {
    id: string;
    x: number;
    w: number;
    tabs: Tab[];
    target?: true;
    born?: true;
};
/**
 * 标签：pane 是哪个窗格，key 是装的内容；result 是这次打开之后它身上发生了什么
 */
export type Desk = {
    groups: Group[];
    other?: {
        name: string;
        tabs: Tab[];
    };
    notice?: string;
};
/**
 * 标签：pane 是哪个窗格，key 是装的内容；result 是这次打开之后它身上发生了什么
 */
export type OpenCase = {
    id: string;
    label: string;
    text: string;
    call: string;
    pane: "tool" | "document";
    rule: string;
    check: string;
    plan: string;
    before: Desk;
    after: Desk;
};

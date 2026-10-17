/**
 * 「升级之后要不要整页刷新」的讲解数据：画面（update-reload.tsx）与机读规则（update-reload.ai.mjs）都只读这一份。
 * 插件管理窗格点「更新」或「全部更新」后走四步：plugin-manager.update 的回执 → describeUpdateReceipt 写成几行话并定下要不要刷新
 * → 插件管理自己也升了就等它的条目重新加载起来 → shell.reload 整页重新加载。每种回执各走到哪一步为止。
 * 每种情况的回执与窗格上显示的文字取自 baseui 的测试 tests/panes/update-receipt.test.ts 与 update-receipt.ts 的拼法。
 */
/** 四步，按先后 */
export const stations: {
    id: string;
    name: string;
    ident: string;
}[];
/**
 * 每一步在这种情况下：pass 走过、stop 停在这里、skip 没走到或不用走。
 * @typedef {'pass' | 'stop' | 'skip'} StationState
 * @typedef {{ id: string, label: string, text: string, receipt: string[], shown: string[], failureLines: number[],
 *   states: Record<string, StationState>, notes: Record<string, string>, reloads: boolean }} UpdateCase
 * @type {UpdateCase[]}
 */
export const cases: UpdateCase[];
/**
 * 每一步在这种情况下：pass 走过、stop 停在这里、skip 没走到或不用走。
 */
export type StationState = "pass" | "stop" | "skip";
/**
 * 每一步在这种情况下：pass 走过、stop 停在这里、skip 没走到或不用走。
 */
export type UpdateCase = {
    id: string;
    label: string;
    text: string;
    receipt: string[];
    shown: string[];
    failureLines: number[];
    states: Record<string, StationState>;
    notes: Record<string, string>;
    reloads: boolean;
};

/**
 * 「一张桌面挂载时从哪份布局开始、要不要写入磁盘」的讲解数据：画面（layout-boot.tsx）与机读版规则（layout-boot.ai.mjs）都只读这一份。
 * 每种情况经过同样四个环节：启动时读回的回执 → initialLayoutOf → 容器挂载时的 wellBootPlan → 磁盘上的布局文件，最后是状态栏上看得到什么。
 * 判断照抄 layout.ts 的 initialLayoutOf 与 wellBootPlan、client/index.tsx 的 onWellReady。
 */
/** 四个环节的标题 */
export const stages: {
    id: string;
    title: string;
}[];
/**
 * @typedef {{ id: string, label: string, text: string, reply: string, initial: string, boot: string, disk: string, bar: string, tone: 'good' | 'warn' | 'bad' }} BootCase
 * @type {BootCase[]}
 */
export const cases: BootCase[];
export type BootCase = {
    id: string;
    label: string;
    text: string;
    reply: string;
    initial: string;
    boot: string;
    disk: string;
    bar: string;
    tone: "good" | "warn" | "bad";
};

/**
 * 「外观设置怎么进页面」的全部讲解数据：画面（appearance-flow.tsx）与机读规则（appearance-flow.ai.mjs）都只读这一份。
 * 一个例子贯穿八步：home 里存着等宽字体与一段自定义 CSS，启动时经外壳注入页面；打开外观窗格改等宽字体、保存；
 * 再改正文字体、不保存就关掉窗格。每一步给出设置、这一步的调用、页面 <head> 里的样式元素与启动样式的内容。
 */
/** 设置的三个键，与外观插件 src/index.ts 里的键名一致 */
export const settingKeys: string[];
export namespace headElements {
    namespace tokens {
        let tag: string;
        let name: string;
        let note: string;
        let layered: boolean;
    }
    namespace dockview {
        let tag_1: string;
        export { tag_1 as tag };
        let name_1: string;
        export { name_1 as name };
        let note_1: string;
        export { note_1 as note };
        let layered_1: boolean;
        export { layered_1 as layered };
    }
    namespace shell {
        let tag_2: string;
        export { tag_2 as tag };
        let name_2: string;
        export { name_2 as name };
        let note_2: string;
        export { note_2 as note };
        let layered_2: boolean;
        export { layered_2 as layered };
    }
    namespace startup {
        let tag_3: string;
        export { tag_3 as tag };
        let name_3: string;
        export { name_3 as name };
        let note_3: string;
        export { note_3 as note };
        let layered_3: boolean;
        export { layered_3 as layered };
    }
    namespace pane {
        let tag_4: string;
        export { tag_4 as tag };
        let name_4: string;
        export { name_4 as name };
        let note_4: string;
        export { note_4 as note };
        let layered_4: boolean;
        export { layered_4 as layered };
    }
}
/**
 * 八步。actor 是执行这一步的那一方：settings 设置、shell 外壳、page 页面、pane 外观窗格。
 * head 是这一步结束时 <head> 里的元素，mark 标出这一步新加（new）或内容变了（changed）的那个。
 * css 是 #gwb-theme-style 此刻的内容，null 表示页面上还没有它。
 * @typedef {'settings' | 'shell' | 'page' | 'pane'} Actor
 * @typedef {{ key: keyof typeof headElements, mark?: 'new' | 'changed' | 'loading' }} HeadItem
 * @typedef {{ fields: Record<string, string>, dirty: string[], button: 'disabled' | 'enabled', notice: string }} PaneState
 * @typedef {{ id: string, title: string, text: string, actor: Actor, calls: string[], settings: Record<string, string>,
 *   settingsChanged: string[], head: HeadItem[], css: string[] | null, cssChanged: number[], pane: PaneState | null }} FlowStep
 * @type {FlowStep[]}
 */
export const steps: FlowStep[];
/** 最后一步里关窗格之前那一刻的预览，画面上当作「被退回的内容」划掉显示 */
export const revertedPreview: string[];
/**
 * 八步。actor 是执行这一步的那一方：settings 设置、shell 外壳、page 页面、pane 外观窗格。
 * head 是这一步结束时 <head> 里的元素，mark 标出这一步新加（new）或内容变了（changed）的那个。
 * css 是 #gwb-theme-style 此刻的内容，null 表示页面上还没有它。
 */
export type Actor = "settings" | "shell" | "page" | "pane";
/**
 * 八步。actor 是执行这一步的那一方：settings 设置、shell 外壳、page 页面、pane 外观窗格。
 * head 是这一步结束时 <head> 里的元素，mark 标出这一步新加（new）或内容变了（changed）的那个。
 * css 是 #gwb-theme-style 此刻的内容，null 表示页面上还没有它。
 */
export type HeadItem = {
    key: keyof typeof headElements;
    mark?: "new" | "changed" | "loading";
};
/**
 * 八步。actor 是执行这一步的那一方：settings 设置、shell 外壳、page 页面、pane 外观窗格。
 * head 是这一步结束时 <head> 里的元素，mark 标出这一步新加（new）或内容变了（changed）的那个。
 * css 是 #gwb-theme-style 此刻的内容，null 表示页面上还没有它。
 */
export type PaneState = {
    fields: Record<string, string>;
    dirty: string[];
    button: "disabled" | "enabled";
    notice: string;
};
/**
 * 八步。actor 是执行这一步的那一方：settings 设置、shell 外壳、page 页面、pane 外观窗格。
 * head 是这一步结束时 <head> 里的元素，mark 标出这一步新加（new）或内容变了（changed）的那个。
 * css 是 #gwb-theme-style 此刻的内容，null 表示页面上还没有它。
 */
export type FlowStep = {
    id: string;
    title: string;
    text: string;
    actor: Actor;
    calls: string[];
    settings: Record<string, string>;
    settingsChanged: string[];
    head: HeadItem[];
    css: string[] | null;
    cssChanged: number[];
    pane: PaneState | null;
};

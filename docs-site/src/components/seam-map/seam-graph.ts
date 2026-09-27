/**
 * 接缝图的内容：模块是框，能力是框里的方块，接缝是跨框的带编号连线，入口是从图外进来的箭头。
 * 画面（seam-diagram.tsx）与机读文字（seamGraphText）只读 defineSeamGraph 交回的对象。
 * 站在 Node 里生成机读版时加载这个入口，数据文件又被画面 import，所以这里只许 import 类型。
 */
import type { Role } from "@godcreator/explainer-player";

export interface SeamCapability {
  id: string;
  name: string;
  /** 最关键的标识符：函数名、类型名、文件名 */
  ident: string;
}

export interface SeamModule {
  id: string;
  name: string;
  /** 框标题右边的包名或路径 */
  pkg: string;
  /** 框的颜色；框外的东西写 null，画成灰色 */
  role: Role | null;
  /** 系统之外的东西：实线细框 */
  outside: boolean;
  blurb: string;
  caps: SeamCapability[];
}

export interface SeamEntry {
  id: string;
  name: string;
  /** 箭头指向的能力或模块 id */
  to: string;
}

export interface SeamInput {
  n: number;
  name: string;
  /** 两端的能力 id */
  a: string[];
  b: string[];
  iface: string;
  /** 两端只靠约定、没有代码接口 */
  convention: boolean;
  via: "code" | "disk";
  text: string;
}

export interface Seam extends SeamInput {
  id: string;
  label: string;
}

export interface SeamGraphInput {
  id: string;
  title: string;
  intro: string;
  /** 图例里虚线框叫什么：模块、文件、目录 */
  frameLabel: string;
  modules: SeamModule[];
  entries: SeamEntry[];
  seams: SeamInput[];
}

export interface SeamGraph {
  id: string;
  title: string;
  intro: string;
  frameLabel: string;
  modules: SeamModule[];
  entries: SeamEntry[];
  seams: Seam[];
  moduleOfCap: Map<string, SeamModule>;
  capById: Map<string, SeamCapability>;
  /** 跟一个模块有关的接缝：任一端落在这个模块的能力上 */
  seamsOfModule: (moduleId: string) => Seam[];
}

/** 定义一张图：id 重复、接缝两端或入口指向不存在的能力，当场报错 */
export function defineSeamGraph({ id, title, intro, frameLabel, modules, entries, seams }: SeamGraphInput): SeamGraph {
  const moduleOfCap = new Map<string, SeamModule>();
  const capById = new Map<string, SeamCapability>();
  for (const m of modules) {
    for (const c of m.caps) {
      if (capById.has(c.id)) throw new Error(`接缝图「${id}」里能力 id「${c.id}」重复`);
      capById.set(c.id, c);
      moduleOfCap.set(c.id, m);
    }
  }
  const moduleIds = new Set(modules.map((m) => m.id));
  if (moduleIds.size !== modules.length) throw new Error(`接缝图「${id}」里模块 id 重复`);
  for (const e of entries) {
    if (!capById.has(e.to) && !moduleIds.has(e.to)) throw new Error(`接缝图「${id}」的入口「${e.id}」指向不存在的「${e.to}」`);
  }
  const numbered: Seam[] = seams.map((s) => {
    for (const cap of [...s.a, ...s.b]) {
      if (!capById.has(cap)) throw new Error(`接缝图「${id}」的接缝 ${s.n}「${s.name}」一端是不存在的能力「${cap}」`);
    }
    return { ...s, id: String(s.n), label: `${s.n} ${s.name}` };
  });
  if (new Set(numbered.map((s) => s.id)).size !== numbered.length) throw new Error(`接缝图「${id}」里接缝编号重复`);

  const seamsOfModule = (moduleId: string): Seam[] =>
    numbered.filter((s) => [...s.a, ...s.b].some((cap) => moduleOfCap.get(cap)?.id === moduleId));

  return { id, title, intro, frameLabel, modules, entries, seams: numbered, moduleOfCap, capById, seamsOfModule };
}

/** 一张图的机读文字，每段一个元素：图的说明与入口、每个模块一段、每条接缝一段 */
export function seamGraphText(graph: SeamGraph): string[] {
  const capNames = (ids: string[]): string => ids.map((id) => graph.capById.get(id)!.name).join("、");
  const entryTarget = (to: string): string => graph.capById.get(to)?.name ?? graph.modules.find((m) => m.id === to)!.name;
  const entries =
    graph.entries.length === 0 ? "" : `从外面进来的入口：${graph.entries.map((e) => `${e.name} → ${entryTarget(e.to)}`).join("；")}。`;
  return [
    `${graph.intro}${entries}`,
    ...graph.modules.map(
      (m) => `${m.outside ? "框外" : graph.frameLabel}「${m.name}」（${m.pkg}）：${m.blurb}能力：${m.caps.map((c) => `${c.name}（${c.ident}）`).join("、")}。`,
    ),
    ...graph.seams.map(
      (s) =>
        `接缝 ${s.label}：${s.text}两端：${capNames(s.a)} ↔ ${capNames(s.b)}。接口：${s.iface}。${s.convention ? "约定，没有代码接口" : "有代码接口"}，${s.via === "disk" ? "读写磁盘上的文件" : "代码调用"}。`,
    ),
  ];
}

// 只给外壳自己编译用：命令总线与数据插件各自发的 `declare module 'cordis'` 在 pnpm store 布局下会加到另一个 `Context` 上，
// 所以按真类型再声明一遍。不许被 import：放进 src/index.ts 就会随发布的 index.d.ts 发给下游，没注入数据插件的下游也会以为 ctx.gwbData 在。
// 靠 tsconfig 的 include 生效（tsconfig.json 的 src/*.ts、tsconfig.build.json 显式列出）
import type { GwbCommands } from '@godcreator/gwb-commands'
import type { GwbDataApi } from '@godcreator/gwb-data'

declare module 'cordis' {
  interface Context {
    gwbCommands?: GwbCommands
    gwbData: GwbDataApi
  }
}

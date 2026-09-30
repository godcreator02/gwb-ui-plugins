import { defineConfig } from 'vitest/config'

export default defineConfig({
  // 插件浏览器侧的 shadcn 组件写成 @/…，按各插件 src/client/tsconfig.json 的 paths 解析
  resolve: { tsconfigPaths: true },
  test: {
    include: ['plugins/*/tests/**/*.test.ts'],
  },
})

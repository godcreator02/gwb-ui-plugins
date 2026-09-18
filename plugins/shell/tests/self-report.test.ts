import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { registerSelfReportGuard } from '@godcreator/gwb-repo-kit'

/**
 * 自述防漏——正本住 @godcreator/gwb-repo-kit，这儿只是挂号薄壳。
 *
 * `docsDir` 必须显式给：守卫的默认值是按**包根**找 `docs-site/content/docs`，本仓的站在
 * 仓根、薄壳在 `plugins/<件>/tests/`，默认值指不到——指不到它就静默空跑，「源码 inject 的
 * 服务名要在站现状区里出现」那一条永不生效。
 */
const here = path.dirname(fileURLToPath(import.meta.url))
registerSelfReportGuard(
  { describe, it, expect },
  { root: path.resolve(here, '..'), docsDir: path.resolve(here, '../../../docs-site/content/docs') },
)

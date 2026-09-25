import type { Context } from 'cordis'
import type { GwbContext } from '@godcreator/gwb-kernel-desktop'
import type { GwbCommands } from '@godcreator/gwb-commands'
import type { GwbSettingsApi } from '@godcreator/gwb-settings'
import type {} from '@godcreator/gwb-shell'
import { buildStartupCss } from './startup-css.js'

/** 各插件发的 `declare module 'cordis'` 在 pnpm store 布局下会加到另一个 `Context` 上，所以在本文件按真类型再声明一遍 */
declare module 'cordis' {
  interface Context {
    gwbSettings: GwbSettingsApi
    gwbCommands?: GwbCommands
  }
}

// `Context` 只为给上面的增强一个落点：oxlint 把只用于模块增强的具名导入判成未使用，这里留一个引用（依赖里也因此要有 cordis）
void (undefined as unknown as Context)

export const name = 'gwb-theme'

export const VALUES_COMMAND = 'theme.values'
export const SAVE_COMMAND = 'theme.save'
export const STARTUP_COMMAND = 'theme.startupCss'

/** kebab-case 是设置插件的规矩 */
export const FONT_SANS_KEY = 'font-sans'
export const FONT_MONO_KEY = 'font-mono'
export const CUSTOM_CSS_KEY = 'custom-css'

/** 必需依赖：没有设置存不了三项外观，没有命令总线三条命令无法对外提供 */
export const inject = ['gwbSettings', 'gwbCommands']

/** 与本模块同在 dist/ 下 */
const CLIENT_URL = new URL('./client.js', import.meta.url).href
const STYLE_URL = new URL('./style.css', import.meta.url).href

const PACKAGE_NAME = '@godcreator/gwb-theme'

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

interface ThemeSettingValues {
  fontSans: string
  fontMono: string
  customCss: string
}

function readThemeSettingValues(ctx: GwbContext): ThemeSettingValues {
  const settings = ctx.gwbSettings
  return {
    fontSans: asText(settings.get(FONT_SANS_KEY)),
    fontMono: asText(settings.get(FONT_MONO_KEY)),
    customCss: asText(settings.get(CUSTOM_CSS_KEY)),
  }
}

/** 键名与设置项的 key 一致，浏览器侧按这个形状接收 */
function toKebabValues(values: ThemeSettingValues): { 'font-sans': string; 'font-mono': string; 'custom-css': string } {
  return { [FONT_SANS_KEY]: values.fontSans, [FONT_MONO_KEY]: values.fontMono, [CUSTOM_CSS_KEY]: values.customCss }
}

/** 三项都是 home 级；缺省空串表示没设置，启动样式里就不出现 */
function defineThemeSettings(settings: GwbSettingsApi): void {
  settings.define({
    key: FONT_SANS_KEY,
    title: '正文字体',
    type: 'string',
    default: '',
    description: 'font-family 的值，如 Consolas, monospace。留空 = 用令牌表默认的系统字体',
  })
  settings.define({
    key: FONT_MONO_KEY,
    title: '等宽字体',
    type: 'string',
    default: '',
    description: 'font-family 的值。代码、日志等处用的等宽字体',
  })
  settings.define({
    key: CUSTOM_CSS_KEY,
    title: '自定义样式表',
    type: 'string',
    default: '',
    description: '整段 CSS 原样生效，排在令牌之后、可覆盖令牌——写 :root { --background: … } 就能换掉整套配色',
  })
}

const SAVE_KEYS = [FONT_SANS_KEY, FONT_MONO_KEY, CUSTOM_CSS_KEY] as const

/** 系统边界上的校验：三个键都要给、都是字符串，多给的键也拒 */
function parseSaveArgs(args: unknown): { ok: true; values: ThemeSettingValues } | { ok: false; error: string } {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return { ok: false, error: `${SAVE_COMMAND} 的参数要是对象 { "font-sans", "font-mono", "custom-css" }，收到的是 ${JSON.stringify(args) ?? String(args)}` }
  }
  const record = args as Record<string, unknown>
  const unknownKeys = Object.keys(record).filter((key) => !(SAVE_KEYS as readonly string[]).includes(key))
  if (unknownKeys.length > 0) return { ok: false, error: `${SAVE_COMMAND} 认不出这些键：${unknownKeys.join('、')}；只收 ${SAVE_KEYS.join('、')}` }
  for (const key of SAVE_KEYS) {
    if (!(key in record)) return { ok: false, error: `${SAVE_COMMAND} 缺键 "${key}"：三个键都要给，空串表示恢复默认` }
    if (typeof record[key] !== 'string') return { ok: false, error: `${SAVE_COMMAND} 的 "${key}" 要是字符串，收到的是 ${typeof record[key]}` }
  }
  return {
    ok: true,
    values: {
      fontSans: record[FONT_SANS_KEY] as string,
      fontMono: record[FONT_MONO_KEY] as string,
      customCss: record[CUSTOM_CSS_KEY] as string,
    },
  }
}

/** 命令总线把注销登记在本插件的上下文上，本插件卸载时三条命令自动注销 */
function registerThemeCommands(ctx: GwbContext, commandBus: GwbCommands): void {
  const settings = ctx.gwbSettings
  commandBus.register(
    { name: STARTUP_COMMAND, description: '启动样式表（字体覆盖 + 自定义 CSS），外壳启动时读取', usage: '无参数', plugin: PACKAGE_NAME },
    () => buildStartupCss(readThemeSettingValues(ctx)),
  )
  commandBus.register(
    { name: VALUES_COMMAND, description: '本插件三项设置的当前值', usage: '无参数', plugin: PACKAGE_NAME },
    () => toKebabValues(readThemeSettingValues(ctx)),
  )
  commandBus.register(
    {
      name: SAVE_COMMAND,
      description: '一次写齐三项外观设置',
      usage:
        '参数 { "font-sans", "font-mono", "custom-css" }：三个键都必给、值都是字符串（空串 = 恢复默认）。参数不是对象、缺键、多了别的键、值不是字符串都回 ok:false，一项都不写',
      plugin: PACKAGE_NAME,
    },
    async (args) => {
      const parsed = parseSaveArgs(args)
      if (!parsed.ok) return { ok: false, error: parsed.error }
      // 逐项走 set：它自带「先 define 过才许写」的检查与原子写入
      await settings.set(FONT_SANS_KEY, parsed.values.fontSans)
      await settings.set(FONT_MONO_KEY, parsed.values.fontMono)
      await settings.set(CUSTOM_CSS_KEY, parsed.values.customCss)
      return { ok: true }
    },
  )
}

/** 局部注入：没有外壳时这个子 fiber 一直 PENDING，本插件照常加载，启动样式照常生效 */
function registerAppearancePaneWheneverShellIsLoaded(ctx: GwbContext): void {
  ctx.inject(['gwbShell'], (contextWithShell) => {
    contextWithShell.gwbShell.registerPane({
      id: 'appearance',
      title: '外观',
      icon: 'palette',
      client: CLIENT_URL,
      style: STYLE_URL,
    })
    contextWithShell.gwbShell.describeSelf({ title: '外观', icon: 'palette' })
  })
}

export function apply(ctx: GwbContext): void {
  const log = ctx.logger(name)
  const commandBus = ctx.gwbCommands
  // inject 保证了它在，这句只为收窄类型
  if (commandBus === undefined) return
  defineThemeSettings(ctx.gwbSettings)
  registerThemeCommands(ctx, commandBus)
  registerAppearancePaneWheneverShellIsLoaded(ctx)
  log.info(`外观就绪：三项设置 + 三条命令（启动样式走 ${STARTUP_COMMAND}）`)
}

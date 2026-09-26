/** node 侧的 `theme.startupCss` 与浏览器侧外观窗格的实时预览都用这一个函数，保存的与看到的才是同一份 */

/** 空串与纯空白算没设置 */
export interface ThemeValues {
  fontSans: string
  fontMono: string
  customCss: string
}

/** 变量名与外壳令牌表 tokens.css 里的一一对应，那边改名这边要跟 */
const FONT_VARS: ReadonlyArray<readonly [keyof ThemeValues, string]> = [
  ['fontSans', '--gwb-font-sans'],
  ['fontMono', '--gwb-font-mono'],
]

export function buildStartupCss(values: ThemeValues): string {
  const fontOverrides = FONT_VARS
    .map(([key, varName]) => {
      const text = values[key].trim()
      return text === '' ? undefined : `${varName}: ${text};`
    })
    .filter((line): line is string => line !== undefined)
  const rootBlock = fontOverrides.length === 0 ? '' : `:root {\n  ${fontOverrides.join('\n  ')}\n}\n`
  const customCss = values.customCss.trim()
  return [rootBlock, customCss].filter((part) => part !== '').join('\n')
}

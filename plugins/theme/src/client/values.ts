/**
 * `theme.values` / `theme.save` 的键名与外观窗格三个输入框之间的换算。
 * 放在 .ts 而不是 .tsx：键名 `font-sans` / `font-mono` 与 Tailwind 工具类同名，devkit 的样式检查把 .tsx 里的字符串都当类名查
 */

export interface FieldValues {
  fontSans: string
  fontMono: string
  customCss: string
}

/**
 * `theme.values` 回执的 data。形状不对就抛错、不当成空串：外观窗格拿这三个值当保存的底稿，
 * 当成空串的话一点保存就把三项设置全清空
 */
export function fieldValuesOf(data: unknown): FieldValues {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`theme.values 的回执要是对象，收到的是 ${JSON.stringify(data) ?? String(data)}`)
  }
  const record = data as Record<string, unknown>
  const textOf = (key: string): string => {
    const value = record[key]
    if (typeof value !== 'string') throw new Error(`theme.values 回执里的 "${key}" 要是字符串，收到的是 ${typeof value}`)
    return value
  }
  return {
    fontSans: textOf('font-sans'),
    fontMono: textOf('font-mono'),
    customCss: textOf('custom-css'),
  }
}

/** `theme.save` 的参数：三个键都给 */
export function saveArgsOf(values: FieldValues): Record<string, string> {
  return {
    'font-sans': values.fontSans,
    'font-mono': values.fontMono,
    'custom-css': values.customCss,
  }
}

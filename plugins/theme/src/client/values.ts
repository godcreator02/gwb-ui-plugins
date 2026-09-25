/**
 * `theme.values` / `theme.save` 的键名与外观窗格三个输入框之间的换算。
 * 放在 .ts 而不是 .tsx：键名 `font-sans` / `font-mono` 与 Tailwind 工具类同名，devkit 的样式检查把 .tsx 里的字符串都当类名查
 */

export interface FieldValues {
  fontSans: string
  fontMono: string
  customCss: string
}

/** `theme.values` 回执的 data：值不是字符串的项按空串处理（空串 = 没设置） */
export function fieldValuesOf(data: Record<string, unknown>): FieldValues {
  const textOf = (value: unknown): string => (typeof value === 'string' ? value : '')
  return {
    fontSans: textOf(data['font-sans']),
    fontMono: textOf(data['font-mono']),
    customCss: textOf(data['custom-css']),
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

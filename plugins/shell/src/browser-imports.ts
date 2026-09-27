/** 无副作用的代码出口：运行时登记与构建外置名单共用，地址相对本模块的发布产物。 */
export function browserImports(): Readonly<Record<string, string>> {
  return {
    react: new URL('./react/react.js', import.meta.url).href,
    'react/jsx-runtime': new URL('./react/react-jsx-runtime.js', import.meta.url).href,
    'react-dom': new URL('./react/react-dom.js', import.meta.url).href,
    'react-dom/client': new URL('./react/react-dom-client.js', import.meta.url).href,
  }
}

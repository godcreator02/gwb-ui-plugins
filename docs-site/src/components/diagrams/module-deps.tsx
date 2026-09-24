/**
 * 本仓几个模块之间的依赖方向：框里是本仓（带界面的插件、令牌表、外壳、主题插件），框外是基础仓插件与内核。
 * 箭头只朝一个方向；主题插件那条是虚线，表示外壳没有它也照常运行。
 */

import { Arrow, Box, Frame, Note } from './parts'

export function ModuleDeps() {
  return (
    <svg viewBox="0 0 400 440" role="img" aria-label="本仓各模块之间的依赖方向">
      <Frame x={10} y={8} w={380} h={300} label="本仓 gwb-ui-plugins" />
      <Box x={110} y={36} w={180} h={56} lines={['带界面的插件', 'baseui · theme · 下游插件']} tone="a" />

      <Box x={24} y={150} w={160} h={70} lines={['令牌表（外壳包里）', 'tokens.css', 'theme.reference.css']} mono />
      <Box x={216} y={150} w={160} h={56} lines={['外壳 shell', '窗格注册 + 容器']} />
      <Box x={216} y={238} w={160} h={56} lines={['主题插件 theme', 'theme.startupCss']} dashed mono />

      <Arrow from={[160, 92]} to={[104, 150]} tone="a" />
      <Note x={24} y={112}>构建期引映射文件</Note>
      <Note x={24} y={130}>运行期读变量值</Note>
      <Arrow from={[240, 92]} to={[296, 150]} tone="a" />
      <Note x={300} y={112}>注册窗格</Note>
      <Note x={300} y={130} mono>import type</Note>
      <Arrow from={[296, 206]} to={[296, 238]} label="可选命令" dashed />

      <Arrow from={[109, 308]} to={[109, 336]} label="peer 依赖" />
      <Box x={24} y={336} w={170} h={70} lines={['基础仓插件', 'commands · data', 'settings · logger …']} mono />
      <Box x={210} y={336} w={170} h={70} lines={['内核', '只读 gwb.shared', '拼 importmap']} />
      <Note x={20} y={428}>反方向的依赖一条都没有；内核不依赖任何插件。</Note>
    </svg>
  )
}

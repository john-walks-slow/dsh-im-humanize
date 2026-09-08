import { t } from '../../../../src/channels/shared/i18n.mjs';

/** Public startup guidance never includes parser excerpts, paths, or credential values. */
export function publicWecomStartupError(error) {
  if (error instanceof SyntaxError
    || error?.message === 'dsh-im Enterprise WeChat config contains invalid bot data'
    || error?.message === 'dsh-im workspace config is invalid') {
    return {
      code: 'wecom-startup-config-invalid',
      message: t('企业微信配置格式错误。请检查企业微信数据目录中的 config.json 和 workspaces.json，修复后重启 DSH。详细原因请查看启动日志。'),
      details: {},
    };
  }
  if (error?.code === 'EACCES' || error?.code === 'EPERM') {
    return {
      code: 'wecom-startup-permission-denied',
      message: t('无法读取或写入企业微信配置。请检查企业微信数据目录的访问权限，修复后重启 DSH。详细原因请查看启动日志。'),
      details: {},
    };
  }
  return {
    code: 'wecom-startup-failed',
    message: t('企业微信初始化失败。请查看 DSH 启动日志中 failed to activate wecom 后的错误，修复后重启 DSH。'),
    details: {},
  };
}

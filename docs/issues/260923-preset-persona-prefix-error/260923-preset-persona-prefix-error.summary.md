# 修复总结报告：260923-preset-persona-prefix-error

## 1. 背景与问题描述

用户在 IM（Telegram）发一条消息，机器人即回复：
> 最近一条消息处理失败：任务未完成，暂时无法确定原因。请重试；若持续发生，请将参考号提供给管理员。（错误码 INTERNAL_UNKNOWN · 参考号 MF-5CADC159 · 2026/09/23 20:34）

## 2. 根因总结

昨日（2026-09-22）系统将 DSH 升级到 `0.1.5-rc.3`。该版本中 `@deepseek-ai/dsh-persona` 插件重构了其配置 Schema，将旧版的 `text: string` 改为了必填的 `prefix: z.string().required()`。
由于用户的 Agent Presets 保存在 `/root/.dsh/.agent-presets/`，属于用户配置，npm 包更新不会自动修改该目录。导致包括 `agent` 在内的 7 个预设在加载会话时均报 `invalid config: - $.prefix missing required value (at prefix)`，DSH 挂载 preset 失败并返回 `gateway/internal` 错误，进而被 `dsh-im` 包装为 `INTERNAL_UNKNOWN` 错误码。

## 3. 实施变更

对 `/root/.dsh/.agent-presets/` 下的 7 个预设配置进行了修复，将 `@deepseek-ai/dsh-persona` 节点下的 `text:` 改为 `prefix:`：
- `/root/.dsh/.agent-presets/agent/agent.cordis.yml`
- `/root/.dsh/.agent-presets/dev/agent.cordis.yml`
- `/root/.dsh/.agent-presets/general/agent.cordis.yml`
- `/root/.dsh/.agent-presets/omni/agent.cordis.yml`
- `/root/.dsh/.agent-presets/perfect/agent.cordis.yml`
- `/root/.dsh/.agent-presets/roleplay/agent.cordis.yml`
- `/root/.dsh/.agent-presets/yuyu/agent.cordis.yml`

所有修改前文件均保留 `.bak-260923` 备份。

## 4. 验证结果

通过 DSH HTTP RPC 探针对各机器人会话（涵盖 `agent`, `yuyu`, `roleplay` 预设）进行恢复与挂载验证，全部返回 `{"ok": true}`，预设已成功热加载。

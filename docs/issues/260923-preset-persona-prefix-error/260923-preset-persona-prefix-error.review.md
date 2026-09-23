# 代码与配置检视报告：260923-preset-persona-prefix-error

## 1. 检视概述

- **检视对象**：`/root/.dsh/.agent-presets/*/agent.cordis.yml` 中 `@deepseek-ai/dsh-persona` 配置项
- **改动范围**：7 个文件，每个文件仅修改 1 行（将 `text:` 更改为 `prefix:`）
- **检视人**：主工程师自检（修改 < 50 行且为纯配置键名对齐，风险极低）

## 2. 差异核对清单

| 预设目录 | 修改项 | 语法有效性 | 验证结果 |
|---|---|---|---|
| `agent/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，JS block 完好 | `session/selectModel` 挂载通过 (ok: true) |
| `dev/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，JS block 完好 | 配置语法通过 |
| `general/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，JS block 完好 | 配置语法通过 |
| `omni/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，folded block 完好 | 配置语法通过 |
| `perfect/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，literal block 完好 | 配置语法通过 |
| `roleplay/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，JS block 完好 | `session/selectModel` 挂载通过 (ok: true) |
| `yuyu/agent.cordis.yml` | `text:` → `prefix:` | YAML 语法正确，JS block 完好 | `session/selectModel` 挂载通过 (ok: true) |

## 3. 风险与向下兼容评估

1. **是否有额外依赖/副作用**：无。`@deepseek-ai/dsh-persona` 在 DSH 0.1.5-rc.3 明确声明 `prefix: z.string().required()`，新键名是官方规范。
2. **是否破坏历史会话**：无。历史会话持久化的是事件序列，Preset 是会话运行时环境。修复后历史会话可无缝恢复。
3. **备份情况**：所有修改文件均已在同级目录保留 `.bak-260923` 备份。

## 4. 结论

**准入**。无需进一步调整。

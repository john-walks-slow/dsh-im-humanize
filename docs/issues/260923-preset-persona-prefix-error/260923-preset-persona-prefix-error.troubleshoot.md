# 故障诊断报告：IM 消息处理失败 (INTERNAL_UNKNOWN / persona prefix 缺失)

## 0. 故障背景

用户反馈在 IM（Telegram）发一条消息即提示：
> 最近一条消息处理失败：任务未完成，暂时无法确定原因。请重试；若持续发生，请将参考号提供给管理员。（错误码 INTERNAL_UNKNOWN · 参考号 MF-5CADC159 · 2026/09/23 20:34）

- **受影响机器人**：`luna`（`mimitchi_luna_bot`，工作区 `/root/agents/luna`，对应 Agent Preset `agent`）
- **受影响会话**：`session-300d309e-df84-446d-b191-93e2a5fc1c91`
- **参考号**：`MF-5CADC159`，发生时间：2026-09-23 20:34

---

## 1. 问题复现与现场实锤

通过 DSH HTTP RPC 探针直接模拟向该会话提交 prompt：

```bash
curl -s -X POST "http://127.0.0.1:4180/api/session/prompt" \
  -H "Cookie: $COOKIE" -H 'Content-Type: application/json' \
  -d '{"type":"client-request","rpcId":"probe-prompt","method":"session/prompt","payload":{"args":{"request":{"sessionId":"session-300d309e-df84-446d-b191-93e2a5fc1c91","requestId":"probe-req-1","mode":"queue","content":[{"type":"text","text":"ping"}]}}}}'
```

**响应结果（100% 精确复现）：**
```json
{
  "type": "server-response",
  "rpcId": "probe-prompt",
  "result": {
    "ok": false,
    "error": {
      "code": "gateway/internal",
      "message": "resume failed for session \"session-300d309e-df84-446d-b191-93e2a5fc1c91\": RemoteError: agent-presets: preset \"agent\" failed to mount: failed to apply loader entry persona (@deepseek-ai/dsh-persona): invalid config:\n  - $.prefix missing required value (at prefix) (/root/.dsh/.agent-presets/agent/agent.cordis.yml)",
      "details": {}
    }
  }
}
```

---

## 2. 根因分析

### 2.1 变更根因：DSH 升级破坏性变更与本地 Presets 未同步
1. **DSH 升级**：昨日（2026-09-22 20:16）系统将 DSH 升级到了 `0.1.5-rc.3`（升级前为 `0.1.1-rc.2`）。
2. **Schema 破坏性改动**：在 DSH 0.1.5-rc.3 中，`@deepseek-ai/dsh-persona` 插件重构了其配置规范：
   - 旧版规范：`config: { text: string }`
   - 0.1.5 规范：
     ```typescript
     const Config = z.object({
       prefix: z.string().required(),
       suffix: z.string().default(""),
       complete: z.boolean().default(false),
       includeRuntimeContext: z.boolean().default(true)
     });
     ```
     `prefix` 为**必填字段**，原 `text` 字段已被移除。
3. **用户预设未升级**：用户的预设位于 `/root/.dsh/.agent-presets/`，属于用户配置，npm 包升级不会也不能自动修改用户目录下的预设文件。
4. **波及范围**：检查 `/root/.dsh/.agent-presets/*/agent.cordis.yml`，以下 7 个本地预设全部受到影响：
   - `agent`（luna 正在使用）
   - `roleplay`（yu 正在使用）
   - `yuyu`（ami 正在使用）
   - `dev`
   - `general`
   - `omni`
   - `perfect`

### 2.2 现象↔根因映射
1. 用户在 Telegram 发送消息，`dsh-im` 接收并调用 `session.prompt`。
2. DSH host 的 `sessionController.prompt` 试图恢复并挂载该会话绑定的 preset（`agent`）。
3. Cordis 加载预设的 `agent.cordis.yml` 中的 `@deepseek-ai/dsh-persona` 时，Zod 校验报错：`$.prefix missing required value (at prefix)`。
4. `sessionController` 抛出 `RemoteError("gateway/internal", "resume failed for session ...: preset failed to mount: ...")`。
5. `dsh-im` 的 `harness-client` 收到错误后由 `message-failure.mjs` 归类为 `INTERNAL_UNKNOWN`，生成参考号 `MF-5CADC159`，将友好错误提示发回 Telegram。
6. 会话文件 `session.v3.jsonl.zstd` 停在恢复初期的 `seq: 186`（`session/end-seed`），根本未进入用户消息录入阶段。

---

## 3. 修复方案

### 3.1 修复路径（精准修复）
修改 `/root/.dsh/.agent-presets/` 下受影响的 7 个 `agent.cordis.yml` 文件：
将 `@deepseek-ai/dsh-persona` 节点下的配置键名从 `text` 替换为 `prefix`。

例如 `/root/.dsh/.agent-presets/agent/agent.cordis.yml`：
```yaml
# 修改前
- id: persona
  name: "@deepseek-ai/dsh-persona"
  config:
    text: !!js |-
      ...

# 修改后
- id: persona
  name: "@deepseek-ai/dsh-persona"
  config:
    prefix: !!js |-
      ...
```

同理修复 `dev`, `general`, `omni`, `perfect`, `roleplay`, `yuyu` 中的对应配置。

### 3.2 生效机制
DSH 的 `dsh-agent-presets` 模块内置了基于文件 mtime 的 stale 检测（`ensureStanding`）：
当 `agent.cordis.yml` 文件修改后，下一次会话挂载时会自动检测到变更并加载新 generation，**无需重启 DSH 线上服务**。

---

## 4. 置信度评估

- **确信度**：**100%**。
- 依据：
  1. 通过 API 探针直接复现了精确到字段级别的报错 `$.prefix missing required value`。
  2. 源码层证实了 `@deepseek-ai/dsh-persona/lib/index.js` 的 `prefix: z.string().required()` 模式定义。
  3. 确认了所有报错链条（从 `gateway/internal` 到 `INTERNAL_UNKNOWN` 再到 `MF-5CADC159`）与用户看到的情形 100% 吻合。

---

## 5. 验收标准

1. 对受影响的预设文件修复后，使用 RPC 探针向 `session-300d309e-df84-446d-b191-93e2a5fc1c91` 发送测试 prompt，不再报 `preset failed to mount`，返回 `accepted: true`。
2. 用户在 Telegram 向 luna 机器人发消息，机器人能够正常响应生成回复，不再提示处理失败。

# proactive 唤醒投递 · 用户验证（send_im 工具方案）

## 验证说明

- 验证对象：`send_im` 模型工具（botId/targetId 可省略，自动投当前 Session 绑定的私聊）
- 环境/前置条件：本 fork 构建产物已加载（**需重启 dsh 生效**）；至少一个 Telegram bot 已配置，且目标私聊与某 Session 有绑定（在私聊里说过话即产生 `state.sessions` 绑定）；dsh-proactive 已启用
- 自动化已覆盖（无需手动验证）：
  - send_im 显式投递/错误码/置空自动找绑定/无绑定报错/无会话报错 —— `test/im-send-tool.test.mjs`
  - 绑定私聊反查（排除群聊、state 读取失败跳过）—— `test/delivery-adapter.test.mjs`
  - delivery-service 聚合与 target 校验 —— `test/delivery-service.test.mjs`

## 验证项

| 验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据 |
| --- | --- | --- | --- | --- |
| 1. 用 dsh-proactive 设一个 1–2 分钟后的闹钟唤醒某个「在 telegram 私聊聊过」的 Session；唤醒回合让模型调 `send_im`（提示词点名，省略 botId/targetId） | 该 telegram 私聊收到唤醒正文原文 | | 待验证 | 需在唤醒 prompt 中引导模型调用 send_im |
| 2. 对「未绑定任何 telegram 私聊」的 Session 唤醒，模型调 `send_im` 且省略 botId/targetId | 工具报错「no-bound-target」，提示显式填 botId/targetId | | 待验证 | |
| 3. 唤醒回合模型调 `send_im` 显式填 `botId + targetId`（复制调用参数） | 指定目标收到消息 | | 待验证 | |
| 4. 在 telegram 私聊里正常发一条消息（dsh-im 入站回合），模型直接输出文本 | 回复自动回私聊，模型不应调用 send_im | | 待验证 | 靠工具描述 + 上下文增强标签约束 |

## 验证结论

待验证。

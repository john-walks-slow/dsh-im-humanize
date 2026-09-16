# 主动回合自动投递 · 用户验证

## 验证说明

- 验证对象：主动回合（proactive 唤醒 / 定时任务 / 后台子代理完成通知）的可见回复**自动投递**到当前 Session 绑定的私聊，原文无前缀，不依赖双向同步开关
- 环境/前置条件：本 fork 构建产物已加载（**需重启 dsh 生效**）；至少一个 Telegram bot 已配置，且目标私聊与该 Session 有绑定（在私聊里说过话即产生 `state.sessions` 绑定）；dsh-proactive 已启用
- 自动化已覆盖（无需手动验证）：
  - wake/subagent-settled 投绑定私聊原文、no-reply/failed/外来 plugin 不投、lookup 失败不投 —— `test/session-sync-coordinator.test.mjs`
  - 绑定私聊反查（排除群聊、state 读取失败跳过）—— `test/delivery-adapter.test.mjs`
  - delivery-service 聚合与 target 校验 —— `test/delivery-service.test.mjs`

## 验证项

| 验证步骤 | 预期结果 | 实际结果 | 状态 | 备注/证据 |
| --- | --- | --- | --- | --- |
| 1. 用 dsh-proactive 设一个 1–2 分钟后的闹钟唤醒某个「在 telegram 私聊聊过」的 Session；唤醒回合模型**直接输出文本**（不调任何工具） | 该 telegram 私聊收到正文原文，无 `[DSH 助手]` 前缀 | | 待验证 | 自动投递，模型零判断 |
| 2. 唤醒回合模型调 `no_reply`（不想说话） | 私聊不收到任何消息 | | 待验证 | |
| 3. 后台子代理（subagent）跑完、父会话被通知后，父 agent 直接输出文本 | 文本自动投到父会话绑定的私聊 | | 待验证 | |
| 4. 对「未绑定任何 telegram 私聊」的 Session 唤醒，模型直接输出文本 | 不投递（无绑定私聊），不报错 | | 待验证 | |
| 5. 回归：Web/CLI 直接对话（开了双向同步） | 仍走 `[DSH 助手]` 前缀镜像，行为不变 | | 待验证 | |

## 验证结论

待验证。

// QQ markdown 回复投递：长文尽量按结构边界切分，以 msg_type=2 发送，
// 平台拒绝 markdown 时逐条回退纯文本。

const DEFAULT_CHUNK_LIMIT = 4_500;
const CODE_FENCE_OPEN = /^```/;
const GFM_TABLE_LINE = /^\|.+\|$/;
const PASSIVE_REPLY_LIMIT = Object.freeze({ c2c: 4, group: 5 });
const PARTIAL_REPLY_NOTICE = '回答较长，后续内容未能通过 QQ 完整发送，请回复“继续”。';

function safeSliceIndex(value, limit) {
  let index = Math.min(limit, value.length);
  const before = value.charCodeAt(index - 1);
  const after = value.charCodeAt(index);
  if (before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF) {
    index -= 1;
  }
  return Math.max(1, index);
}

/**
 * 按换行边界切分 Markdown 文本：
 * - 不在代码块中间断开；
 * - 不在 GFM 表格中间断开；
 * - 超长行在 limit 处硬切，避免单行超限无法投递。
 */
export function chunkMarkdownText(text, limit = DEFAULT_CHUNK_LIMIT) {
  const value = typeof text === 'string' ? text : '';
  const bound = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_CHUNK_LIMIT;
  if (value.length <= bound) return value ? [value] : [];

  const lines = value.split('\n');
  const chunks = [];
  let current = '';
  let inCodeBlock = false;
  let tableBuffer = [];

  const appendBlock = (block) => {
    if (block.length <= bound) {
      if (!current) {
        current = block;
        return;
      }
      const candidate = `${current}\n${block}`;
      if (candidate.length > bound) {
        chunks.push(current);
        current = block;
      } else {
        current = candidate;
      }
      return;
    }
    // 超大块：收束当前块后按 bound 硬切，保证每块可投递。
    if (current) {
      chunks.push(current);
      current = '';
    }
    let remaining = block;
    while (remaining.length > bound) {
      const index = safeSliceIndex(remaining, bound);
      chunks.push(remaining.slice(0, index));
      remaining = remaining.slice(index);
    }
    current = remaining;
  };

  const flushTable = () => {
    if (tableBuffer.length === 0) return;
    const block = tableBuffer.join('\n');
    tableBuffer = [];
    appendBlock(block);
  };

  const appendLine = (line) => {
    let remaining = line;
    // 超长行先硬切，保证每块不超过 bound。
    while (remaining.length > bound) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const index = safeSliceIndex(remaining, bound);
      chunks.push(remaining.slice(0, index));
      remaining = remaining.slice(index);
    }
    appendBlock(remaining);
  };

  for (const line of lines) {
    if (CODE_FENCE_OPEN.test(line)) {
      flushTable();
      if (!inCodeBlock && current) {
        // 代码块开启：先收束当前块，让整个代码块从新块开始。
        chunks.push(current);
        current = '';
      }
      inCodeBlock = !inCodeBlock;
      appendLine(line);
      continue;
    }
    if (inCodeBlock) {
      appendLine(line);
      continue;
    }
    if (GFM_TABLE_LINE.test(line)) {
      tableBuffer.push(line);
      continue;
    }
    flushTable();
    appendLine(line);
  }

  flushTable();
  if (current) chunks.push(current);
  return chunks;
}

function nextMsgSeq() {
  // 与 SDK getNextMsgSeq 相同的随机策略：被动回复同 msg_id 的多条消息
  // 各自带不同 msg_seq，避免平台去重（错误码 40054005）。
  const timePart = Date.now() % 100_000_000;
  const random = Math.floor(Math.random() * 65_536);
  return (timePart ^ random) % 65_536;
}

/**
 * 以 markdown（msg_type=2）发送回复；单条被平台拒绝时回退纯文本（msg_type=0）。
 * 返回每条消息的平台响应，供调用方提取 provider message ids。
 */
export async function sendMarkdownReply(bot, target, text, { logger } = {}) {
  const chunks = chunkMarkdownText(text);
  const results = [];
  const passiveLimit = target?.msgId ? PASSIVE_REPLY_LIMIT[target.scope] : null;
  const overflow = passiveLimit !== null && chunks.length > passiveLimit;
  const passiveContentCount = overflow ? passiveLimit - 1 : chunks.length;
  const proactiveTarget = target?.msgId
    ? { scope: target.scope, targetId: target.targetId }
    : target;
  let partialNoticeSent = false;

  const sendPartialNotice = async () => {
    if (partialNoticeSent || !target?.msgId) return;
    partialNoticeSent = true;
    try {
      results.push(await bot.sendText(target, PARTIAL_REPLY_NOTICE));
    } catch (error) {
      logger?.warn?.('[dsh-im:qq] unable to send partial reply notice:', error);
    }
  };

  for (const [index, chunk] of chunks.entries()) {
    const deliveryTarget = overflow && index >= passiveContentCount
      ? proactiveTarget
      : target;
    if (typeof bot?.send === 'function') {
      try {
        results.push(await bot.send({
          target: deliveryTarget,
          msgType: 2,
          markdown: { content: chunk },
          extra: { msg_seq: nextMsgSeq() },
        }));
        continue;
      } catch (error) {
        logger?.warn?.('[dsh-im:qq] markdown delivery failed; retrying as plain text:', error);
      }
    }
    try {
      results.push(await bot.sendText(deliveryTarget, chunk));
    } catch (error) {
      if (results.length === 0) throw error;
      await sendPartialNotice();
      break;
    }
  }
  return results;
}

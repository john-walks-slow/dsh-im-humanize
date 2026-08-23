// QQ markdown 回复投递：长文按代码块/表格边界切分，以 msg_type=2 发送，
// 平台拒绝 markdown 时逐条回退纯文本。

const DEFAULT_CHUNK_LIMIT = 4_500;
const CODE_FENCE_OPEN = /^```/;
const GFM_TABLE_LINE = /^\|.+\|$/;

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
      chunks.push(remaining.slice(0, bound));
      remaining = remaining.slice(bound);
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
      chunks.push(remaining.slice(0, bound));
      remaining = remaining.slice(bound);
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
  for (const chunk of chunks) {
    if (typeof bot?.send === 'function') {
      try {
        results.push(await bot.send({
          target,
          msgType: 2,
          markdown: { content: chunk },
          extra: { msg_seq: nextMsgSeq() },
        }));
        continue;
      } catch (error) {
        logger?.warn?.('[dsh-im:qq] markdown delivery failed; retrying as plain text:', error);
      }
    }
    results.push(await bot.sendText(target, chunk));
  }
  return results;
}

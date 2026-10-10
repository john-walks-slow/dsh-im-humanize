import { t } from './i18n.mjs';

export function splitMessageText(value, limit) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return [];
  const chunks = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n', limit);
    if (cut < Math.floor(limit * 0.55)) cut = remaining.lastIndexOf(' ', limit);
    if (cut < Math.floor(limit * 0.55)) cut = limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function createEditableMessageStream({
  initialText = t('正在处理…'),
  limit,
  updateIntervalMs = 800,
  create,
  edit,
  sendRemainder,
  messageIdForResult = () => null,
  logger = console,
  lazy = false,
}) {
  let messageId;
  const providerMessageIds = [];
  let pending = null;
  let timer = null;
  let inFlight = null;
  let closed = false;
  let started = false;
  let created = false;
  // In lazy mode no placeholder is ever sent, so lastSent starts empty;
  // eager mode seeds it with the placeholder text the start() call sends.
  let lastSent = lazy ? '' : initialText;

  // Create the message with `text` (lazy: first real content; eager: the
  // placeholder during start()). Records the provider id. No-op once the
  // message already exists.
  const ensureCreated = async (text) => {
    if (created) return;
    messageId = await create(text);
    created = true;
    if ((typeof messageId === 'string' && messageId.trim())
      || Number.isSafeInteger(messageId)) {
      providerMessageIds.push(String(messageId));
    }
  };

  const schedule = () => {
    if (closed || timer !== null || inFlight || !pending) return;
    timer = setTimeout(() => {
      timer = null;
      const text = pending;
      pending = null;
      const next = splitMessageText(text, limit)[0] ?? (lazy ? '' : initialText);
      inFlight = Promise.resolve(next === lastSent ? undefined
        : (created ? edit(messageId, next) : ensureCreated(next)))
        .then(() => { lastSent = next; })
        .catch((error) => logger.warn?.('[dsh-im] streamed message update failed:', error))
        .finally(() => {
          inFlight = null;
          schedule();
        });
    }, updateIntervalMs);
    timer?.unref?.();
  };

  return {
    get messageId() {
      return messageId;
    },
    get providerMessageIds() {
      return [...providerMessageIds];
    },
    async start() {
      // Eager mode creates the placeholder upfront; lazy mode defers until
      // the first real text update arrives (no placeholder bubble).
      if (!lazy) await ensureCreated(initialText);
      started = true;
      return this;
    },
    update(text) {
      if (closed || typeof text !== 'string' || !text.trim()) return;
      if (!started) return; // updates before start() are ignored
      pending = text;
      schedule();
    },
    async finish(text) {
      if (closed) throw new Error('Message stream is already closed');
      closed = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
      await inFlight?.catch(() => undefined);
      const chunks = splitMessageText(text, limit);
      const first = chunks[0] ?? t('处理完成。');
      if (!created) {
        // Lazy and never created: send the first chunk as a fresh message,
        // then any remainder. No placeholder edit.
        await ensureCreated(first);
      } else if (first !== lastSent) {
        await edit(messageId, first);
      }
      lastSent = first;
      for (const chunk of chunks.slice(1)) {
        const result = await sendRemainder(chunk);
        const id = messageIdForResult(result);
        if ((typeof id === 'string' && id.trim()) || Number.isSafeInteger(id)) {
          providerMessageIds.push(String(id));
        }
      }
    },
    cancel() {
      closed = true;
      pending = null;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      // If a lazy create is mid-flight it still settles and leaves the
      // first real chunk visible — the same orphan behavior as an
      // eagerly-cancelled placeholder (no removal API exists here).
      inFlight?.catch(() => undefined);
    },
  };
}

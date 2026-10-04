import { logger } from '../utils/logger';

export type Sender = (text: string) => Promise<void>;

// Telegram rejects messages over 4,096 characters.
const TELEGRAM_MAX = 4096;

export interface ContactMessage {
  message: string;
  contact?: string;
}

export class ContactService {
  constructor(private readonly send: Sender) {}

  async submit({ message, contact }: ContactMessage): Promise<void> {
    const header = [
      '📬 New message from YIMBY Tracker',
      `Reply to: ${contact?.trim() || '(not given)'}`,
      '',
    ].join('\n');

    const room = TELEGRAM_MAX - header.length;
    const body = message.length > room ? `${message.slice(0, room - 1)}…` : message;

    await this.send(header + body);
  }
}

/**
 * Plain text, no `parse_mode`: the message is user input, and Markdown or HTML
 * parsing would let a sender break the formatting or make Telegram reject the
 * whole message on an unbalanced `*`.
 */
export function telegramSender(token: string, chatId: string): Sender {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  return async text => {
    // Cleared once the request settles, rather than AbortSignal.timeout(), whose
    // timer outlives a fast response by the full five seconds.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
        signal: controller.signal,
      });
    } catch (err) {
      // Rethrown without the original error: the request URL carries the bot
      // token, and it must never reach the logs.
      throw new Error(`Telegram request failed: ${(err as Error).name}`);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const detail = await res.json().catch(() => ({})) as { description?: string };
      logger.error({ status: res.status, description: detail.description }, 'Telegram rejected message');
      throw new Error(`Telegram responded ${res.status}`);
    }
  };
}

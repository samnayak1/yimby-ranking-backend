import { ContactService, telegramSender } from '../src/services/ContactService';

describe('ContactService', () => {
  const msg = { name: 'Sam', email: 'sam@example.com', ip: '203.0.113.7', message: 'Hello there' };

  it('formats the message exactly as the chat expects', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await new ContactService(send).submit(msg);

    expect(send).toHaveBeenCalledWith(
      'New message from yimby-tracker\n' +
      'From: Sam <sam@example.com>\n' +
      'IP: 203.0.113.7\n' +
      '\n' +
      'Hello there',
    );
  });

  it("keeps the whole payload within Telegram's 4,096-character limit", async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await new ContactService(send).submit({ ...msg, message: 'x'.repeat(10_000) });

    const text = send.mock.calls[0][0] as string;
    expect(text.length).toBeLessThanOrEqual(4096);
    expect(text.startsWith('New message from yimby-tracker\nFrom: Sam')).toBe(true);
  });

  it('propagates send failures', async () => {
    const send = jest.fn().mockRejectedValue(new Error('down'));
    await expect(new ContactService(send).submit(msg)).rejects.toThrow('down');
  });
});

describe('telegramSender', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('posts plain text to the bot API without a parse mode', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await telegramSender('TOKEN123', '42')('hi *there*');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTOKEN123/sendMessage');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ chat_id: '42', text: 'hi *there*' });
    expect(body.parse_mode).toBeUndefined();
  });

  it('throws on a non-OK response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false, status: 401, json: async () => ({ description: 'Unauthorized' }),
    }) as unknown as typeof fetch;

    await expect(telegramSender('T', '1')('hi')).rejects.toThrow('Telegram responded 401');
  });

  it('never leaks the token when the request itself fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(
      new TypeError('fetch failed for https://api.telegram.org/botSECRETTOKEN/sendMessage'),
    ) as unknown as typeof fetch;

    const err: Error = await telegramSender('SECRETTOKEN', '1')('hi').then(
      () => { throw new Error('expected a rejection'); },
      (e: Error) => e,
    );
    expect(err.message).not.toContain('SECRETTOKEN');
    expect(err.message).toBe('Telegram request failed: TypeError');
  });
});

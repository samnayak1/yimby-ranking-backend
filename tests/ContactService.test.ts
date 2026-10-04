import { ContactService, telegramSender } from '../src/services/ContactService';

describe('ContactService', () => {
  it('formats the message with the reply-to line', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await new ContactService(send).submit({ message: 'Hello there', contact: '@sam' });

    const text = send.mock.calls[0][0] as string;
    expect(text).toContain('Reply to: @sam');
    expect(text.endsWith('Hello there')).toBe(true);
  });

  it('marks a missing contact', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await new ContactService(send).submit({ message: 'Hello there' });
    expect(send.mock.calls[0][0]).toContain('Reply to: (not given)');
  });

  it('keeps the whole payload within Telegram\'s 4,096-character limit', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    await new ContactService(send).submit({ message: 'x'.repeat(10_000) });
    expect((send.mock.calls[0][0] as string).length).toBeLessThanOrEqual(4096);
  });

  it('propagates send failures', async () => {
    const send = jest.fn().mockRejectedValue(new Error('down'));
    await expect(new ContactService(send).submit({ message: 'Hello there' })).rejects.toThrow('down');
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

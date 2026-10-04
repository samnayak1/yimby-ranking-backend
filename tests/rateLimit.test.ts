import { Request, Response } from 'express';
import { rateLimit } from '../src/middleware/rateLimit';

function fakeRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    setHeader(k: string, v: unknown) { this.headers[k] = v; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(b: unknown) { this.body = b; return this; },
  };
  return res as typeof res & Response;
}

describe('rateLimit', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-10-03T12:00:00Z') }));
  afterEach(() => jest.useRealTimers());

  const hit = (mw: ReturnType<typeof rateLimit>) => {
    const res = fakeRes();
    const next = jest.fn();
    mw({} as Request, res, next);
    return { res, next };
  };

  it('allows up to max requests in the window', () => {
    const mw = rateLimit(60_000, 3);
    for (let i = 0; i < 3; i++) expect(hit(mw).next).toHaveBeenCalled();
  });

  it('returns 429 with Retry-After once the window is used up', () => {
    const mw = rateLimit(60_000, 2);
    hit(mw); hit(mw);

    jest.advanceTimersByTime(20_000);
    const { res, next } = hit(mw);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe(40);
  });

  it('resets once the window passes', () => {
    const mw = rateLimit(60_000, 1);
    hit(mw);
    expect(hit(mw).res.statusCode).toBe(429);

    jest.advanceTimersByTime(60_000);
    expect(hit(mw).next).toHaveBeenCalled();
  });

  it('keeps separate counts per limiter instance', () => {
    const a = rateLimit(60_000, 1);
    const b = rateLimit(60_000, 1);
    hit(a);
    expect(hit(b).next).toHaveBeenCalled();
  });
});

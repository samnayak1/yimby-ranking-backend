import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * One shared fixed window for everyone hitting the route. In memory, so it
 * resets on restart and counts per process — fine for a single backend
 * container guarding a low-traffic contact form.
 */
export function rateLimit(
  windowMs: number,
  max: number,
  message = 'Too many messages right now. Please try again later.',
): RequestHandler {
  let count = 0;
  let resetAt = 0;

  return (_req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    if (now >= resetAt) {
      count = 0;
      resetAt = now + windowMs;
    }

    count += 1;

    if (count > max) {
      res.setHeader('Retry-After', Math.ceil((resetAt - now) / 1000));
      res.status(429).json({ error: message });
      return;
    }

    next();
  };
}

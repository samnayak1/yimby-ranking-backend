import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';


export function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status ?? 500;
  const expected = status < 500;

  const log = (req as Request & { log?: typeof logger }).log ?? logger;

  if (expected) {
    log.warn({ status, err: err.message, path: req.originalUrl }, 'Request rejected');
  } else {

    log.error({ status, err, path: req.originalUrl }, 'Unhandled error');
  }


  if (res.headersSent) return;

  res.status(status).json({
    error: expected ? err.message : 'Internal server error',
  });
}

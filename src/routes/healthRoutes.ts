import { Router } from 'express';
import { DbProvider } from '../repos/client';

/**


   /health     liveness — does not touch sql
   /readiness  readiness — touches sql.

 */
export function healthRoutes(provider: DbProvider): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  router.get('/readiness', (req, res) => {
    try {
      provider.getDatabaseProvider().prepare('SELECT 1').get();
      res.json({ status: 'ok', database: 'ok' });
    } catch (err) {
      req.log?.error({ err }, 'Readiness check failed');
      res.status(503).json({ status: 'error', database: 'unavailable' });
    }
  });

  return router;
}

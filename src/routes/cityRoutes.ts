import { Router } from 'express';
import { CityController } from '../controllers/CityController';
import { authMiddleware, requireAdmin } from '../middleware/cognitoAuth';

export function cityRoutes(controller: CityController): Router {
  const router = Router();


  router.get('/',    controller.getAll);
  router.get('/:id', controller.getById);

  // Admin only
  router.post('/',            authMiddleware, requireAdmin, controller.create);
  router.patch('/:id',        authMiddleware, requireAdmin, controller.update);
  router.delete('/:id',       authMiddleware, requireAdmin, controller.delete);
  router.put('/:id/rankings', authMiddleware, requireAdmin, controller.upsertRanking);

  return router;
}
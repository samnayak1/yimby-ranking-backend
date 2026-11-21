import { Router } from 'express';
import { NewsController } from '../controllers/NewsController';
import { authMiddleware, requireAdmin } from '../middleware/cognitoAuth';
import { validate, validateQuery } from '../middleware/typeValidators';
import { listNewsQuerySchema, updateNewsSchema } from '../schemas/news.schemas';

export function newsRoutes(controller: NewsController): Router {
  const router = Router();

  // Public
  router.get('/', validateQuery(listNewsQuerySchema), controller.getAll);
  router.get('/filter/countries', controller.getCountries);

  // Admin only
  router.get('/admin', authMiddleware, requireAdmin, validateQuery(listNewsQuerySchema), controller.getAllForAdmin);
  router.patch('/:id', authMiddleware, requireAdmin, validate(updateNewsSchema), controller.update);

  return router;
}

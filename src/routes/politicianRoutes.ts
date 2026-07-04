import { Router } from 'express';
import { PoliticianController } from '../controllers/PoliticianController';
import { authMiddleware, requireAdmin } from '../middleware/cognitoAuth';
import { validate } from '../middleware/typeValidators';
import { createPoliticianSchema, updatePoliticianSchema, upsertPoliticianRatingSchema } from '../schemas/politician.schemas';



export function politicianRoutes(controller: PoliticianController): Router {
  const router = Router();
  router.get('/filter/filter-options', controller.getFilterOptions);
  // Public
  router.get('/', controller.getAll);
  router.get('/:id', controller.getById);

  // Admin only
  router.post('/', authMiddleware, requireAdmin, validate(createPoliticianSchema),
    controller.create
  );

  router.patch('/:id', authMiddleware, requireAdmin, validate(updatePoliticianSchema),
    controller.update
  );

  router.delete('/:id', authMiddleware, requireAdmin,
    controller.delete
  );

  router.put('/:id/ratings', authMiddleware, requireAdmin, validate(upsertPoliticianRatingSchema),
    controller.upsertRating
  );



  return router;
}
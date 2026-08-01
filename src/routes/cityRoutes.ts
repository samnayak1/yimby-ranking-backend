import { Router } from 'express';
import { CityController } from '../controllers/CityController';
import { authMiddleware, requireAdmin } from '../middleware/cognitoAuth';

import {
  createCitySchema,
  getCitiesQuerySchema,
  updateCitySchema,
  upsertCityRatingSchema,
} from '../schemas/city.schema';
import { validate, validateQuery } from '../middleware/typeValidators';

export function cityRoutes(controller: CityController): Router {
  const router = Router();

 router.get('/filter/filter-options', controller.getFilterOptions);
  router.get('/map', controller.getMapData);
  router.get(
  "/",
  validateQuery(getCitiesQuerySchema),
  controller.getAll,
);

  router.get('/:id', controller.getById);

  // Admin only
  router.post('/',
    authMiddleware, requireAdmin, validate(createCitySchema),
    controller.create
  );

  router.patch('/:id',
    authMiddleware, requireAdmin, validate(updateCitySchema),
    controller.update
  );

  router.delete('/:id',
    authMiddleware, requireAdmin,
    controller.delete
  );

  router.put('/:id/ratings',
    authMiddleware, requireAdmin, validate(upsertCityRatingSchema),
    controller.upsertMetrics
  );




  return router;
}
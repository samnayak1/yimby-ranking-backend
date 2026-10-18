import { Router } from 'express';
import { CreatorController, ResourceController } from '../controllers/MediaController';
import { authMiddleware, requireAdmin } from '../middleware/cognitoAuth';
import { validate, validateQuery } from '../middleware/typeValidators';
import {
  createCreatorSchema, createResourceSchema, listResourcesQuerySchema,
  updateCreatorSchema, updateResourceSchema,
} from '../schemas/media.schemas';

export function creatorRoutes(controller: CreatorController): Router {
  const router = Router();

  // Public
  router.get('/', controller.getAll);

  // Admin only
  router.post('/', authMiddleware, requireAdmin, validate(createCreatorSchema), controller.create);
  router.patch('/:id', authMiddleware, requireAdmin, validate(updateCreatorSchema), controller.update);
  router.delete('/:id', authMiddleware, requireAdmin, controller.delete);

  return router;
}

export function resourceRoutes(controller: ResourceController): Router {
  const router = Router();

  // Public
  router.get('/', validateQuery(listResourcesQuerySchema), controller.getAll);

  // Admin only
  router.post('/', authMiddleware, requireAdmin, validate(createResourceSchema), controller.create);
  router.patch('/:id', authMiddleware, requireAdmin, validate(updateResourceSchema), controller.update);
  router.delete('/:id', authMiddleware, requireAdmin, controller.delete);

  return router;
}

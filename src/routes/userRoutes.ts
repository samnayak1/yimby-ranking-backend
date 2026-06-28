import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { authMiddleware } from '../middleware/cognitoAuth';

export function userRoutes(controller: UserController): Router {
  const router = Router();

  router.get('/me',       authMiddleware, controller.me);
  router.get('/me/admin', authMiddleware, controller.isAdmin);

  return router;
}
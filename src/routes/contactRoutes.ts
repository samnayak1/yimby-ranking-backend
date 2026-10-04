import { Router } from 'express';
import { ContactController } from '../controllers/ContactController';
import { rateLimit } from '../middleware/rateLimit';
import { validate } from '../middleware/typeValidators';
import { contactSchema } from '../schemas/contact.schema';

export function contactRoutes(controller: ContactController): Router {
  const router = Router();

  // 10 messages an hour across all senders. Runs before validation so
  // malformed floods are counted too.
  const limit = rateLimit(60 * 60_000, 10);

  router.post('/', limit, validate(contactSchema), controller.send);

  return router;
}

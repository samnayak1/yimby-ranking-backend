import { Request, Response, NextFunction } from 'express';
import { ContactService } from '../services/ContactService';
import { ContactDto } from '../schemas/contact.schema';
import { createError } from '../utils/errorHelper';

export class ContactController {
  constructor(private readonly service: ContactService | null) {}

  send = async (
    req: Request<{}, {}, ContactDto>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.service) throw createError(503, 'Contact form is unavailable right now');

      const { message, contact, website } = req.body;

      if (website) {
        req.log?.warn('Contact honeypot filled — dropped');
        res.status(202).json({ ok: true });
        return;
      }

      await this.service.submit({ message, contact });
      res.status(202).json({ ok: true });
    } catch (err) {
      next(err);
    }
  };
}

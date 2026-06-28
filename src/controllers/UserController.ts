import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/errorHelper';


export class UserController {
  me = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw createError(401, 'Not authenticated');
      res.json({ data: req.user });
    } catch (err) { next(err); }
  };

  isAdmin = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw createError(401, 'Not authenticated');
      res.json({ isAdmin: req.user.groups.includes('admins') });
    } catch (err) { next(err); }
  };
}
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodType } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error:  'Validation failed',
        issues: result.error.issues.map(i => ({
          field:   i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data; 
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      res.status(400).json({
        error: "Validation failed",
        issues: result.error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    next();
  };
}
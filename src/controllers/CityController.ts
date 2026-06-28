import { Request, Response, NextFunction } from 'express';
import { CityService } from '../services/CityService';

export class CityController {
  constructor(private readonly service: CityService) {}

  getAll = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.getAll();
      res.json({ data, count: data.length });
    } catch (err) { next(err); }
  };

  getById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.getById(Number(req.params.id));
      res.json({ data });
    } catch (err) { next(err); }
  };

  create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.create(req.body);
      res.status(201).json({ data });
    } catch (err) { next(err); }
  };

  update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.update(Number(req.params.id), req.body);
      res.json({ data });
    } catch (err) { next(err); }
  };

  delete = (req: Request, res: Response, next: NextFunction): void => {
    try {
      this.service.delete(Number(req.params.id));
      res.status(204).end();
    } catch (err) { next(err); }
  };

  upsertRanking = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { year, ranking } = req.body;
      const data = this.service.upsertRanking(
        Number(req.params.id),
        Number(year),
        Number(ranking)
      );
      res.json({ data });
    } catch (err) { next(err); }
  };
}
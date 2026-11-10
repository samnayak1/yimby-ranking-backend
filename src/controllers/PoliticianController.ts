import { Request, Response, NextFunction } from 'express';
import { PoliticianService } from '../services/PoliticianService';
import {
  CreatePoliticianDto,
  UpdatePoliticianDto,
} from '../schemas/politician.schemas';
import { PoliticianFilters } from '../models';
import { PoliticianStatus } from '../types/enums';

export class PoliticianController {
  constructor(private readonly service: PoliticianService) {}

 getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'name',
        sortOrder = 'asc',
        search,
        designation,
        politicalLeaning,
        nationalityCode,
        status,
        cityId,
      } = req.query;

      const filters: PoliticianFilters = {
        page: Number(page),
        limit: Number(limit),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        search: search as string,
        designation: designation as string,
        politicalLeaning: politicalLeaning as string,
        nationalityCode: nationalityCode as string,
        status: status as PoliticianStatus,
        cityId: cityId ? Number(cityId) : undefined,
      };

      const result = await this.service.getAll(filters);
      res.json(result);
    } catch (err) {
      console.error('Error in getAll:', err);
      next(err);
    }
  };

  getById = (req: Request<{ id: string }>, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.getById(Number(req.params.id));
      res.json({ data });
    } catch (err) { 
      console.error('Error in getById:', err);
      next(err); }
  };

  create = (req: Request<{}, {}, CreatePoliticianDto>, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.create(req.body);
      res.status(201).json({ data });
    } catch (err) {
      console.error('Error in create:', err);
      next(err); }
  };

  update = (req: Request<{ id: string }, {}, UpdatePoliticianDto>, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.update(Number(req.params.id), req.body);
      res.json({ data });
    } catch (err) { 
      console.error('Error in update:', err);
      next(err); }
  };

  delete = (req: Request<{ id: string }>, res: Response, next: NextFunction): void => {
    try {
      this.service.delete(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      console.error('Error in delete:', err);
      next(err); }
  };

    getFilterOptions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [designations, politicalLeanings] = await Promise.all([
        this.service.getDesignations(),
        this.service.getPoliticalLeanings(),
      ]);

      res.json({ designations, politicalLeanings });
    } catch (err) {
      console.error('Error in getFilterOptions:', err);
      next(err);
    }
  };
}
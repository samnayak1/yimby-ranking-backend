import { Request, Response, NextFunction } from 'express';
import { CityService } from '../services/CityService';
import {
  CreateCityDto,
  UpdateCityDto,
  UpsertCityRatingDto,
} from '../schemas/city.schema';
import { CityFilters } from '../models';

export class CityController {
  constructor(private readonly service: CityService) { }

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {

      const {
        page = 1,
        limit = 20,
        sortBy = 'name',
        sortOrder = 'asc',
        search,
        country,
        region,
        minPrice,
        maxPrice,
        minScore,
        maxScore,
      } = req.query;

      const filters: CityFilters = {
        page: Number(page),
        limit: Number(limit),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        search: search as string,
        countryCode: country as string,
        region: region as string,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        minScore: minScore ? Number(minScore) : undefined,
        maxScore: maxScore ? Number(maxScore) : undefined,
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
      next(err);
    }
  };

  create = (req: Request<{}, {}, CreateCityDto>, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.create(req.body);
      res.status(201).json({ data });
    } catch (err) {
      console.error('Error in create:', err);
      next(err);
    }
  };

  update = (req: Request<{ id: string }, {}, UpdateCityDto>, res: Response, next: NextFunction): void => {
    try {
      const data = this.service.update(Number(req.params.id), req.body);
      res.json({ data });
    } catch (err) {
      console.error('Error in update:', err);
      next(err);
    }
  };

  delete = (req: Request<{ id: string }>, res: Response, next: NextFunction): void => {
    try {
      this.service.delete(Number(req.params.id));
      res.status(204).end();
    } catch (err) {
      console.error('Error in delete:', err);
      next(err);
    }
  };


  getFilterOptions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [countries, regions] = await Promise.all([
        this.service.getCountries(),
        this.service.getRegions(),
      ]);

      res.json({ countries, regions });
    } catch (err) {
      console.error('Error in getFilterOptions:', err);
      next(err);
    }
  };

  upsertMetrics = (
    req: Request<{ id: string }, {}, UpsertCityRatingDto>,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const data = this.service.upsertMetrics(
        Number(req.params.id),
        req.body,
      );

      res.json({ data });
    } catch (err) {
      console.error('Error in upsertMetrics:', err);
      next(err);
    }
  };
}
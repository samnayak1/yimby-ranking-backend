import { Request, Response, NextFunction } from 'express';
import { CreatorService, ResourceService } from '../services/MediaService';
import { ResourceCategory } from '../models';
import {
  CreateCreatorDto, CreateResourceDto, UpdateCreatorDto, UpdateResourceDto,
} from '../schemas/media.schemas';

type Handler<P = {}, B = {}> = (req: Request<P, {}, B>, res: Response, next: NextFunction) => void;

const wrap = <P, B>(fn: (req: Request<P, {}, B>, res: Response) => unknown | Promise<unknown>): Handler<P, B> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export class CreatorController {
  constructor(private readonly service: CreatorService) {}

  getAll = wrap(async (_req, res) => {
    res.json({ data: await this.service.getAll() });
  });

  create = wrap<{}, CreateCreatorDto>((req, res) => {
    res.status(201).json({ data: this.service.create(req.body) });
  });

  update = wrap<{ id: string }, UpdateCreatorDto>((req, res) => {
    res.json({ data: this.service.update(Number(req.params.id), req.body) });
  });

  delete = wrap<{ id: string }, {}>((req, res) => {
    this.service.delete(Number(req.params.id));
    res.status(204).end();
  });
}

export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  getAll = wrap(async (req, res) => {
    const category = (req.query as { category?: ResourceCategory }).category;
    res.json({ data: await this.service.getAll(category) });
  });

  create = wrap<{}, CreateResourceDto>((req, res) => {
    res.status(201).json({ data: this.service.create(req.body) });
  });

  update = wrap<{ id: string }, UpdateResourceDto>((req, res) => {
    res.json({ data: this.service.update(Number(req.params.id), req.body) });
  });

  delete = wrap<{ id: string }, {}>((req, res) => {
    this.service.delete(Number(req.params.id));
    res.status(204).end();
  });
}

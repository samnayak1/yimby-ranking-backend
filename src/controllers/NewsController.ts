import { Request, Response, NextFunction } from 'express';
import { NewsService } from '../services/NewsService';
import { listNewsQuerySchema, UpdateNewsDto } from '../schemas/news.schemas';

type Handler<P = {}, B = {}> = (req: Request<P, {}, B>, res: Response, next: NextFunction) => void;

const wrap = <P, B>(fn: (req: Request<P, {}, B>, res: Response) => unknown | Promise<unknown>): Handler<P, B> =>
  (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

export class NewsController {
  constructor(private readonly service: NewsService) {}

  // validateQuery has already rejected bad input; parsing again applies the
  // defaults and coercions, since Express doesn't let middleware replace req.query.
  getAll = wrap(async (req, res) => {
    res.json(await this.service.getAll(listNewsQuerySchema.parse(req.query)));
  });

  getAllForAdmin = wrap((req, res) => {
    res.json(this.service.getAllForAdmin(listNewsQuerySchema.parse(req.query)));
  });

  getCountries = wrap(async (_req, res) => {
    res.json({ data: await this.service.getCountries() });
  });

  update = wrap<{ id: string }, UpdateNewsDto>((req, res) => {
    res.json({ data: this.service.setHidden(Number(req.params.id), req.body.hidden) });
  });
}

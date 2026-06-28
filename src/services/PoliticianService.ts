import { IPoliticianRepo } from '../repos/interfaces/IPoliticianRepo';
import { NewPolitician, PoliticianWithRankings } from '../models';
import { Designation, PoliticalLeaning } from '../types';
import { createError } from '../utils/errorHelper';


const DESIGNATIONS = new Set(Object.values(Designation));
const LEANINGS = new Set(Object.values(PoliticalLeaning));

export class PoliticianService {
  constructor(private readonly repo: IPoliticianRepo) {}


  //TODO: paginate
  getAll(): PoliticianWithRankings[] {
    return this.repo.findAll();
  }

  getById(id: number): PoliticianWithRankings {
    const politician = this.repo.findById(id);
    if (!politician) {
      throw createError(404, 'Politician not found');
    }
    return politician;
  }

  create(data: NewPolitician): PoliticianWithRankings {
    if (!data.name?.trim()) {
      throw createError(400, 'Name is required');
    }

    this.validate(data);

    return this.repo.create({
      ...data,
      name: data.name.trim(),
    });
  }

  update(id: number, data: Partial<NewPolitician>): PoliticianWithRankings {
    this.getById(id);

    this.validate(data);

    return this.repo.update(id, data)!;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
  }

  upsertRanking(id: number, year: number, ranking: number): PoliticianWithRankings {
    this.getById(id);

    if (year < 2000 || year > new Date().getFullYear() + 1) {
      throw createError(400, 'Invalid year');
    }

    if (ranking < 1 || ranking > 10) {
      throw createError(400, 'Ranking must be between 1 and 10');
    }

    return this.repo.upsertRanking(id, year, ranking)!;
  }

  private validate(data: Partial<NewPolitician>): void {
    if (data.designation && !DESIGNATIONS.has(data.designation as Designation)) {
      throw createError(
        400,
        `Invalid designation. Valid: ${Object.values(Designation).join(', ')}`
      );
    }

    if (data.politicalLeaning && !LEANINGS.has(data.politicalLeaning as PoliticalLeaning)) {
      throw createError(
        400,
        `Invalid political leaning. Valid: ${Object.values(PoliticalLeaning).join(', ')}`
      );
    }
  }
}
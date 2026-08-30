import { IPoliticianRepo } from '../repos/interfaces/IPoliticianRepo';
import { NewPolitician, PaginatedResponse, PoliticianFilters, PoliticianWithRatings } from '../models';
import {options} from './../config/config'
import { createError } from '../utils/errorHelper';
import { cached, invalidate } from '../cache/cache';


const DESIGNATIONS = new Set(Object.values(options.designations));
const LEANINGS = new Set(Object.values(options.politicalLeanings));

export class PoliticianService {
  constructor(private readonly repo: IPoliticianRepo) {}


  async getAll(filters?: PoliticianFilters): Promise<PaginatedResponse<PoliticianWithRatings>> {
    return cached('politicians', 'list', filters, () => this.repo.findAll(filters));
  }

  getById(id: number): PoliticianWithRatings {
    const politician = this.repo.findById(id);
    if (!politician) {
      throw createError(404, 'Politician not found');
    }
    return politician;
  }

  create(data: NewPolitician): PoliticianWithRatings {
    if (!data.name?.trim()) {
      throw createError(400, 'Name is required');
    }

    this.validate(data);

    const created = this.repo.create({
      ...data,
      name: data.name.trim(),
    });
    this.refresh();
    return created;
  }

  update(id: number, data: Partial<NewPolitician>): PoliticianWithRatings {
    this.getById(id);

    this.validate(data);

    const updated = this.repo.update(id, data)!;
    this.refresh();
    return updated;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
    this.refresh();
  }

  upsertRating(id: number, year: number, rating: number): PoliticianWithRatings {
    this.getById(id);

    if (year < 2000 || year > new Date().getFullYear() + 1) {
      throw createError(400, 'Invalid year');
    }

    if (rating < 1 || rating > 10) {
      throw createError(400, 'Rating must be between 1 and 10');
    }

    const saved = this.repo.upsertRating(id, year, rating)!;
    this.refresh();
    return saved;
  }

  async getDesignations(): Promise<string[]> {
    return cached('politicians', 'designations', null, () => this.repo.getDesignations());
  }

  async getPoliticalLeanings(): Promise<string[]> {
    return cached('politicians', 'leanings', null, () => this.repo.getPoliticalLeanings());
  }

  /**
   * The list shape the table requests unprompted, plus the filter dropdowns.
   * Re-warmed after every write so the next reader hits.
   */
  private refresh(): void {
    void invalidate('politicians', [
      () => this.getAll({ page: 1, limit: 20 }),
      () => this.getDesignations(),
      () => this.getPoliticalLeanings(),
    ]);
  }

  private validate(data: Partial<NewPolitician>): void {
    if (data.designation && !DESIGNATIONS.has(data.designation)) {
      throw createError(
        400,
        `Invalid designation. Valid: ${Object.values(options.designations).join(', ')}`
      );
    }

    if (data.politicalLeaning && !LEANINGS.has(data.politicalLeaning)) {
      throw createError(
        400,
        `Invalid political leaning. Valid: ${Object.values(options.politicalLeanings).join(', ')}`
      );
    }
  }
}
import { IPoliticianRepo } from '../repos/interfaces/IPoliticianRepo';
import { NewPolitician, PaginatedResponse, PoliticianFilters, PoliticianWithRatings } from '../models';
import {options} from './../config/config'
import { createError } from '../utils/errorHelper';


const DESIGNATIONS = new Set(Object.values(options.designations));
const LEANINGS = new Set(Object.values(options.politicalLeanings));

export class PoliticianService {
  constructor(private readonly repo: IPoliticianRepo) {}


  async getAll(filters?: PoliticianFilters): Promise<PaginatedResponse<PoliticianWithRatings>> {
    return this.repo.findAll(filters);
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

    return this.repo.create({
      ...data,
      name: data.name.trim(),
    });
  }

  update(id: number, data: Partial<NewPolitician>): PoliticianWithRatings {
    this.getById(id);

    this.validate(data);

    return this.repo.update(id, data)!;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
  }

  upsertRating(id: number, year: number, rating: number): PoliticianWithRatings {
    this.getById(id);

    if (year < 2000 || year > new Date().getFullYear() + 1) {
      throw createError(400, 'Invalid year');
    }

    if (rating < 1 || rating > 10) {
      throw createError(400, 'Rating must be between 1 and 10');
    }

    return this.repo.upsertRating(id, year, rating)!;
  }

  async getDesignations(): Promise<string[]> {
    return this.repo.getDesignations();
  }

  async getPoliticalLeanings(): Promise<string[]> {
    return this.repo.getPoliticalLeanings();
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
import { IPoliticianRepo } from '../repos/interfaces/IPoliticianRepo';
import { PaginatedResponse, PoliticianFilters, PoliticianInput, PoliticianWithItems } from '../models';
import {options} from './../config/config'
import { createError } from '../utils/errorHelper';
import { cached, invalidate } from '../cache/cache';


const DESIGNATIONS = new Set(Object.values(options.designations));
const LEANINGS = new Set(Object.values(options.politicalLeanings));

export class PoliticianService {
  constructor(private readonly repo: IPoliticianRepo) {}


  async getAll(filters?: PoliticianFilters): Promise<PaginatedResponse<PoliticianWithItems>> {
    return cached('politicians', 'list', filters, () => this.repo.findAll(filters));
  }

  getById(id: number): PoliticianWithItems {
    const politician = this.repo.findById(id);
    if (!politician) {
      throw createError(404, 'Politician not found');
    }
    return politician;
  }

  create(data: PoliticianInput): PoliticianWithItems {
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

  update(id: number, data: Partial<PoliticianInput>): PoliticianWithItems {
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

  private validate(data: Partial<PoliticianInput>): void {
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
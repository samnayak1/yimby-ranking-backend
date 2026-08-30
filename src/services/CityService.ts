import { ICityRepo } from '../repos/interfaces/ICityRepo';
import { NewCity, CityFilters, PaginatedResponse, UpsertCityMetrics, CityWithRatings } from '../models/index';
import { createError } from '../utils/errorHelper';
import { CityMapPoint } from '../types';
import { cached, invalidate } from '../cache/cache';

export class CityService {
  constructor(private readonly repo: ICityRepo) { }

  async getAll(filters?: CityFilters): Promise<PaginatedResponse<CityWithRatings>> {
    return cached('cities', 'list', filters, () => this.repo.findAll(filters));
  }

  getById(id: number): CityWithRatings {
    const city = this.repo.findById(id);
    if (!city) throw Object.assign(new Error('City not found'), { status: 404 });
    return city;
  }
  getMapData(): CityMapPoint[] {
  return this.repo.findMapData();
}

  create(data: NewCity): CityWithRatings {


    if (data.lat != null && (data.lat < -90 || data.lat > 90)) {
      throw createError(400, "Latitude must be between -90 and 90");
    }
     if (data.lng != null && (data.lng < -180 || data.lng > 180)) {
      throw createError(400, "Longitutse must be between -180 and 180");
    }

    const created = this.repo.create({ ...data, name: data.name.trim(), countryCode: data.countryCode });
    this.refresh();
    return created;
  }

  update(id: number, data: Partial<NewCity>): CityWithRatings {
    this.getById(id);
    if (data.medianHousePrice != null && data.medianHousePrice < 0) {
      throw createError(400, "Median housing price must be a postivie -90 and 90");
    }
    
    if (data.lat != null && (data.lat < -90 || data.lat > 90)) {
      throw createError(400, "Latitude must be between -90 and 90");
    }
     if (data.lng != null && (data.lng < -180 || data.lng > 180)) {
      throw createError(400, "Longitutse must be between -180 and 180");
    }
    const updated = this.repo.update(id, data)!;
    this.refresh();
    return updated;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
    this.refresh();
  }
  
  async getCountries(): Promise<string[]> {
    return cached('cities', 'countries', null, () => this.repo.getCountries());
  }

  async getRegions(): Promise<string[]> {
    return cached('cities', 'regions', null, () => this.repo.getRegions());
  }

  //refresh cache after every write
  private refresh(): void {
    void invalidate('cities', [
      () => this.getAll({ page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' }),
      () => this.getAll({ page: 1, limit: 100, sortBy: 'name', sortOrder: 'asc' }),
      () => this.getCountries(),
      () => this.getRegions(),
    ]);
  }

  

  upsertMetrics(
  id: number,
  metrics: UpsertCityMetrics
): CityWithRatings {
  this.getById(id);

  const currentYear = new Date().getFullYear();

  if (metrics.year && (metrics.year < 2000 || metrics.year > currentYear + 1)) {
    throw Object.assign(new Error("Invalid year"), { status: 400 });
  }

  if (metrics.rating && (metrics.rating < 1 || metrics.rating > 10 )) {
    throw Object.assign(
      new Error("rating score must be between 1 and 10"),
      { status: 400 }
    );
  }

  if (
    metrics.averagePermitDays != null &&
    metrics.averagePermitDays < 0
  ) {
    throw Object.assign(
      new Error("Average permit days cannot be negative"),
      { status: 400 }
    );
  }

  if (
    metrics.permitsIssued != null &&
    metrics.permitsIssued < 0
  ) {
    throw Object.assign(
      new Error("Permits issued cannot be negative"),
      { status: 400 }
    );
  }

  if (
    metrics.housingStarts != null &&
    metrics.housingStarts < 0
  ) {
    throw Object.assign(
      new Error("Housing starts cannot be negative"),
      { status: 400 }
    );
  }

  if (
    metrics.homesCompleted != null &&
    metrics.homesCompleted < 0
  ) {
    throw Object.assign(
      new Error("Homes completed cannot be negative"),
      { status: 400 }
    );
  }

  if (
    metrics.population != null &&
    metrics.population < 0
  ) {
    throw Object.assign(
      new Error("Population cannot be negative"),
      { status: 400 }
    );
  }

  if (
    metrics.permitsPer1000Residents != null &&
    metrics.permitsPer1000Residents < 0
  ) {
    throw Object.assign(
      new Error("Permits per 1,000 residents cannot be negative"),
      { status: 400 }
    );
  }

  const saved = this.repo.upsertMetrics(id, metrics)!;
  this.refresh();
  return saved;
}


}
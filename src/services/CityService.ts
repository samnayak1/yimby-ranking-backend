import { ICityRepo } from '../repos/interfaces/ICityRepo';
import { NewCity, CityFilters, PaginatedResponse, UpsertCityMetrics, CityWithRatings } from '../models/index';
import { createError } from '../utils/errorHelper';
import { CityMapPoint } from '../types';

export class CityService {
  constructor(private readonly repo: ICityRepo) { }

  async getAll(filters?: CityFilters): Promise<PaginatedResponse<CityWithRatings>> {
    return this.repo.findAll(filters);
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

    return this.repo.create({ ...data, name: data.name.trim(), countryCode: data.countryCode });
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
    return this.repo.update(id, data)!;
  }

  delete(id: number): void {
    this.getById(id);
    this.repo.delete(id);
  }
  
  async getCountries(): Promise<string[]> {
    return this.repo.getCountries();
  }

  async getRegions(): Promise<string[]> {
    return this.repo.getRegions();
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

  return this.repo.upsertMetrics(id, metrics)!;
}


}
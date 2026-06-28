import { ICityRepo } from '../repos/interfaces/ICityRepo';
import { NewCity, CityWithRankings } from '../models/index';
import { createError } from '../utils/errorHelper';

export class CityService {
  constructor(private readonly repo: ICityRepo) { }

  //TODO: paginate
  getAll(): CityWithRankings[] {
    return this.repo.findAll();
  }

  getById(id: number): CityWithRankings {
    const city = this.repo.findById(id);
    if (!city) throw Object.assign(new Error('City not found'), { status: 404 });
    return city;
  }

  create(data: NewCity): CityWithRankings {


    if (data.lat != null && (data.lat < -90 || data.lat > 90)) {
      throw createError(400, "Latitude must be between -90 and 90");
    }
     if (data.lng != null && (data.lng < -180 || data.lng > 180)) {
      throw createError(400, "Longitutse must be between -180 and 180");
    }
    return this.repo.create({ ...data, name: data.name.trim(), country: data.country.trim() });
  }

  update(id: number, data: Partial<NewCity>): CityWithRankings {
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

  upsertRanking(id: number, year: number, ranking: number): CityWithRankings {
    this.getById(id);
    if (year < 2000 || year > new Date().getFullYear() + 1) {
      throw Object.assign(new Error('Invalid year'), { status: 400 });
    }
    if (ranking < 1 || ranking > 10) {
      throw Object.assign(new Error('Ranking must be between 1 and 10'), { status: 400 });
    }
    return this.repo.upsertRanking(id, year, ranking)!;
  }
}
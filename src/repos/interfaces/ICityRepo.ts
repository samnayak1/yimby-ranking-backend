import { CityFilters, CityWithRatings, NewCity, PaginatedResponse, UpsertCityMetrics } from "../../models";
import { CityMapPoint } from "../../types";

export interface ICityRepo {
  findMapData(): CityMapPoint[];
  findAll(filters?: CityFilters): Promise<PaginatedResponse<CityWithRatings>>;
  findById(id: number): CityWithRatings | null;
  create(data: NewCity): CityWithRatings;
  update(id: number, data: Partial<NewCity>): CityWithRatings | null;
  delete(id: number): boolean;
  getCountries(): Promise<string[]>;
  getRegions(): Promise<string[]>;
  upsertMetrics(
    cityId: number,
    metrics: UpsertCityMetrics
  ): CityWithRatings | null
}
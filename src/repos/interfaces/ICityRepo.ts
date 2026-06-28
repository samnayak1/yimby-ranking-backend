import { CityWithRankings, NewCity } from "../../models";

export interface ICityRepo {
  findAll(): CityWithRankings[];
  findById(id: number): CityWithRankings | null;
  create(data: NewCity): CityWithRankings;
  update(id: number, data: Partial<NewCity>): CityWithRankings | null;
  delete(id: number): boolean;
  upsertRanking(cityId: number, year: number, ranking: number): CityWithRankings | null;
}
import { NewPolitician, PoliticianWithRankings } from '../../models/index';

export interface IPoliticianRepo {
  findAll(): PoliticianWithRankings[];
  findById(id: number): PoliticianWithRankings | null;
  create(data: NewPolitician): PoliticianWithRankings;
  update(id: number, data: Partial<NewPolitician>): PoliticianWithRankings | null;
  delete(id: number): boolean;
  upsertRanking(politicianId: number, year: number, ranking: number): PoliticianWithRankings | null;
}
import { NewPolitician, PaginatedResponse, PoliticianFilters, PoliticianWithRankings } from '../../models/index';

export interface IPoliticianRepo {
 findAll(filters?: PoliticianFilters): Promise<PaginatedResponse<PoliticianWithRankings>>;
  findById(id: number): PoliticianWithRankings | null;
  create(data: NewPolitician): PoliticianWithRankings;
  update(id: number, data: Partial<NewPolitician>): PoliticianWithRankings | null;
  delete(id: number): boolean;
  getDesignations(): Promise<string[]>
  getPoliticalLeanings(): Promise<string[]> 
  upsertRanking(politicianId: number, year: number, ranking: number): PoliticianWithRankings | null;
}
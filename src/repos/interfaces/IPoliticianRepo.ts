import { NewPolitician, PaginatedResponse, PoliticianFilters,  PoliticianWithRatings } from '../../models/index';

export interface IPoliticianRepo {
 findAll(filters?: PoliticianFilters): Promise<PaginatedResponse<PoliticianWithRatings>>;
  findById(id: number): PoliticianWithRatings | null;
  create(data: NewPolitician): PoliticianWithRatings;
  update(id: number, data: Partial<NewPolitician>): PoliticianWithRatings | null;
  delete(id: number): boolean;
  getDesignations(): Promise<string[]>
  getPoliticalLeanings(): Promise<string[]> 
  upsertRating(politicianId: number, year: number, rating: number): PoliticianWithRatings | null;
}
import { PaginatedResponse, PoliticianFilters, PoliticianInput, PoliticianWithItems } from '../../models/index';

export interface IPoliticianRepo {
 findAll(filters?: PoliticianFilters): Promise<PaginatedResponse<PoliticianWithItems>>;
  findById(id: number): PoliticianWithItems | null;
  create(data: PoliticianInput): PoliticianWithItems;
  update(id: number, data: Partial<PoliticianInput>): PoliticianWithItems | null;
  delete(id: number): boolean;
  getDesignations(): Promise<string[]>
  getPoliticalLeanings(): Promise<string[]> 
}
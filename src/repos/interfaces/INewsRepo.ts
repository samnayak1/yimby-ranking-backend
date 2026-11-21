import { NewsArticle, NewsFilters, PaginatedResponse } from '../../models';

export interface INewsRepo {
  findAll(filters?: NewsFilters): PaginatedResponse<NewsArticle>;
  findById(id: number): NewsArticle | null;
  setHidden(id: number, hidden: boolean): NewsArticle | null;
  getCountries(): string[];
}

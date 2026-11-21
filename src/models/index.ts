import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { politicianItems, politicians } from "./politicians.models";
import { cities, cityRatings } from "./cities.models";
import { creators, resources } from "./media.models";
import { newsArticles, NewsOutcome } from "./news.models";
import { PaginationParams } from "../types";
import { PoliticianStatus } from "../types/enums";
export * from './cities.models'
export * from './politicians.models'
export * from './media.models'
export * from './news.models'

export type Politician       = InferSelectModel<typeof politicians>;
export type NewPolitician    = InferInsertModel<typeof politicians>;
export type PoliticianItemRow   = InferSelectModel<typeof politicianItems>;
 
export type City          = InferSelectModel<typeof cities>;
export type NewCity       = InferInsertModel<typeof cities>;
export type CityRating    = InferSelectModel<typeof cityRatings>;
export type NewCityRating = InferInsertModel<typeof cityRatings>;

export type Creator     = InferSelectModel<typeof creators>;
export type NewCreator  = InferInsertModel<typeof creators>;
export type Resource    = InferSelectModel<typeof resources>;
export type NewResource = InferInsertModel<typeof resources>;
export type NewsArticle = InferSelectModel<typeof newsArticles>;

export interface NewsFilters extends PaginationParams {
  outcome?: NewsOutcome;
  countryCode?: string;
  // Admin view: include articles an admin has hidden.
  includeHidden?: boolean;
}
 

 
export type PoliticianItem = { text: string; url: string | null };

// The lists travel with the politician: quotes, and the good and the bad.
export interface PoliticianLists {
  quotes: PoliticianItem[];
  good:   PoliticianItem[];
  bad:    PoliticianItem[];
}

// What create/update accept: each list is optional, and replaces the stored
// one when present.
export type PoliticianInput = NewPolitician & Partial<Record<keyof PoliticianLists, { text: string; url?: string | null }[]>>;

export interface UpsertCityMetrics {
  year: number;

  permitsIssued?: number;
  permitsPer1000Residents?: number;
  housingStarts?: number;
  homesCompleted?: number;
  averagePermitDays?: number;
  population?: number;
  medianHousingPrice?: number;
  vacancyRate?: number;
}
 
export type PoliticianWithItems   = Politician & PoliticianLists;
export type CityWithRatings       = City       & { ratings: UpsertCityMetrics[] };

//TODO: Move these to a separate file
export interface CityFilters extends PaginationParams {
  search?: string;
  countryCode?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  
}


export interface PoliticianFilters extends PaginationParams {
  search?: string;
  designation?: string;
  politicalLeaning?: string;
  nationalityCode?: string;
  status?: PoliticianStatus;
  cityId?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters?: Record<string, any>;
}


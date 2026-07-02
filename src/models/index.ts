import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { politicianRankings, politicians } from "./politicians.models";
import { cities, cityRankings } from "./cities.models";
import { PaginationParams } from "../types";
export * from './cities.models'
export * from './politicians.models'

export type Politician       = InferSelectModel<typeof politicians>;
export type NewPolitician    = InferInsertModel<typeof politicians>;
export type PoliticianRanking    = InferSelectModel<typeof politicianRankings>;
export type NewPoliticianRanking = InferInsertModel<typeof politicianRankings>;
 
export type City          = InferSelectModel<typeof cities>;
export type NewCity       = InferInsertModel<typeof cities>;
export type CityRanking    = InferSelectModel<typeof cityRankings>;
export type NewCityRanking = InferInsertModel<typeof cityRankings>;
 

 
export type Ranking = { year: number; ranking: number };
 
export type PoliticianWithRankings = Politician & { rankings: Ranking[] };
export type CityWithRankings       = City       & { rankings: Ranking[] };

//TODO: Move these to a separate file
export interface CityFilters extends PaginationParams {
  search?: string;
  countryCode?: string;
  region?: string;
  minPrice?: number;
  maxPrice?: number;
  minScore?: number;
  maxScore?: number;
}


export interface PoliticianFilters extends PaginationParams {
  search?: string;
  designation?: string;
  politicalLeaning?: string;
  nationalityCode?: string;
  isInOffice?: boolean;
  minScore?: number;
  maxScore?: number;
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


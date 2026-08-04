import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { politicianRatings, politicians } from "./politicians.models";
import { cities, cityRatings } from "./cities.models";
import { PaginationParams } from "../types";
export * from './cities.models'
export * from './politicians.models'

export type Politician       = InferSelectModel<typeof politicians>;
export type NewPolitician    = InferInsertModel<typeof politicians>;
export type PoliticianRating    = InferSelectModel<typeof politicianRatings>;
export type NewPoliticianRating = InferInsertModel<typeof politicianRatings>;
 
export type City          = InferSelectModel<typeof cities>;
export type NewCity       = InferInsertModel<typeof cities>;
export type CityRating    = InferSelectModel<typeof cityRatings>;
export type NewCityRating = InferInsertModel<typeof cityRatings>;
 

 
export type Rating = { year: number; rating: number };

export interface UpsertCityMetrics {
  year: number;
  rating?: number;

  permitsIssued?: number;
  permitsPer1000Residents?: number;
  housingStarts?: number;
  homesCompleted?: number;
  averagePermitDays?: number;
  population?: number;
}
 
export type PoliticianWithRatings = Politician & { ratings: Rating[] };
export type CityWithRatings       = City       & { ratings: UpsertCityMetrics[] };

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


import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { politicianRankings, politicians } from "./politicians.models";
import { cities, cityRankings } from "./cities.models";

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
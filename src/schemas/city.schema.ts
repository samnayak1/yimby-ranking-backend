import { z } from 'zod';
import { options } from '../config/config';

const CURRENCIES = options.currencies;

export const createCitySchema = z.object({
  name:             z.string().trim().min(1, 'Name is required'),
  countryCode:          z.string().trim().min(1, 'Country is required'),
  region:           z.string().trim().optional(),
  medianHousePrice: z.number().nonnegative().optional(),
  currency:         z.enum(CURRENCIES).default('USD'),
  notes:            z.string().trim().optional(),
  rating :           z.number().min(0).max(10),
  lat:              z.number().min(-90).max(90).optional(),
  lng:              z.number().min(-180).max(180).optional(),
});

export const updateCitySchema = createCitySchema.partial();

export const upsertCityRatingSchema = z.object({
  year: z.number().int().min(2000).max(new Date().getFullYear() + 1),

  rating: z.number().min(1).max(10),

  permitsIssued: z.number().int().nonnegative().optional(),

  permitsPer1000Residents: z.number().nonnegative().optional(),

  housingStarts: z.number().int().nonnegative().optional(),

  homesCompleted: z.number().int().nonnegative().optional(),

  averagePermitDays: z.number().int().nonnegative().optional(),

  population: z.number().int().positive().optional(),

  medianHousingPrice: z.number().nonnegative().optional(),
});

export const getCitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  sortBy: z.enum([
  "name",
  "countryCode",
  "region",
  "medianHousePrice",
  "rating",
]).default("rating"),

  sortOrder: z.enum(["asc", "desc"]).default("asc"),

  search: z.string().trim().optional(),
  countryCode: z.string().length(2).optional(),
  region: z.string().optional(),

  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),

  minScore: z.coerce.number().min(1).max(10).optional(),
  maxScore: z.coerce.number().min(1).max(10).optional(),
});

export type CreateCityDto        = z.infer<typeof createCitySchema>;
export type UpdateCityDto        = z.infer<typeof updateCitySchema>;
export type UpsertCityRatingDto = z.infer<typeof upsertCityRatingSchema>;
export type GetCitiesQuery = z.infer<typeof getCitiesQuerySchema>;
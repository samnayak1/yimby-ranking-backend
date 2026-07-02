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
  lat:              z.number().min(-90).max(90).optional(),
  lng:              z.number().min(-180).max(180).optional(),
});

export const updateCitySchema = createCitySchema.partial();

export const upsertCityRankingSchema = z.object({
  year:    z.number().int().min(2000).max(new Date().getFullYear() + 1),
  ranking: z.number().int().min(1).max(10),
});

export type CreateCityDto        = z.infer<typeof createCitySchema>;
export type UpdateCityDto        = z.infer<typeof updateCitySchema>;
export type UpsertCityRankingDto = z.infer<typeof upsertCityRankingSchema>;
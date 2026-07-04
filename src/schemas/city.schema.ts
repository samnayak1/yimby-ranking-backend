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

export const upsertCityRatingSchema = z.object({
  year: z.number().int().min(2000).max(new Date().getFullYear() + 1),

  rating: z.number().int().positive(),

  permitsIssued: z.number().int().nonnegative().optional(),

  permitsPer1000Residents: z.number().nonnegative().optional(),

  housingStarts: z.number().int().nonnegative().optional(),

  homesCompleted: z.number().int().nonnegative().optional(),

  averagePermitDays: z.number().int().nonnegative().optional(),

  population: z.number().int().positive().optional(),
});

export type CreateCityDto        = z.infer<typeof createCitySchema>;
export type UpdateCityDto        = z.infer<typeof updateCitySchema>;
export type UpsertCityRatingDto = z.infer<typeof upsertCityRatingSchema>;
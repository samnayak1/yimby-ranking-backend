import { z } from 'zod';
import { options } from '../config/config';



const DESIGNATIONS = options.designations;

const LEANINGS = options.politicalLeanings;

export const createPoliticianSchema = z.object({
  name:             z.string().trim().min(1, 'Name is required'),
  designation:      z.enum(DESIGNATIONS).optional(),
  isInOffice:       z.number().int().min(0).max(1).default(1),
  nationalityCode:      z.string().trim(),
  politicalLeaning: z.enum(LEANINGS).optional(),
  notes:            z.string().trim().optional(),
});

export const updatePoliticianSchema = createPoliticianSchema.partial();

export const upsertPoliticianRankingSchema = z.object({
  year:    z.number().int().min(2000).max(new Date().getFullYear() + 1),
  ranking: z.number().int().min(1).max(10),
});

export type CreatePoliticianDto        = z.infer<typeof createPoliticianSchema>;
export type UpdatePoliticianDto        = z.infer<typeof updatePoliticianSchema>;
export type UpsertPoliticianRankingDto = z.infer<typeof upsertPoliticianRankingSchema>;
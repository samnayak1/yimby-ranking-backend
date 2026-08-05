import { z } from 'zod';
import { options } from '../config/config';
import { PoliticianStatus } from '../types/enums';



const DESIGNATIONS = options.designations;

const LEANINGS = options.politicalLeanings;

export const createPoliticianSchema = z.object({
  name:             z.string().trim().min(1, 'Name is required'),
  designation:      z.enum(DESIGNATIONS).optional(),
  status:       z.enum(PoliticianStatus).optional(),
  nationalityCode:      z.string().trim(),
  rating :              z.number().min(0).max(10),
  politicalLeaning: z.enum(LEANINGS).optional(),
  notes:            z.string().trim().optional(),
});

export const updatePoliticianSchema = createPoliticianSchema.partial();

export const upsertPoliticianRatingSchema = z.object({
  year:    z.number().int().min(2000).max(new Date().getFullYear() + 1),
  rating: z.number().min(1).max(10),
});

export const getPoliticiansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
sortBy: z.enum([
  "name",
  "designation",
  "politicalLeaning",
  "nationalityCode",
  "rating",
]).default("name"),

  sortOrder: z.enum(["asc", "desc"]).default("asc"),

  search: z.string().trim().optional(),
  designation: z.string().optional(),
  politicalLeaning: z.string().optional(),
  nationalityCode: z.string().length(2).optional(),

  status: z.enum(PoliticianStatus).optional(),

  minScore: z.coerce.number().min(1).max(10).optional(),
  maxScore: z.coerce.number().min(1).max(10).optional(),

  cityId: z.coerce.number().int().positive().optional(),
});

export type CreatePoliticianDto        = z.infer<typeof createPoliticianSchema>;
export type UpdatePoliticianDto        = z.infer<typeof updatePoliticianSchema>;
export type UpsertPoliticianRatingDto = z.infer<typeof upsertPoliticianRatingSchema>;
export type GetPoliticiansQuery = z.infer<typeof getPoliticiansQuerySchema>;
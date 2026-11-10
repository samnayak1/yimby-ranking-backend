import { z } from 'zod';
import { options } from '../config/config';
import { PoliticianStatus } from '../types/enums';
import { COLOR_CODES } from '../models/politicians.models';
import { blankToNull, httpUrl } from './media.schemas';



const DESIGNATIONS = options.designations;

const LEANINGS = options.politicalLeanings;

const itemSchema = z.object({
  text: z.string().trim().min(1, 'Text is required').max(2000),
  url:  z.preprocess(blankToNull, httpUrl.nullable().optional()),
});

export const createPoliticianSchema = z.object({
  name:             z.string().trim().min(1, 'Name is required'),
  designation:      z.enum(DESIGNATIONS).optional(),
  status:       z.enum(PoliticianStatus).optional(),
  nationalityCode:      z.string().trim(),
  colorCode:        z.enum(COLOR_CODES).nullable().optional(),
  politicalLeaning: z.enum(LEANINGS).optional(),
  notes:            z.string().trim().optional(),
  // Each list replaces the stored one when sent; leave it out to keep it.
  quotes:           z.array(itemSchema).max(50).optional(),
  good:             z.array(itemSchema).max(50).optional(),
  bad:              z.array(itemSchema).max(50).optional(),
});

export const updatePoliticianSchema = createPoliticianSchema.partial();

export const getPoliticiansQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
sortBy: z.enum([
  "name",
  "designation",
  "politicalLeaning",
  "nationalityCode",
  "colorCode",
]).default("name"),

  sortOrder: z.enum(["asc", "desc"]).default("asc"),

  search: z.string().trim().optional(),
  designation: z.string().optional(),
  politicalLeaning: z.string().optional(),
  nationalityCode: z.string().length(2).optional(),

  status: z.enum(PoliticianStatus).optional(),

  cityId: z.coerce.number().int().positive().optional(),
});

export type CreatePoliticianDto        = z.infer<typeof createPoliticianSchema>;
export type UpdatePoliticianDto        = z.infer<typeof updatePoliticianSchema>;
export type PoliticianItemDto          = z.infer<typeof itemSchema>;
export type GetPoliticiansQuery = z.infer<typeof getPoliticiansQuerySchema>;
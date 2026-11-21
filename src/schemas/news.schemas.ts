import { z } from 'zod';
import { NEWS_OUTCOMES } from '../models/news.models';

export const listNewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  outcome: z.enum(NEWS_OUTCOMES).optional(),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Use a two-letter country code, e.g. US')
    .optional(),
});

export const updateNewsSchema = z.object({
  hidden: z.boolean(),
});

export type ListNewsQuery = z.infer<typeof listNewsQuerySchema>;
export type UpdateNewsDto = z.infer<typeof updateNewsSchema>;

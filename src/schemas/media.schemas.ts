import { z } from 'zod';
import { CREATOR_PLATFORMS, CREATOR_TAGS, RESOURCE_CATEGORIES } from '../models/media.models';

/**
 * Every URL here is rendered as a clickable link for all visitors, so only
 * http(s) with a real domain is accepted. Anything else — `javascript:`,
 * `data:` — would let whoever controls an admin token run script in visitors'
 * browsers.
 */
const httpUrl = z
  .string()
  .trim()
  .max(500, 'URL is too long')
  .pipe(
    z.url({
      protocol: /^https?$/,
      hostname: z.regexes.domain,
      message: 'Must be a full http(s) link, e.g. https://example.com',
    }),
  );

// Forms send "" for a cleared field. Treat that as "remove the value" (null),
// while a missing key still means "leave unchanged" on a PATCH.
const blankToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);

const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.string().trim().max(max, `Must be ${max} characters or fewer`).nullable().optional());

const sortOrder = z.number().int().min(-1000).max(1000).optional();

export const createCreatorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  description: optionalText(500),
  platform: z.enum(CREATOR_PLATFORMS),
  url: httpUrl,
  // Duplicates collapse rather than fail: picking a tag twice isn't an error.
  tags: z
    .array(z.enum(CREATOR_TAGS))
    .transform(tags => [...new Set(tags)])
    .optional(),
  // Optional. Two-letter ISO country code; lower case is accepted and normalised.
  nationalityCode: z.preprocess(
    v => (typeof v === 'string' ? (v.trim() === '' ? null : v.trim().toUpperCase()) : v),
    z.string().regex(/^[A-Z]{2}$/, 'Use a two-letter country code, e.g. US').nullable().optional(),
  ),
  sortOrder,
});

export const updateCreatorSchema = createCreatorSchema.partial();

export const createResourceSchema = z.object({
  category: z.enum(RESOURCE_CATEGORIES),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  url: httpUrl,
  description: optionalText(500),
  source: optionalText(120),
  publishedOn: z.preprocess(
    blankToNull,
    z
      .string()
      .trim()
      .regex(/^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/, 'Use YYYY, YYYY-MM or YYYY-MM-DD')
      .nullable()
      .optional(),
  ),
  sortOrder,
});

export const updateResourceSchema = createResourceSchema.partial();

export const listResourcesQuerySchema = z.object({
  category: z.enum(RESOURCE_CATEGORIES).optional(),
});

export type CreateCreatorDto = z.infer<typeof createCreatorSchema>;
export type UpdateCreatorDto = z.infer<typeof updateCreatorSchema>;
export type CreateResourceDto = z.infer<typeof createResourceSchema>;
export type UpdateResourceDto = z.infer<typeof updateResourceSchema>;

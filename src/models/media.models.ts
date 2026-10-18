import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const RESOURCE_CATEGORIES = ["website", "article", "study"] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

export const CREATOR_PLATFORMS = ["youtube", "x", "instagram", "bluesky", "website"] as const;
export type CreatorPlatform = (typeof CREATOR_PLATFORMS)[number];

// What a creator covers. Stored as a JSON array, so adding a topic here needs
// no migration.
export const CREATOR_TAGS = ["transit", "urbanism", "econ", "policy"] as const;
export type CreatorTag = (typeof CREATOR_TAGS)[number];

// Pro-housing creators listed on the Media tab, one row per person or channel.
export const creators = sqliteTable(
  "creators",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    // Each creator is listed under the one account they're best known for.
    platform: text("platform", { enum: CREATOR_PLATFORMS }).notNull(),
    url: text("url").notNull(),
    tags: text("tags", { mode: "json" }).$type<CreatorTag[]>().notNull().default(sql`'[]'`),
    // ISO 3166-1 alpha-2, e.g. "US" — same format as politicians.nationality_code.
    nationalityCode: text("nationality_code"),
    // Lower sorts first; ties fall back to name.
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_creators_sort").on(t.sortOrder)]
);

// Links on the Media tab: websites (games, maps), news articles and studies.
export const resources = sqliteTable(
  "resources",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    category: text("category", { enum: RESOURCE_CATEGORIES }).notNull(),
    title: text("title").notNull(),
    url: text("url").notNull(),
    description: text("description"),
    // Publisher, outlet, journal or authors.
    source: text("source"),
    // YYYY, YYYY-MM or YYYY-MM-DD; studies often only have a year.
    publishedOn: text("published_on"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (t) => [index("idx_resources_category").on(t.category, t.sortOrder)]
);

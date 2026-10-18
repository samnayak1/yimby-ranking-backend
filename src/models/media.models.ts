import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const RESOURCE_CATEGORIES = ["website", "article", "study"] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

// Pro-housing creators listed on the Media tab, one row per person or channel.
export const creators = sqliteTable(
  "creators",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    description: text("description"),
    instagramUrl: text("instagram_url"),
    youtubeUrl: text("youtube_url"),
    twitterUrl: text("twitter_url"),
    blueskyUrl: text("bluesky_url"),
    websiteUrl: text("website_url"),
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

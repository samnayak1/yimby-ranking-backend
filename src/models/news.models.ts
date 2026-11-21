import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const NEWS_OUTCOMES = ["WIN", "LOSS", "NEUTRAL"] as const;
export type NewsOutcome = (typeof NEWS_OUTCOMES)[number];

// Articles found by the nightly crawler in yimby-scraper/. The crawler only
// inserts; this schema and its migrations are owned here.
//
// Every article the crawler looks at gets a row, relevant or not, so it never
// pays Gemini to read the same link twice. Only relevant, non-hidden rows are
// shown on the site.
export const newsArticles = sqliteTable(
  "news_articles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    // Normalised by the crawler (no tracking parameters or fragment), which is
    // what makes it usable as the "already seen" key.
    url: text("url").notNull().unique(),
    // Seed name from yimby-scraper/seeds.yaml, e.g. "California YIMBY".
    source: text("source").notNull(),
    title: text("title").notNull(),
    // Written by Gemini; null for articles the pre-filter dropped.
    summary: text("summary"),
    // YYYY-MM-DD when known.
    publishedOn: text("published_on"),
    cityName: text("city_name"),
    // ISO 3166-1 alpha-2, same format as cities.country_code.
    countryCode: text("country_code"),
    outcome: text("outcome", { enum: NEWS_OUTCOMES }),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    relevant: integer("relevant", { mode: "boolean" }).notNull().default(false),
    // Set by an admin to take a bad classification off the site.
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").default(sql`(datetime('now'))`),
  },
  (t) => [
    index("idx_news_visible_date").on(t.relevant, t.hidden, t.publishedOn),
    index("idx_news_country").on(t.countryCode),
    index("idx_news_outcome").on(t.outcome),
  ]
);

// Where the crawler got to on each seed, so the next run carries on from
// there instead of starting over.
export const newsSources = sqliteTable("news_sources", {
  // Seed name from seeds.yaml.
  name: text("name").primaryKey(),
  url: text("url").notNull(),
  // ISO timestamp of the newest item fully processed. Only moves forward when
  // every newer item was handled, so a run cut short (per-run limit, budget,
  // crash) leaves the rest for next time.
  cursor: text("cursor"),
  // Conditional-GET validators: an unchanged feed costs one 304.
  etag: text("etag"),
  lastModified: text("last_modified"),
  lastCrawledAt: text("last_crawled_at"),
  lastError: text("last_error"),
});

export const CRAWL_RUN_STATUSES = ["RUNNING", "OK", "FAILED"] as const;

// One row per crawler run: what it did and what Gemini cost, which is also
// what the monthly budget check adds up.
export const newsCrawlRuns = sqliteTable("news_crawl_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  finishedAt: text("finished_at"),
  status: text("status", { enum: CRAWL_RUN_STATUSES }).notNull().default("RUNNING"),
  candidates: integer("candidates").notNull().default(0),
  relevant: integer("relevant").notNull().default(0),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  error: text("error"),
});

CREATE TABLE `news_articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`url` text NOT NULL,
	`source` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`published_on` text,
	`city_name` text,
	`country_code` text,
	`outcome` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`relevant` integer DEFAULT false NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `news_articles_url_unique` ON `news_articles` (`url`);--> statement-breakpoint
CREATE INDEX `idx_news_visible_date` ON `news_articles` (`relevant`,`hidden`,`published_on`);--> statement-breakpoint
CREATE INDEX `idx_news_country` ON `news_articles` (`country_code`);--> statement-breakpoint
CREATE INDEX `idx_news_outcome` ON `news_articles` (`outcome`);--> statement-breakpoint
CREATE TABLE `news_crawl_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`finished_at` text,
	`status` text DEFAULT 'RUNNING' NOT NULL,
	`candidates` integer DEFAULT 0 NOT NULL,
	`relevant` integer DEFAULT 0 NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `news_sources` (
	`name` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`cursor` text,
	`etag` text,
	`last_modified` text,
	`last_crawled_at` text,
	`last_error` text
);

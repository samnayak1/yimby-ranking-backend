-- Creators move from five optional link columns to a single platform + url.
-- Hand-written in place of drizzle-kit's output, which added NOT NULL columns
-- without a default (fails on any table that already has rows) and dropped the
-- old links. Rebuilding the table keeps every existing creator, mapping each to
-- the first link it has, in this order.
CREATE TABLE `__new_creators` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_creators` (`id`, `name`, `description`, `platform`, `url`, `tags`, `sort_order`, `created_at`, `updated_at`)
SELECT
	`id`,
	`name`,
	`description`,
	CASE
		WHEN `youtube_url`   IS NOT NULL THEN 'youtube'
		WHEN `twitter_url`   IS NOT NULL THEN 'x'
		WHEN `instagram_url` IS NOT NULL THEN 'instagram'
		WHEN `bluesky_url`   IS NOT NULL THEN 'bluesky'
		ELSE 'website'
	END,
	COALESCE(`youtube_url`, `twitter_url`, `instagram_url`, `bluesky_url`, `website_url`),
	'[]',
	`sort_order`,
	`created_at`,
	`updated_at`
FROM `creators`
-- The API never allowed a creator with no link; this only guards the NOT NULL.
WHERE COALESCE(`youtube_url`, `twitter_url`, `instagram_url`, `bluesky_url`, `website_url`) IS NOT NULL;
--> statement-breakpoint
DROP TABLE `creators`;
--> statement-breakpoint
ALTER TABLE `__new_creators` RENAME TO `creators`;
--> statement-breakpoint
CREATE INDEX `idx_creators_sort` ON `creators` (`sort_order`);

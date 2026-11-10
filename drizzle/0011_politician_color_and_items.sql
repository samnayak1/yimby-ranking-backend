CREATE TABLE `politician_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`politician_id` integer NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`url` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`politician_id`) REFERENCES `politicians`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_politician_items_politician` ON `politician_items` (`politician_id`,`kind`,`position`);--> statement-breakpoint
ALTER TABLE `politicians` ADD `color_code` text;--> statement-breakpoint
CREATE INDEX `idx_politicians_color_code` ON `politicians` (`color_code`);--> statement-breakpoint
-- Ratings are replaced by a colour set by hand. Seed it from the current
-- rating so nobody starts blank: 8+ dark green, 5–7 green, 3–4 light red,
-- below 3 dark red (matching the old badge, which went red at 4 and below).
UPDATE `politicians` SET `color_code` = CASE
	WHEN `rating` IS NULL OR `rating` = 0 THEN NULL
	WHEN `rating` >= 8 THEN 'DARK_GREEN'
	WHEN `rating` >= 5 THEN 'GREEN'
	WHEN `rating` >= 3 THEN 'LIGHT_RED'
	ELSE 'DARK_RED'
END;

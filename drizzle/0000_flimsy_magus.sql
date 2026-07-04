CREATE TABLE `politician_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`politician_id` integer NOT NULL,
	`year` integer NOT NULL,
	`rating` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`politician_id`) REFERENCES `politicians`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_politician_year` ON `politician_ratings` (`politician_id`,`year`);--> statement-breakpoint
CREATE TABLE `politicians` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`designation` text,
	`is_in_office` integer DEFAULT 1 NOT NULL,
	`nationality_code` text NOT NULL,
	`political_leaning` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`country_code` text NOT NULL,
	`region` text,
	`rating` integer,
	`median_house_price` real,
	`currency` text DEFAULT 'USD',
	`notes` text,
	`lat` real,
	`lng` real,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `city_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`year` integer NOT NULL,
	`rating` integer NOT NULL,
	`permits_issued` integer,
	`permits_per_1000_residents` real,
	`housing_starts` integer,
	`average_permit_days` integer,
	`homes_completed` integer,
	`population` integer,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_city_year` ON `city_ratings` (`city_id`,`year`);
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_politician_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`politician_id` integer NOT NULL,
	`year` integer NOT NULL,
	`rating` real NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`politician_id`) REFERENCES `politicians`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_politician_ratings`("id", "politician_id", "year", "rating", "created_at") SELECT "id", "politician_id", "year", "rating", "created_at" FROM `politician_ratings`;--> statement-breakpoint
DROP TABLE `politician_ratings`;--> statement-breakpoint
ALTER TABLE `__new_politician_ratings` RENAME TO `politician_ratings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_politician_year` ON `politician_ratings` (`politician_id`,`year`);--> statement-breakpoint
CREATE TABLE `__new_politicians` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`designation` text,
	`is_in_office` integer DEFAULT 1 NOT NULL,
	`nationality_code` text NOT NULL,
	`political_leaning` text,
	`notes` text,
	`rating` real,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_politicians`("id", "name", "designation", "is_in_office", "nationality_code", "political_leaning", "notes", "rating", "created_at", "updated_at") SELECT "id", "name", "designation", "is_in_office", "nationality_code", "political_leaning", "notes", "rating", "created_at", "updated_at" FROM `politicians`;--> statement-breakpoint
DROP TABLE `politicians`;--> statement-breakpoint
ALTER TABLE `__new_politicians` RENAME TO `politicians`;--> statement-breakpoint
CREATE INDEX `idx_politicians_name` ON `politicians` (`name`);--> statement-breakpoint
CREATE INDEX `idx_politicians_rating` ON `politicians` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_politicians_nationality` ON `politicians` (`nationality_code`);--> statement-breakpoint
CREATE INDEX `idx_politicians_designation` ON `politicians` (`designation`);--> statement-breakpoint
CREATE INDEX `idx_politicians_leaning` ON `politicians` (`political_leaning`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_politician_name` ON `politicians` (`name`);--> statement-breakpoint
CREATE TABLE `__new_cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`country_code` text NOT NULL,
	`region` text,
	`rating` real,
	`median_house_price` real,
	`currency` text DEFAULT 'USD',
	`notes` text,
	`lat` real,
	`lng` real,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
INSERT INTO `__new_cities`("id", "name", "country_code", "region", "rating", "median_house_price", "currency", "notes", "lat", "lng", "created_at", "updated_at") SELECT "id", "name", "country_code", "region", "rating", "median_house_price", "currency", "notes", "lat", "lng", "created_at", "updated_at" FROM `cities`;--> statement-breakpoint
DROP TABLE `cities`;--> statement-breakpoint
ALTER TABLE `__new_cities` RENAME TO `cities`;--> statement-breakpoint
CREATE INDEX `idx_cities_name` ON `cities` (`name`);--> statement-breakpoint
CREATE INDEX `idx_cities_country` ON `cities` (`country_code`);--> statement-breakpoint
CREATE INDEX `idx_cities_region` ON `cities` (`region`);--> statement-breakpoint
CREATE INDEX `idx_cities_rating` ON `cities` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_cities_price` ON `cities` (`median_house_price`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_city_name_country` ON `cities` (`name`,`country_code`);--> statement-breakpoint
CREATE TABLE `__new_city_ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`city_id` integer NOT NULL,
	`year` integer NOT NULL,
	`rating` real,
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
INSERT INTO `__new_city_ratings`("id", "city_id", "year", "rating", "permits_issued", "permits_per_1000_residents", "housing_starts", "average_permit_days", "homes_completed", "population", "created_at") SELECT "id", "city_id", "year", "rating", "permits_issued", "permits_per_1000_residents", "housing_starts", "average_permit_days", "homes_completed", "population", "created_at" FROM `city_ratings`;--> statement-breakpoint
DROP TABLE `city_ratings`;--> statement-breakpoint
ALTER TABLE `__new_city_ratings` RENAME TO `city_ratings`;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_city_year` ON `city_ratings` (`city_id`,`year`);
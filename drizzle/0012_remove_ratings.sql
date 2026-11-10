DROP TABLE `politician_ratings`;--> statement-breakpoint
DROP INDEX `idx_politicians_rating`;--> statement-breakpoint
ALTER TABLE `politicians` DROP COLUMN `rating`;--> statement-breakpoint
DROP INDEX `idx_cities_rating`;--> statement-breakpoint
ALTER TABLE `cities` DROP COLUMN `rating`;--> statement-breakpoint
ALTER TABLE `city_ratings` DROP COLUMN `rating`;
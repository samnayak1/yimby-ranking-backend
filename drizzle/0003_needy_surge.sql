CREATE INDEX `idx_politicians_name` ON `politicians` (`name`);--> statement-breakpoint
CREATE INDEX `idx_politicians_rating` ON `politicians` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_politicians_nationality` ON `politicians` (`nationality_code`);--> statement-breakpoint
CREATE INDEX `idx_politicians_designation` ON `politicians` (`designation`);--> statement-breakpoint
CREATE INDEX `idx_politicians_leaning` ON `politicians` (`political_leaning`);--> statement-breakpoint
CREATE INDEX `idx_cities_name` ON `cities` (`name`);--> statement-breakpoint
CREATE INDEX `idx_cities_country` ON `cities` (`country_code`);--> statement-breakpoint
CREATE INDEX `idx_cities_region` ON `cities` (`region`);--> statement-breakpoint
CREATE INDEX `idx_cities_rating` ON `cities` (`rating`);--> statement-breakpoint
CREATE INDEX `idx_cities_price` ON `cities` (`median_house_price`);
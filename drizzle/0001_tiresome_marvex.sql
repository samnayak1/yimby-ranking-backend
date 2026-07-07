CREATE UNIQUE INDEX `uq_politician_name` ON `politicians` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_city_name_country` ON `cities` (`name`,`country_code`);
ALTER TABLE `politicians` ADD `status` text DEFAULT 'INOFFICE' NOT NULL;--> statement-breakpoint
ALTER TABLE `politicians` DROP COLUMN `is_in_office`;
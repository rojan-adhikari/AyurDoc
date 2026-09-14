CREATE TABLE `doctor_directory_overrides` (
	`doctor_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`degree` text,
	`department` text,
	`hours` text,
	`visible` integer DEFAULT true NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `facility_inventory` (
	`item_key` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`total_count` integer NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_facility_inventory_category` ON `facility_inventory` (`category`);--> statement-breakpoint
PRAGMA optimize;

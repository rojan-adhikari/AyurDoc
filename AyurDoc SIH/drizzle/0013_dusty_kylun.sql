CREATE TABLE `stored_files` (
	`object_key` text PRIMARY KEY NOT NULL,
	`owner_username` text NOT NULL,
	`category` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`file_data` blob NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_stored_files_owner_category` ON `stored_files` (`owner_username`,`category`);
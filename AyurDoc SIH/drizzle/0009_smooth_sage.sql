CREATE TABLE `doctor_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`full_name` text NOT NULL,
	`medical_system` text NOT NULL,
	`degree` text NOT NULL,
	`council_registration` text NOT NULL,
	`phone` text NOT NULL,
	`department` text NOT NULL,
	`university` text NOT NULL,
	`state_council` text NOT NULL,
	`experience_years` integer NOT NULL,
	`council_file_name` text NOT NULL,
	`council_content_type` text NOT NULL,
	`council_size_bytes` integer NOT NULL,
	`council_object_key` text NOT NULL,
	`degree_file_name` text NOT NULL,
	`degree_content_type` text NOT NULL,
	`degree_size_bytes` integer NOT NULL,
	`degree_object_key` text NOT NULL,
	`identity_file_name` text NOT NULL,
	`identity_content_type` text NOT NULL,
	`identity_size_bytes` integer NOT NULL,
	`identity_object_key` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_applications_username_unique` ON `doctor_applications` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `doctor_applications_council_registration_unique` ON `doctor_applications` (`council_registration`);--> statement-breakpoint
CREATE INDEX `idx_doctor_applications_status_created` ON `doctor_applications` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_doctor_applications_department` ON `doctor_applications` (`department`);
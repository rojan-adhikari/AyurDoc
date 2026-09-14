CREATE TABLE `government_ids` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`id_type` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`review_status` text DEFAULT 'pending' NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `government_ids_username_unique` ON `government_ids` (`username`);--> statement-breakpoint
CREATE INDEX `idx_government_ids_status` ON `government_ids` (`review_status`);--> statement-breakpoint
CREATE TABLE `otp_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` text NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_otp_challenges_phone` ON `otp_challenges` (`phone`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`username` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`display_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`phone_verified_at` text,
	`active` integer DEFAULT true NOT NULL,
	`created_by` text DEFAULT 'self-registration' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_profiles_phone` ON `user_profiles` (`phone`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_role_active` ON `user_profiles` (`role`,`active`);--> statement-breakpoint
PRAGMA optimize;

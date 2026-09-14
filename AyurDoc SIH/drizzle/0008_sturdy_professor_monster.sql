DROP INDEX `idx_user_profiles_phone`;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `email_verified_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_profiles_email` ON `user_profiles` (`email`) WHERE "user_profiles"."email" <> '';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_user_profiles_phone` ON `user_profiles` (`phone`) WHERE "user_profiles"."phone" <> '';--> statement-breakpoint
ALTER TABLE `otp_challenges` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_otp_challenges_email` ON `otp_challenges` (`email`);--> statement-breakpoint
PRAGMA optimize;

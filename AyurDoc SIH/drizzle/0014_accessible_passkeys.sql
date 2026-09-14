CREATE TABLE `passkey_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text DEFAULT '' NOT NULL,
	`purpose` text NOT NULL,
	`challenge` text NOT NULL,
	`rp_id` text NOT NULL,
	`expected_origin` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_passkey_challenges_expiry` ON `passkey_challenges` (`expires_at`);
--> statement-breakpoint
CREATE TABLE `passkey_credentials` (
	`credential_id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`transports` text DEFAULT '[]' NOT NULL,
	`device_type` text DEFAULT '' NOT NULL,
	`backed_up` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_passkey_credentials_username` ON `passkey_credentials` (`username`);

CREATE TABLE `direct_voice_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_username` text NOT NULL,
	`patient_name` text NOT NULL,
	`phone` text NOT NULL,
	`department` text NOT NULL,
	`language` text NOT NULL,
	`urgency` text DEFAULT 'Routine' NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`doctor_note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_direct_voice_patient` ON `direct_voice_messages` (`patient_username`);--> statement-breakpoint
CREATE INDEX `idx_direct_voice_status` ON `direct_voice_messages` (`status`);
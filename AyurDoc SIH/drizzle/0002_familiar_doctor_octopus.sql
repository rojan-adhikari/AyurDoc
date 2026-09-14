CREATE TABLE `medical_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intake_id` integer NOT NULL,
	`patient_username` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `medical_documents_intake_id_unique` ON `medical_documents` (`intake_id`);--> statement-breakpoint
CREATE TABLE `video_signals` (
	`meeting_code` text PRIMARY KEY NOT NULL,
	`offer_sdp` text DEFAULT '' NOT NULL,
	`answer_sdp` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `voice_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intake_id` integer NOT NULL,
	`patient_username` text NOT NULL,
	`patient_name` text NOT NULL,
	`department` text NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`object_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`duration_seconds` integer NOT NULL,
	`status` text DEFAULT 'unreviewed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voice_messages_intake_id_unique` ON `voice_messages` (`intake_id`);--> statement-breakpoint
ALTER TABLE `patient_intakes` ADD `document_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `patient_intakes` ADD `document_feedback` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `patient_intakes` ADD `document_notes` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `appointments_meeting_code_unique` ON `appointments` (`meeting_code`);
CREATE TABLE `clinical_clarifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intake_id` integer NOT NULL,
	`patient_username` text NOT NULL,
	`doctor_username` text NOT NULL,
	`question` text NOT NULL,
	`answer` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'English' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`answered_at` text,
	`closed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_clarifications_intake_status` ON `clinical_clarifications` (`intake_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_clarifications_patient_requested` ON `clinical_clarifications` (`patient_username`,`requested_at`);
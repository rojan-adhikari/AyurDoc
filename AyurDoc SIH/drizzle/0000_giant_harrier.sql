CREATE TABLE `patient_intakes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_username` text NOT NULL,
	`full_name` text NOT NULL,
	`age` integer NOT NULL,
	`sex` text NOT NULL,
	`address` text NOT NULL,
	`phone` text NOT NULL,
	`abha_number` text DEFAULT '' NOT NULL,
	`department` text NOT NULL,
	`language` text NOT NULL,
	`complaint` text NOT NULL,
	`onset` text NOT NULL,
	`symptoms` text NOT NULL,
	`conditions` text NOT NULL,
	`allergies` text NOT NULL,
	`narrative` text DEFAULT '' NOT NULL,
	`document_name` text DEFAULT '' NOT NULL,
	`red_flag` integer DEFAULT false NOT NULL,
	`consented_at` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`doctor_note` text DEFAULT '' NOT NULL,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`role` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

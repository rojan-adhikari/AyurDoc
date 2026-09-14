CREATE TABLE `patient_abha_profiles` (
	`username` text PRIMARY KEY NOT NULL,
	`abha_number` text DEFAULT '' NOT NULL,
	`abha_address` text DEFAULT '' NOT NULL,
	`verification_status` text DEFAULT 'not-linked' NOT NULL,
	`consent_granted` integer DEFAULT false NOT NULL,
	`consented_at` text,
	`linked_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_patient_abha_number` ON `patient_abha_profiles` (`abha_number`) WHERE "patient_abha_profiles"."abha_number" <> '';--> statement-breakpoint
CREATE INDEX `idx_patient_abha_status` ON `patient_abha_profiles` (`verification_status`);--> statement-breakpoint
CREATE INDEX `idx_direct_voice_doctor_created` ON `direct_voice_messages` (`doctor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_patient_intakes_patient_created` ON `patient_intakes` (`patient_username`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_patient_intakes_doctor_created` ON `patient_intakes` (`doctor_id`,`created_at`);
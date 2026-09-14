CREATE TABLE `appointments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_username` text NOT NULL,
	`patient_name` text NOT NULL,
	`phone` text NOT NULL,
	`doctor_id` text NOT NULL,
	`doctor_name` text NOT NULL,
	`department` text NOT NULL,
	`visit_mode` text NOT NULL,
	`appointment_date` text NOT NULL,
	`time_slot` text NOT NULL,
	`reason` text NOT NULL,
	`meeting_code` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blood_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_username` text NOT NULL,
	`patient_name` text NOT NULL,
	`phone` text NOT NULL,
	`blood_group` text NOT NULL,
	`component` text NOT NULL,
	`units` integer NOT NULL,
	`urgency` text NOT NULL,
	`hospital_location` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `donors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_username` text NOT NULL,
	`donor_name` text NOT NULL,
	`phone` text NOT NULL,
	`blood_group` text NOT NULL,
	`donation_date` text NOT NULL,
	`time_slot` text NOT NULL,
	`eligible_confirmed` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `emergency_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`patient_username` text NOT NULL,
	`patient_name` text NOT NULL,
	`phone` text NOT NULL,
	`bed_type` text NOT NULL,
	`symptoms` text NOT NULL,
	`ambulance` integer DEFAULT false NOT NULL,
	`pickup_address` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'alerted' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `patient_intakes` DROP COLUMN `abha_number`;
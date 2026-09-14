ALTER TABLE `direct_voice_messages` ADD `doctor_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_voice_messages` ADD `doctor_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_voice_messages` ADD `symptom_category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_voice_messages` ADD `symptom_duration` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_voice_messages` ADD `severity` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `patient_intakes` ADD `doctor_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `patient_intakes` ADD `doctor_name` text DEFAULT '' NOT NULL;
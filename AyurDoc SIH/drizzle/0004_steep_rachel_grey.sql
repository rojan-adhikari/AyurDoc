ALTER TABLE `direct_voice_messages` ADD `transcript` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `direct_voice_messages` ADD `summary` text DEFAULT '' NOT NULL;
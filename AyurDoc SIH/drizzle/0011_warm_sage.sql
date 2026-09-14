CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intake_id` integer,
	`actor_username` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`detail_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_intake_created` ON `audit_events` (`intake_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_actor_created` ON `audit_events` (`actor_username`,`created_at`);--> statement-breakpoint
CREATE TABLE `clinical_workflow_records` (
	`intake_id` integer PRIMARY KEY NOT NULL,
	`schema_version` text DEFAULT 'ayurdoc-clinical-v1' NOT NULL,
	`structured_json` text NOT NULL,
	`physician_summary` text NOT NULL,
	`fhir_bundle_json` text NOT NULL,
	`completeness_score` integer DEFAULT 0 NOT NULL,
	`red_flag_codes` text DEFAULT '[]' NOT NULL,
	`decision` text DEFAULT 'pending' NOT NULL,
	`review_note` text DEFAULT '' NOT NULL,
	`reviewed_by` text DEFAULT '' NOT NULL,
	`reviewed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clinical_workflow_decision` ON `clinical_workflow_records` (`decision`);--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`intake_id` integer NOT NULL,
	`patient_username` text NOT NULL,
	`purpose` text NOT NULL,
	`scope_json` text NOT NULL,
	`status` text DEFAULT 'granted' NOT NULL,
	`policy_version` text DEFAULT 'ayurdoc-consent-v1' NOT NULL,
	`granted_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_consent_intake_created` ON `consent_records` (`intake_id`,`granted_at`);--> statement-breakpoint
CREATE INDEX `idx_consent_patient_status` ON `consent_records` (`patient_username`,`status`);
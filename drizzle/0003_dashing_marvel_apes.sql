CREATE TABLE `exercise_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`preset_id` text NOT NULL,
	`activity_name` text NOT NULL,
	`minutes` integer NOT NULL,
	`met_value` real NOT NULL,
	`calories` real NOT NULL,
	`weight_kg` real NOT NULL,
	`standard` text NOT NULL,
	`performed_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `exercises_owner_profile_idx` ON `exercise_entries` (`owner_email`,`profile_id`);--> statement-breakpoint
CREATE INDEX `exercises_date_idx` ON `exercise_entries` (`profile_id`,`local_date`);
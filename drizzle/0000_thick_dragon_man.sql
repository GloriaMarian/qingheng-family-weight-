CREATE TABLE `accounts` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`input_hash` text NOT NULL,
	`result_json` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `insights_owner_profile_idx` ON `ai_insights` (`owner_email`,`profile_id`);--> statement-breakpoint
CREATE INDEX `insights_date_idx` ON `ai_insights` (`owner_email`,`local_date`);--> statement-breakpoint
CREATE TABLE `custom_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`kcal_per_100g` real NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `foods_owner_idx` ON `custom_foods` (`owner_email`);--> statement-breakpoint
CREATE TABLE `daily_contexts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`sleep_hours` real,
	`exercise_minutes` integer,
	`water_ml` integer,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contexts_owner_profile_idx` ON `daily_contexts` (`owner_email`,`profile_id`);--> statement-breakpoint
CREATE TABLE `meal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`meal_type` text NOT NULL,
	`food_id` text,
	`food_name` text NOT NULL,
	`grams` real NOT NULL,
	`kcal_per_100g` real NOT NULL,
	`calories` real NOT NULL,
	`recorded_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `meals_owner_profile_idx` ON `meal_entries` (`owner_email`,`profile_id`);--> statement-breakpoint
CREATE INDEX `meals_date_idx` ON `meal_entries` (`profile_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`nickname` text NOT NULL,
	`birth_date` text NOT NULL,
	`sex` text NOT NULL,
	`height_cm` real NOT NULL,
	`weight_unit` text NOT NULL,
	`activity_level` text NOT NULL,
	`goal` text NOT NULL,
	`life_stage` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`due_date` text,
	`prepregnancy_weight_kg` real,
	`fetus_count` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profiles_owner_idx` ON `profiles` (`owner_email`);--> statement-breakpoint
CREATE TABLE `weight_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`owner_email` text NOT NULL,
	`profile_id` text NOT NULL,
	`local_date` text NOT NULL,
	`period` text NOT NULL,
	`weight_kg` real NOT NULL,
	`recorded_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `weights_owner_profile_idx` ON `weight_entries` (`owner_email`,`profile_id`);--> statement-breakpoint
CREATE INDEX `weights_date_idx` ON `weight_entries` (`profile_id`,`local_date`);
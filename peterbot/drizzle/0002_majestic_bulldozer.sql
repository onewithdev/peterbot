CREATE TABLE `job_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`event` text NOT NULL,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`iv` text NOT NULL,
	`masked_key` text NOT NULL,
	`label` text,
	`is_valid` integer DEFAULT false NOT NULL,
	`last_error` text,
	`validated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

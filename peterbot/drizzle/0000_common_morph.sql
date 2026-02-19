CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`chat_id` text NOT NULL,
	`schedule_id` text,
	`skill_system_prompt` text,
	`delivered` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`description` text NOT NULL,
	`natural_schedule` text NOT NULL,
	`parsed_cron` text NOT NULL,
	`prompt` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_run_at` integer,
	`next_run_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chat_state` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`latest_summary` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`trigger_job_id` text,
	`message_count` integer NOT NULL,
	`summary` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `solutions` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`tags` text,
	`keywords` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `solutions_job_id_unique` ON `solutions` (`job_id`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`direction` text NOT NULL,
	`content` text NOT NULL,
	`sender` text NOT NULL,
	`job_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_chat_id` ON `chat_messages` (`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_created_at` ON `chat_messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`trigger_pattern` text NOT NULL,
	`tools` text,
	`category` text DEFAULT 'general' NOT NULL,
	`system_prompt` text NOT NULL,
	`content` text NOT NULL,
	`file_path` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`valid` integer DEFAULT true NOT NULL,
	`load_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_name_unique` ON `skills` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `skills_file_path_unique` ON `skills` (`file_path`);--> statement-breakpoint
CREATE TABLE `connected_apps` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`composio_entity_id` text DEFAULT 'peterbot-user' NOT NULL,
	`account_email` text,
	`enabled` integer DEFAULT true NOT NULL,
	`connected_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `connected_apps_provider_unique` ON `connected_apps` (`provider`);--> statement-breakpoint
CREATE TABLE `document_references` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`source` text NOT NULL,
	`type` text DEFAULT 'web' NOT NULL,
	`summary` text,
	`tags` text,
	`content` text,
	`content_truncated` integer DEFAULT false NOT NULL,
	`cached_at` integer,
	`last_fetch_attempt_at` integer,
	`last_fetch_error` text,
	`last_accessed` integer NOT NULL,
	`memory_importance` integer DEFAULT 5 NOT NULL,
	`created_at` integer NOT NULL
);

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

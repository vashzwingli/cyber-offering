CREATE TABLE `deity_exposures` (
	`deity_id` text PRIMARY KEY NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`last_shown` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `match_draws` (
	`request_id` text PRIMARY KEY NOT NULL,
	`query_hash` text NOT NULL,
	`deity_id` text NOT NULL,
	`score` integer NOT NULL,
	`relation_level` text NOT NULL,
	`category` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `match_draws_created_at_idx` ON `match_draws` (`created_at`);
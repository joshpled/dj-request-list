CREATE TABLE `admin_login_attempts` (
	`client_key` text PRIMARY KEY NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`blocked_until` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`event_name` text NOT NULL,
	`welcome_message` text NOT NULL,
	`request_limit` integer DEFAULT 5 NOT NULL,
	`closing_time` text,
	`guest_token` text NOT NULL,
	`admin_pin_hash` text NOT NULL,
	`admin_pin_salt` text NOT NULL,
	`pin_version` integer DEFAULT 1 NOT NULL,
	`session_secret` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_settings_guest_token_unique` ON `event_settings` (`guest_token`);--> statement-breakpoint
CREATE TABLE `song_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`song_title` text NOT NULL,
	`artist` text NOT NULL,
	`guest_name` text,
	`note` text,
	`status` text DEFAULT 'New' NOT NULL,
	`device_id` text NOT NULL,
	`normalized_song` text NOT NULL,
	`normalized_artist` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_song_requests_created_at` ON `song_requests` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_song_requests_status_created` ON `song_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_song_requests_device_created` ON `song_requests` (`device_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_song_requests_duplicate` ON `song_requests` (`normalized_song`,`normalized_artist`,`created_at`);
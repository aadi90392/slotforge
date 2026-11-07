CREATE TABLE `auth_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `auth_token_user` ON `auth_tokens` (`user_id`,`purpose`);--> statement-breakpoint
CREATE TABLE `local_mail` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`purpose` text NOT NULL,
	`link` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `email_verified` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` integer;
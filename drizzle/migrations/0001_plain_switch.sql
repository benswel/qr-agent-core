ALTER TABLE `api_keys` ADD `plan` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `stripe_customer_id` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `stripe_subscription_id` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `expires_at` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `scheduled_url` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `scheduled_at` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `type` text DEFAULT 'url' NOT NULL;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `type_data` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `utm_params` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `gtm_container_id` text;--> statement-breakpoint
ALTER TABLE `qr_codes` ADD `redirect_rules` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `device_type` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `browser` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `os` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `country` text;--> statement-breakpoint
ALTER TABLE `scan_events` ADD `city` text;
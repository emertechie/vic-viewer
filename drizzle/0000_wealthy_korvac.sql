CREATE TABLE `logs_view_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`default_live_enabled` integer DEFAULT true NOT NULL,
	`row_density` text DEFAULT 'comfortable' NOT NULL,
	`wrap_lines` integer DEFAULT true NOT NULL,
	`visible_columns` text DEFAULT '["time","severity","serviceName","message","traceId","spanId"]' NOT NULL,
	`default_relative_range` text DEFAULT '15m' NOT NULL,
	`otel_preset_enabled` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);

ALTER TABLE "video_run_settings" ALTER COLUMN "video_duration" SET DEFAULT 8;--> statement-breakpoint
ALTER TABLE "video_run_settings" ADD COLUMN "image_aspect_ratio" text DEFAULT '16:9' NOT NULL;--> statement-breakpoint
ALTER TABLE "video_run_settings" ADD COLUMN "video_aspect_ratio" text DEFAULT '16:9' NOT NULL;
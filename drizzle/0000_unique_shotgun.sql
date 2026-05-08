CREATE TYPE "public"."video_branch_kind" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."video_node_status" AS ENUM('pending', 'started', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."video_run_status" AS ENUM('pending', 'started', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "video_branch_end_frames" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"frame_path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_branch_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_branch_jobs" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"provider_job_id" text NOT NULL,
	"provider_generation_id" text
);
--> statement-breakpoint
CREATE TABLE "video_branch_outputs" (
	"branch_id" uuid PRIMARY KEY NOT NULL,
	"video_path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_branch_provider_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"call_type" text NOT NULL,
	"response" jsonb NOT NULL,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_node_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"kind" "video_branch_kind" NOT NULL,
	"prompt" text NOT NULL,
	"outcome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_node_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_node_manifests" (
	"node_id" uuid PRIMARY KEY NOT NULL,
	"node_title" text NOT NULL,
	"scene_state" text NOT NULL,
	"continuity_notes" text NOT NULL,
	"next_state_intent" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_node_provider_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"call_type" text NOT NULL,
	"response" jsonb NOT NULL,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"depth_index" integer NOT NULL,
	"status" "video_node_status" DEFAULT 'pending' NOT NULL,
	"source_frame_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_run_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_run_provider_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"call_type" text NOT NULL,
	"response" jsonb NOT NULL,
	"usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_run_root_manifests" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"style_bible" text NOT NULL,
	"world_state" text NOT NULL,
	"start_image_prompt" text NOT NULL,
	"branch_goal" text NOT NULL,
	"node_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_run_settings" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"depth" integer DEFAULT 5 NOT NULL,
	"manifest_model" text NOT NULL,
	"image_model" text NOT NULL,
	"video_model" text NOT NULL,
	"video_resolution" text DEFAULT '720p' NOT NULL,
	"video_duration" integer DEFAULT 5 NOT NULL,
	"generate_audio" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_run_start_images" (
	"run_id" uuid PRIMARY KEY NOT NULL,
	"path" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "video_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"status" "video_run_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_branch_end_frames" ADD CONSTRAINT "video_branch_end_frames_branch_id_video_node_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."video_node_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_branch_failures" ADD CONSTRAINT "video_branch_failures_branch_id_video_node_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."video_node_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_branch_jobs" ADD CONSTRAINT "video_branch_jobs_branch_id_video_node_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."video_node_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_branch_outputs" ADD CONSTRAINT "video_branch_outputs_branch_id_video_node_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."video_node_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_branch_provider_calls" ADD CONSTRAINT "video_branch_provider_calls_branch_id_video_node_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."video_node_branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_node_branches" ADD CONSTRAINT "video_node_branches_node_id_video_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."video_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_node_failures" ADD CONSTRAINT "video_node_failures_node_id_video_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."video_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_node_manifests" ADD CONSTRAINT "video_node_manifests_node_id_video_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."video_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_node_provider_calls" ADD CONSTRAINT "video_node_provider_calls_node_id_video_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."video_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_nodes" ADD CONSTRAINT "video_nodes_run_id_video_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_run_failures" ADD CONSTRAINT "video_run_failures_run_id_video_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_run_provider_calls" ADD CONSTRAINT "video_run_provider_calls_run_id_video_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_run_root_manifests" ADD CONSTRAINT "video_run_root_manifests_run_id_video_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_run_settings" ADD CONSTRAINT "video_run_settings_run_id_video_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_run_start_images" ADD CONSTRAINT "video_run_start_images_run_id_video_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."video_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "video_node_branches_node_kind_idx" ON "video_node_branches" USING btree ("node_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "video_nodes_run_depth_idx" ON "video_nodes" USING btree ("run_id","depth_index");
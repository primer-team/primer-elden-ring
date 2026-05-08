import { relations } from "drizzle-orm";
import {
	boolean,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const videoRunStatus = pgEnum("video_run_status", [
	"pending",
	"started",
	"completed",
	"failed",
]);

export const videoNodeStatus = pgEnum("video_node_status", [
	"pending",
	"started",
	"completed",
	"failed",
]);

export const videoBranchKind = pgEnum("video_branch_kind", ["success", "failure"]);

export const videoRuns = pgTable("video_runs", {
	id: uuid("id").primaryKey().defaultRandom(),
	prompt: text("prompt").notNull(),
	status: videoRunStatus("status").notNull().default("pending"),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoRunSettings = pgTable("video_run_settings", {
	runId: uuid("run_id")
		.primaryKey()
		.references(() => videoRuns.id, { onDelete: "cascade" }),
	depth: integer("depth").notNull().default(5),
	manifestModel: text("manifest_model").notNull(),
	imageModel: text("image_model").notNull(),
	videoModel: text("video_model").notNull(),
	videoResolution: text("video_resolution").notNull().default("720p"),
	videoDuration: integer("video_duration").notNull().default(5),
	generateAudio: boolean("generate_audio").notNull().default(true),
});

export const videoRunRootManifests = pgTable("video_run_root_manifests", {
	runId: uuid("run_id")
		.primaryKey()
		.references(() => videoRuns.id, { onDelete: "cascade" }),
	title: text("title").notNull(),
	styleBible: text("style_bible").notNull(),
	worldState: text("world_state").notNull(),
	startImagePrompt: text("start_image_prompt").notNull(),
	branchGoal: text("branch_goal").notNull(),
	nodeCount: integer("node_count").notNull(),
});

export const videoRunStartImages = pgTable("video_run_start_images", {
	runId: uuid("run_id")
		.primaryKey()
		.references(() => videoRuns.id, { onDelete: "cascade" }),
	path: text("path").notNull(),
});

export const videoNodes = pgTable(
	"video_nodes",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		runId: uuid("run_id")
			.notNull()
			.references(() => videoRuns.id, { onDelete: "cascade" }),
		depthIndex: integer("depth_index").notNull(),
		status: videoNodeStatus("status").notNull().default("pending"),
		sourceFramePath: text("source_frame_path").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [uniqueIndex("video_nodes_run_depth_idx").on(table.runId, table.depthIndex)],
);

export const videoNodeManifests = pgTable("video_node_manifests", {
	nodeId: uuid("node_id")
		.primaryKey()
		.references(() => videoNodes.id, { onDelete: "cascade" }),
	nodeTitle: text("node_title").notNull(),
	sceneState: text("scene_state").notNull(),
	continuityNotes: text("continuity_notes").notNull(),
	nextStateIntent: text("next_state_intent").notNull(),
});

export const videoNodeBranches = pgTable(
	"video_node_branches",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		nodeId: uuid("node_id")
			.notNull()
			.references(() => videoNodes.id, { onDelete: "cascade" }),
		kind: videoBranchKind("kind").notNull(),
		prompt: text("prompt").notNull(),
		outcome: text("outcome").notNull(),
	},
	(table) => [uniqueIndex("video_node_branches_node_kind_idx").on(table.nodeId, table.kind)],
);

export const videoBranchJobs = pgTable("video_branch_jobs", {
	branchId: uuid("branch_id")
		.primaryKey()
		.references(() => videoNodeBranches.id, { onDelete: "cascade" }),
	providerJobId: text("provider_job_id").notNull(),
	providerGenerationId: text("provider_generation_id"),
});

export const videoBranchOutputs = pgTable("video_branch_outputs", {
	branchId: uuid("branch_id")
		.primaryKey()
		.references(() => videoNodeBranches.id, { onDelete: "cascade" }),
	videoPath: text("video_path").notNull(),
});

export const videoBranchEndFrames = pgTable("video_branch_end_frames", {
	branchId: uuid("branch_id")
		.primaryKey()
		.references(() => videoNodeBranches.id, { onDelete: "cascade" }),
	framePath: text("frame_path").notNull(),
});

export const videoRunProviderCalls = pgTable("video_run_provider_calls", {
	id: uuid("id").primaryKey().defaultRandom(),
	runId: uuid("run_id")
		.notNull()
		.references(() => videoRuns.id, { onDelete: "cascade" }),
	provider: text("provider").notNull(),
	callType: text("call_type").notNull(),
	response: jsonb("response").$type<Record<string, unknown>>().notNull(),
	usage: jsonb("usage").$type<Record<string, unknown>>(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoNodeProviderCalls = pgTable("video_node_provider_calls", {
	id: uuid("id").primaryKey().defaultRandom(),
	nodeId: uuid("node_id")
		.notNull()
		.references(() => videoNodes.id, { onDelete: "cascade" }),
	provider: text("provider").notNull(),
	callType: text("call_type").notNull(),
	response: jsonb("response").$type<Record<string, unknown>>().notNull(),
	usage: jsonb("usage").$type<Record<string, unknown>>(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoBranchProviderCalls = pgTable("video_branch_provider_calls", {
	id: uuid("id").primaryKey().defaultRandom(),
	branchId: uuid("branch_id")
		.notNull()
		.references(() => videoNodeBranches.id, { onDelete: "cascade" }),
	provider: text("provider").notNull(),
	callType: text("call_type").notNull(),
	response: jsonb("response").$type<Record<string, unknown>>().notNull(),
	usage: jsonb("usage").$type<Record<string, unknown>>(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoRunFailures = pgTable("video_run_failures", {
	id: uuid("id").primaryKey().defaultRandom(),
	runId: uuid("run_id")
		.notNull()
		.references(() => videoRuns.id, { onDelete: "cascade" }),
	message: text("message").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoNodeFailures = pgTable("video_node_failures", {
	id: uuid("id").primaryKey().defaultRandom(),
	nodeId: uuid("node_id")
		.notNull()
		.references(() => videoNodes.id, { onDelete: "cascade" }),
	message: text("message").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoBranchFailures = pgTable("video_branch_failures", {
	id: uuid("id").primaryKey().defaultRandom(),
	branchId: uuid("branch_id")
		.notNull()
		.references(() => videoNodeBranches.id, { onDelete: "cascade" }),
	message: text("message").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const videoRunsRelations = relations(videoRuns, ({ many, one }) => ({
	settings: one(videoRunSettings),
	rootManifest: one(videoRunRootManifests),
	startImage: one(videoRunStartImages),
	nodes: many(videoNodes),
	providerCalls: many(videoRunProviderCalls),
	failures: many(videoRunFailures),
}));

export const videoRunSettingsRelations = relations(videoRunSettings, ({ one }) => ({
	run: one(videoRuns, {
		fields: [videoRunSettings.runId],
		references: [videoRuns.id],
	}),
}));

export const videoRunRootManifestsRelations = relations(videoRunRootManifests, ({ one }) => ({
	run: one(videoRuns, {
		fields: [videoRunRootManifests.runId],
		references: [videoRuns.id],
	}),
}));

export const videoRunStartImagesRelations = relations(videoRunStartImages, ({ one }) => ({
	run: one(videoRuns, {
		fields: [videoRunStartImages.runId],
		references: [videoRuns.id],
	}),
}));

export const videoNodesRelations = relations(videoNodes, ({ many, one }) => ({
	run: one(videoRuns, {
		fields: [videoNodes.runId],
		references: [videoRuns.id],
	}),
	manifest: one(videoNodeManifests),
	branches: many(videoNodeBranches),
	providerCalls: many(videoNodeProviderCalls),
	failures: many(videoNodeFailures),
}));

export const videoNodeManifestsRelations = relations(videoNodeManifests, ({ one }) => ({
	node: one(videoNodes, {
		fields: [videoNodeManifests.nodeId],
		references: [videoNodes.id],
	}),
}));

export const videoNodeBranchesRelations = relations(videoNodeBranches, ({ many, one }) => ({
	node: one(videoNodes, {
		fields: [videoNodeBranches.nodeId],
		references: [videoNodes.id],
	}),
	job: one(videoBranchJobs),
	output: one(videoBranchOutputs),
	endFrame: one(videoBranchEndFrames),
	providerCalls: many(videoBranchProviderCalls),
	failures: many(videoBranchFailures),
}));

export const videoBranchJobsRelations = relations(videoBranchJobs, ({ one }) => ({
	branch: one(videoNodeBranches, {
		fields: [videoBranchJobs.branchId],
		references: [videoNodeBranches.id],
	}),
}));

export const videoBranchOutputsRelations = relations(videoBranchOutputs, ({ one }) => ({
	branch: one(videoNodeBranches, {
		fields: [videoBranchOutputs.branchId],
		references: [videoNodeBranches.id],
	}),
}));

export const videoBranchEndFramesRelations = relations(videoBranchEndFrames, ({ one }) => ({
	branch: one(videoNodeBranches, {
		fields: [videoBranchEndFrames.branchId],
		references: [videoNodeBranches.id],
	}),
}));

export const videoRunProviderCallsRelations = relations(videoRunProviderCalls, ({ one }) => ({
	run: one(videoRuns, {
		fields: [videoRunProviderCalls.runId],
		references: [videoRuns.id],
	}),
}));

export const videoNodeProviderCallsRelations = relations(videoNodeProviderCalls, ({ one }) => ({
	node: one(videoNodes, {
		fields: [videoNodeProviderCalls.nodeId],
		references: [videoNodes.id],
	}),
}));

export const videoBranchProviderCallsRelations = relations(videoBranchProviderCalls, ({ one }) => ({
	branch: one(videoNodeBranches, {
		fields: [videoBranchProviderCalls.branchId],
		references: [videoNodeBranches.id],
	}),
}));

export const videoRunFailuresRelations = relations(videoRunFailures, ({ one }) => ({
	run: one(videoRuns, {
		fields: [videoRunFailures.runId],
		references: [videoRuns.id],
	}),
}));

export const videoNodeFailuresRelations = relations(videoNodeFailures, ({ one }) => ({
	node: one(videoNodes, {
		fields: [videoNodeFailures.nodeId],
		references: [videoNodes.id],
	}),
}));

export const videoBranchFailuresRelations = relations(videoBranchFailures, ({ one }) => ({
	branch: one(videoNodeBranches, {
		fields: [videoBranchFailures.branchId],
		references: [videoNodeBranches.id],
	}),
}));

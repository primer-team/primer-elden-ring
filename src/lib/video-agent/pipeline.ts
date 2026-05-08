import "server-only";

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	videoBranchEndFrames,
	videoBranchFailures,
	videoBranchJobs,
	videoBranchOutputs,
	videoBranchProviderCalls,
	videoNodeBranches,
	videoNodeFailures,
	videoNodeManifests,
	videoNodeProviderCalls,
	videoNodes,
	videoRunFailures,
	videoRunProviderCalls,
	videoRunRootManifests,
	videoRunSettings,
	videoRunStartImages,
	videoRuns,
} from "@/db/schema";
import { env } from "@/env";
import {
	createNodeManifest,
	createRootManifest,
	downloadVideo,
	generateStartImage,
	submitSeedanceVideo,
	waitForVideo,
} from "./openrouter";
import {
	extractFinalFrame,
	generationFileToDataUrl,
	writeDataUrlFile,
	writeGenerationFile,
} from "./storage";
import type { NodeManifest, OpenRouterUsage } from "./types";

const NODE_COUNT = 5;
const VIDEO_DURATION_SECONDS = 5;
const VIDEO_RESOLUTION = "720p";
const GENERATE_AUDIO = true;

function now() {
	return new Date();
}

function usageOrNull(usage: OpenRouterUsage | undefined) {
	return usage ? { ...usage } : null;
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export async function createVideoGeneration(prompt: string) {
	const [run] = await db
		.insert(videoRuns)
		.values({
			prompt,
			status: "pending",
		})
		.returning();

	if (!run) {
		throw new Error("Failed to create video generation.");
	}

	await db.insert(videoRunSettings).values({
		runId: run.id,
		depth: NODE_COUNT,
		manifestModel: env.OPENROUTER_MANIFEST_MODEL,
		imageModel: env.OPENROUTER_IMAGE_MODEL,
		videoModel: env.OPENROUTER_VIDEO_MODEL,
		videoResolution: VIDEO_RESOLUTION,
		videoDuration: VIDEO_DURATION_SECONDS,
		generateAudio: GENERATE_AUDIO,
	});

	void runVideoGeneration(run.id).catch(() => undefined);

	const generation = await getVideoGeneration(run.id);
	if (!generation) {
		throw new Error("Failed to load created video generation.");
	}
	return generation;
}

export async function getVideoGeneration(id: string) {
	const run = await db.query.videoRuns.findFirst({
		where: eq(videoRuns.id, id),
		with: {
			settings: true,
			rootManifest: true,
			startImage: true,
			failures: true,
		},
	});
	if (!run) {
		return null;
	}

	const nodeRows = await db.query.videoNodes.findMany({
		where: eq(videoNodes.runId, id),
		orderBy: [asc(videoNodes.depthIndex)],
		with: {
			manifest: true,
			branches: {
				with: {
					job: true,
					output: true,
					endFrame: true,
					failures: true,
				},
			},
			failures: true,
		},
	});

	return {
		...run,
		nodes: nodeRows.map((node) => ({
			...node,
			branches: [...node.branches].sort((left, right) =>
				left.kind === right.kind ? 0 : left.kind === "success" ? -1 : 1,
			),
		})),
	};
}

export async function listVideoGenerations() {
	return db.query.videoRuns.findMany({
		orderBy: [asc(videoRuns.createdAt)],
		with: {
			settings: true,
			rootManifest: true,
			startImage: true,
			failures: true,
		},
	});
}

async function updateRun(runId: string, values: Partial<typeof videoRuns.$inferInsert>) {
	await db
		.update(videoRuns)
		.set({ ...values, updatedAt: now() })
		.where(eq(videoRuns.id, runId));
}

async function updateNode(nodeId: string, values: Partial<typeof videoNodes.$inferInsert>) {
	await db
		.update(videoNodes)
		.set({ ...values, updatedAt: now() })
		.where(eq(videoNodes.id, nodeId));
}

async function failRun(runId: string, message: string) {
	await updateRun(runId, { status: "failed" });
	await db.insert(videoRunFailures).values({ runId, message });
}

async function failNode(nodeId: string, message: string) {
	await updateNode(nodeId, { status: "failed" });
	await db.insert(videoNodeFailures).values({ nodeId, message });
}

async function failBranch(branchId: string, message: string) {
	await db.insert(videoBranchFailures).values({ branchId, message });
}

async function insertRunProviderCall(input: {
	runId: string;
	callType: string;
	response: Record<string, unknown>;
	usage?: OpenRouterUsage;
}) {
	await db.insert(videoRunProviderCalls).values({
		runId: input.runId,
		provider: "openrouter",
		callType: input.callType,
		response: input.response,
		usage: usageOrNull(input.usage),
	});
}

async function insertNodeProviderCall(input: {
	nodeId: string;
	callType: string;
	response: Record<string, unknown>;
	usage?: OpenRouterUsage;
}) {
	await db.insert(videoNodeProviderCalls).values({
		nodeId: input.nodeId,
		provider: "openrouter",
		callType: input.callType,
		response: input.response,
		usage: usageOrNull(input.usage),
	});
}

async function insertBranchProviderCall(input: {
	branchId: string;
	callType: string;
	response: Record<string, unknown>;
	usage?: OpenRouterUsage;
}) {
	await db.insert(videoBranchProviderCalls).values({
		branchId: input.branchId,
		provider: "openrouter",
		callType: input.callType,
		response: input.response,
		usage: usageOrNull(input.usage),
	});
}

async function createVideoFromFrame(input: {
	runId: string;
	branchId: string;
	nodeIndex: number;
	branchKind: "success" | "failure";
	prompt: string;
	firstFramePath: string;
	seed: number;
	videoDuration: number;
	videoResolution: string;
	generateAudio: boolean;
}) {
	try {
		const firstFrameDataUrl = await generationFileToDataUrl(
			input.runId,
			input.firstFramePath,
			"image/png",
		);
		const job = await submitSeedanceVideo({
			prompt: input.prompt,
			firstFrameDataUrl,
			duration: input.videoDuration,
			resolution: input.videoResolution,
			generateAudio: input.generateAudio,
			seed: input.seed,
		});
		await db.insert(videoBranchJobs).values({
			branchId: input.branchId,
			providerJobId: job.id,
			providerGenerationId: job.generationId ?? null,
		});
		await insertBranchProviderCall({
			branchId: input.branchId,
			callType: "submit_video",
			response: job.response,
		});

		const completed = await waitForVideo(job);
		await insertBranchProviderCall({
			branchId: input.branchId,
			callType: "complete_video",
			response: completed.response,
			usage: completed.usage,
		});

		const videoBuffer = await downloadVideo(job.id);
		const videoPath = `node-${String(input.nodeIndex).padStart(2, "0")}/${input.branchKind}.mp4`;
		await writeGenerationFile(input.runId, videoPath, videoBuffer);
		await db.insert(videoBranchOutputs).values({ branchId: input.branchId, videoPath });

		return { videoPath, completed };
	} catch (error) {
		await failBranch(input.branchId, errorMessage(error, "Unknown branch generation error."));
		throw error;
	}
}

export async function runVideoGeneration(runId: string) {
	const run = await db.query.videoRuns.findFirst({
		where: eq(videoRuns.id, runId),
		with: { settings: true },
	});
	if (!run) {
		throw new Error(`Video generation ${runId} not found.`);
	}
	if (!run.settings) {
		throw new Error(`Video generation ${runId} has no settings.`);
	}

	await updateRun(runId, { status: "started" });

	try {
		const root = await createRootManifest(run.prompt, run.settings.depth);
		const rootManifest = root.manifest;
		await db.insert(videoRunRootManifests).values({
			runId,
			title: rootManifest.title,
			styleBible: rootManifest.styleBible,
			worldState: rootManifest.worldState,
			startImagePrompt: rootManifest.startImagePrompt,
			branchGoal: rootManifest.branchGoal,
			nodeCount: rootManifest.nodeCount,
		});
		await insertRunProviderCall({
			runId,
			callType: "root_manifest",
			response: root.response,
			usage: root.usage,
		});

		const startImage = await generateStartImage(rootManifest.startImagePrompt);
		const startImagePath = await writeDataUrlFile(runId, "start.png", startImage.imageUrl);
		await db.insert(videoRunStartImages).values({ runId, path: startImagePath });
		await insertRunProviderCall({
			runId,
			callType: "start_image",
			response: startImage.response,
			usage: startImage.usage,
		});

		let currentFramePath = startImagePath;
		const nodeManifests: NodeManifest[] = [];

		for (let nodeIndex = 1; nodeIndex <= run.settings.depth; nodeIndex += 1) {
			const [node] = await db
				.insert(videoNodes)
				.values({
					runId,
					depthIndex: nodeIndex,
					status: "started",
					sourceFramePath: currentFramePath,
				})
				.returning();

			if (!node) {
				throw new Error(`Failed to create node ${nodeIndex}.`);
			}

			try {
				const sourceFrameDataUrl = await generationFileToDataUrl(
					runId,
					currentFramePath,
					"image/png",
				);
				const nodeResult = await createNodeManifest({
					rootManifest,
					previousNodeManifests: nodeManifests,
					nodeIndex,
					sourceFrameDataUrl,
				});
				const nodeManifest = nodeResult.manifest;
				nodeManifests.push(nodeManifest);

				await db.insert(videoNodeManifests).values({
					nodeId: node.id,
					nodeTitle: nodeManifest.nodeTitle,
					sceneState: nodeManifest.sceneState,
					continuityNotes: nodeManifest.continuityNotes,
					nextStateIntent: nodeManifest.nextStateIntent,
				});
				await insertNodeProviderCall({
					nodeId: node.id,
					callType: "node_manifest",
					response: nodeResult.response,
					usage: nodeResult.usage,
				});

				const [successBranch, failureBranch] = await db
					.insert(videoNodeBranches)
					.values([
						{
							nodeId: node.id,
							kind: "success",
							prompt: nodeManifest.successPrompt,
							outcome: nodeManifest.successOutcome,
						},
						{
							nodeId: node.id,
							kind: "failure",
							prompt: nodeManifest.failurePrompt,
							outcome: nodeManifest.failureOutcome,
						},
					])
					.returning();

				if (!successBranch || !failureBranch) {
					throw new Error(`Failed to create branches for node ${nodeIndex}.`);
				}

				const [success] = await Promise.all([
					createVideoFromFrame({
						runId,
						branchId: successBranch.id,
						nodeIndex,
						branchKind: "success",
						prompt: nodeManifest.successPrompt,
						firstFramePath: currentFramePath,
						seed: nodeIndex,
						videoDuration: run.settings.videoDuration,
						videoResolution: run.settings.videoResolution,
						generateAudio: run.settings.generateAudio,
					}),
					createVideoFromFrame({
						runId,
						branchId: failureBranch.id,
						nodeIndex,
						branchKind: "failure",
						prompt: nodeManifest.failurePrompt,
						firstFramePath: currentFramePath,
						seed: nodeIndex + 100,
						videoDuration: run.settings.videoDuration,
						videoResolution: run.settings.videoResolution,
						generateAudio: run.settings.generateAudio,
					}),
				]);

				const successEndFramePath = await extractFinalFrame(
					runId,
					success.videoPath,
					`node-${String(nodeIndex).padStart(2, "0")}/success-end-frame.png`,
				);
				await db.insert(videoBranchEndFrames).values({
					branchId: successBranch.id,
					framePath: successEndFramePath,
				});

				await updateNode(node.id, { status: "completed" });
				currentFramePath = successEndFramePath;
			} catch (error) {
				await failNode(node.id, errorMessage(error, "Unknown node generation error."));
				throw error;
			}
		}

		await updateRun(runId, { status: "completed" });
	} catch (error) {
		await failRun(runId, errorMessage(error, "Unknown video generation error."));
		throw error;
	}
}

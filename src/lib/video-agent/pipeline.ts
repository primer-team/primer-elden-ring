import "server-only";

import { asc, desc, eq } from "drizzle-orm";
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
	formatSeedancePrompt,
	generateStartImage,
	submitSeedanceVideo,
	waitForVideo,
} from "./openrouter";
import {
	assetUrl,
	extractFinalFrame,
	generationFileToDataUrl,
	writeDataUrlFile,
	writeGenerationFile,
} from "./storage";
import type { OpenRouterUsage, PreviousNodeManifest, RootManifest } from "./types";

const NODE_COUNT = 5;
const VIDEO_DURATION_SECONDS = 8;
const VIDEO_RESOLUTION = "720p";
const IMAGE_ASPECT_RATIO = "16:9";
const VIDEO_ASPECT_RATIO = "16:9";
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
		imageAspectRatio: IMAGE_ASPECT_RATIO,
		videoAspectRatio: VIDEO_ASPECT_RATIO,
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

export async function retryVideoGeneration(id: string) {
	const generation = await getVideoGeneration(id);
	if (!generation) {
		throw new Error("Video generation not found.");
	}
	if (generation.status === "pending" || generation.status === "started") {
		throw new Error("Video generation is already running.");
	}

	const retryFromNode = generation.nodes.find((node) => node.status !== "completed");
	if (retryFromNode) {
		for (const node of generation.nodes.filter(
			(existingNode) => existingNode.depthIndex >= retryFromNode.depthIndex,
		)) {
			await db.delete(videoNodes).where(eq(videoNodes.id, node.id));
		}
	}

	await db.delete(videoRunFailures).where(eq(videoRunFailures.runId, id));
	await updateRun(id, { status: "pending" });
	void runVideoGeneration(id).catch(() => undefined);

	const retried = await getVideoGeneration(id);
	if (!retried) {
		throw new Error("Failed to load retried video generation.");
	}
	return retried;
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

export interface CompletedRunSummary {
	id: string;
	prompt: string;
	createdAt: string;
	title: string | null;
	startImageUrl: string | null;
}

export async function listCompletedRunSummaries(): Promise<CompletedRunSummary[]> {
	const rows = await db.query.videoRuns.findMany({
		where: eq(videoRuns.status, "completed"),
		orderBy: [desc(videoRuns.createdAt)],
		with: {
			rootManifest: true,
			startImage: true,
		},
	});
	return rows.map((row) => ({
		id: row.id,
		prompt: row.prompt,
		createdAt: row.createdAt.toISOString(),
		title: row.rootManifest?.title ?? null,
		startImageUrl: row.startImage?.path ? assetUrl(row.id, row.startImage.path) : null,
	}));
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
	videoAspectRatio: string;
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
			aspectRatio: input.videoAspectRatio,
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
		with: { settings: true, rootManifest: true, startImage: true },
	});
	if (!run) {
		throw new Error(`Video generation ${runId} not found.`);
	}
	if (!run.settings) {
		throw new Error(`Video generation ${runId} has no settings.`);
	}

	await updateRun(runId, { status: "started" });

	try {
		let rootManifest: RootManifest;
		if (run.rootManifest) {
			rootManifest = {
				title: run.rootManifest.title,
				styleBible: run.rootManifest.styleBible,
				worldState: run.rootManifest.worldState,
				startImagePrompt: run.rootManifest.startImagePrompt,
				branchGoal: run.rootManifest.branchGoal,
				nodeCount: run.rootManifest.nodeCount,
			};
		} else {
			const root = await createRootManifest(
				run.prompt,
				run.settings.depth,
				run.settings.imageAspectRatio,
			);
			rootManifest = root.manifest;
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
		}

		let startImagePath = run.startImage?.path;
		if (!startImagePath) {
			const startImage = await generateStartImage(
				rootManifest.startImagePrompt,
				run.settings.imageAspectRatio,
			);
			startImagePath = await writeDataUrlFile(runId, "start.png", startImage.imageUrl);
			await db.insert(videoRunStartImages).values({ runId, path: startImagePath });
			await insertRunProviderCall({
				runId,
				callType: "start_image",
				response: startImage.response,
				usage: startImage.usage,
			});
		}

		let currentFramePath = startImagePath;
		const nodeManifests: PreviousNodeManifest[] = [];
		const existingNodes = await db.query.videoNodes.findMany({
			where: eq(videoNodes.runId, runId),
			orderBy: [asc(videoNodes.depthIndex)],
			with: {
				manifest: true,
				branches: { with: { endFrame: true } },
			},
		});
		let lastCompletedNodeIndex = 0;

		for (const node of existingNodes) {
			const successBranch = node.branches.find((branch) => branch.kind === "success");
			if (node.status !== "completed" || !node.manifest || !successBranch?.endFrame) {
				break;
			}
			currentFramePath = successBranch.endFrame.framePath;
			nodeManifests.push({
				nodeTitle: node.manifest.nodeTitle,
				sceneState: node.manifest.sceneState,
				successPrompt: successBranch.prompt,
				failurePrompt: node.branches.find((branch) => branch.kind === "failure")?.prompt ?? "",
				successOutcome: successBranch.outcome,
				failureOutcome: node.branches.find((branch) => branch.kind === "failure")?.outcome ?? "",
				continuityNotes: node.manifest.continuityNotes,
				nextStateIntent: node.manifest.nextStateIntent,
			});
			lastCompletedNodeIndex = node.depthIndex;
		}

		for (
			let nodeIndex = lastCompletedNodeIndex + 1;
			nodeIndex <= run.settings.depth;
			nodeIndex += 1
		) {
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
					clipDuration: run.settings.videoDuration,
					aspectRatio: run.settings.videoAspectRatio,
					sourceFrameDataUrl,
				});
				const nodeManifest = nodeResult.manifest;
				const successPrompt = formatSeedancePrompt(
					nodeManifest.successShot,
					run.settings.videoDuration,
				);
				const failurePrompt = formatSeedancePrompt(
					nodeManifest.failureShot,
					run.settings.videoDuration,
				);
				nodeManifests.push({
					nodeTitle: nodeManifest.nodeTitle,
					sceneState: nodeManifest.sceneState,
					successPrompt,
					failurePrompt,
					successOutcome: nodeManifest.successOutcome,
					failureOutcome: nodeManifest.failureOutcome,
					continuityNotes: nodeManifest.continuityNotes,
					nextStateIntent: nodeManifest.nextStateIntent,
				});

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
							prompt: successPrompt,
							outcome: nodeManifest.successOutcome,
						},
						{
							nodeId: node.id,
							kind: "failure",
							prompt: failurePrompt,
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
						prompt: successPrompt,
						firstFramePath: currentFramePath,
						seed: nodeIndex,
						videoDuration: run.settings.videoDuration,
						videoResolution: run.settings.videoResolution,
						videoAspectRatio: run.settings.videoAspectRatio,
						generateAudio: run.settings.generateAudio,
					}),
					createVideoFromFrame({
						runId,
						branchId: failureBranch.id,
						nodeIndex,
						branchKind: "failure",
						prompt: failurePrompt,
						firstFramePath: currentFramePath,
						seed: nodeIndex + 100,
						videoDuration: run.settings.videoDuration,
						videoResolution: run.settings.videoResolution,
						videoAspectRatio: run.settings.videoAspectRatio,
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

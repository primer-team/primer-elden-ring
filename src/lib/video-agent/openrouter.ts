import "server-only";

import { env } from "@/env";
import type {
	ManifestResult,
	NodeManifest,
	OpenRouterUsage,
	RootManifest,
	VideoGenerationJob,
	VideoGenerationResult,
} from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

type ChatContentPart =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } };

type ChatMessage = {
	role: "system" | "user" | "assistant";
	content: string | ChatContentPart[];
};

type UnknownRecord = Record<string, unknown>;

interface ChatCompletionResponse {
	id?: string;
	choices?: Array<{
		message?: {
			content?: string | null;
			images?: Array<{ image_url?: { url?: string } }>;
			reasoning_details?: unknown;
		};
	}>;
	usage?: OpenRouterUsage;
	[key: string]: unknown;
}

interface VideoGenerationResponse {
	id: string;
	polling_url: string;
	status: string;
	generation_id?: string;
	unsigned_urls?: string[];
	usage?: OpenRouterUsage;
	error?: string;
	[key: string]: unknown;
}

function openRouterHeaders() {
	return {
		Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
		"Content-Type": "application/json",
		"HTTP-Referer": env.OPENROUTER_APP_URL ?? "http://localhost:3000",
		"X-OpenRouter-Title": env.OPENROUTER_APP_TITLE ?? "Primer Elden Ring Video Agent",
	};
}

async function openRouterJson<T>(path: string, init: RequestInit) {
	const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
		...init,
		headers: { ...openRouterHeaders(), ...init.headers },
	});
	const text = await response.text();
	const parsed = text ? (JSON.parse(text) as T) : ({} as T);
	if (!response.ok) {
		throw new Error(`OpenRouter ${path} failed: ${text}`);
	}
	return parsed;
}

function parseJsonObject<T>(content: string | null | undefined): T {
	if (!content) {
		throw new Error("OpenRouter returned an empty message.");
	}
	const trimmed = content.trim();
	const jsonMatch = /```(?:json)?\s*([\s\S]*?)\s*```/u.exec(trimmed);
	return JSON.parse(jsonMatch?.[1] ?? trimmed) as T;
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : "unknown error";
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapManifest(value: unknown, ...keys: string[]) {
	if (!isRecord(value)) {
		throw new Error("Manifest response must be a JSON object.");
	}
	for (const key of keys) {
		const nested = value[key];
		if (isRecord(nested)) {
			return nested;
		}
	}
	return value;
}

function textField(record: UnknownRecord, fieldName: string, ...keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim().length > 0) {
			return value.replaceAll(/\s+/g, " ").trim();
		}
	}
	throw new Error(`Manifest missing required string field: ${fieldName}.`);
}

function limitWords(value: string, maxWords: number) {
	const words = value.split(" ");
	if (words.length <= maxWords) {
		return value;
	}
	return `${words.slice(0, maxWords).join(" ")}.`;
}

function conciseTextField(
	record: UnknownRecord,
	fieldName: string,
	maxWords: number,
	...keys: string[]
) {
	return limitWords(textField(record, fieldName, ...keys), maxWords);
}

function numberField(record: UnknownRecord, fieldName: string, ...keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "number" && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === "string" && value.trim().length > 0) {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}
	throw new Error(`Manifest missing required number field: ${fieldName}.`);
}

function normalizeRootManifest(value: unknown): RootManifest {
	const manifest = unwrapManifest(value, "manifest", "rootManifest", "root_manifest");
	return {
		title: conciseTextField(manifest, "title", 8, "title"),
		styleBible: conciseTextField(manifest, "styleBible", 25, "styleBible", "style_bible"),
		worldState: conciseTextField(manifest, "worldState", 20, "worldState", "world_state"),
		startImagePrompt: conciseTextField(
			manifest,
			"startImagePrompt",
			45,
			"startImagePrompt",
			"start_image_prompt",
		),
		branchGoal: conciseTextField(manifest, "branchGoal", 18, "branchGoal", "branch_goal"),
		nodeCount: numberField(manifest, "nodeCount", "nodeCount", "node_count"),
	};
}

function normalizeNodeManifest(value: unknown): NodeManifest {
	const manifest = unwrapManifest(value, "manifest", "nodeManifest", "node_manifest");
	return {
		nodeTitle: conciseTextField(manifest, "nodeTitle", 7, "nodeTitle", "node_title", "title"),
		sceneState: conciseTextField(manifest, "sceneState", 18, "sceneState", "scene_state"),
		successPrompt: conciseTextField(
			manifest,
			"successPrompt",
			45,
			"successPrompt",
			"success_prompt",
		),
		failurePrompt: conciseTextField(
			manifest,
			"failurePrompt",
			45,
			"failurePrompt",
			"failure_prompt",
		),
		successOutcome: conciseTextField(
			manifest,
			"successOutcome",
			18,
			"successOutcome",
			"success_outcome",
		),
		failureOutcome: conciseTextField(
			manifest,
			"failureOutcome",
			18,
			"failureOutcome",
			"failure_outcome",
		),
		continuityNotes: conciseTextField(
			manifest,
			"continuityNotes",
			18,
			"continuityNotes",
			"continuity_notes",
		),
		nextStateIntent: conciseTextField(
			manifest,
			"nextStateIntent",
			18,
			"nextStateIntent",
			"next_state_intent",
		),
	};
}

async function fetchStructuredManifest(messages: ChatMessage[]) {
	return openRouterJson<ChatCompletionResponse>("/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			model: env.OPENROUTER_MANIFEST_MODEL,
			messages,
			temperature: 0.25,
			reasoning: { effort: "medium", summary: "concise" },
			response_format: { type: "json_object" },
			max_tokens: 1400,
		}),
	});
}

async function structuredManifest<TManifest>(
	messages: ChatMessage[],
	normalize: (value: unknown) => TManifest,
) {
	let currentMessages = messages;
	let lastError: unknown;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const response = await fetchStructuredManifest(currentMessages);
		const content = response.choices?.[0]?.message?.content;
		try {
			return {
				manifest: normalize(parseJsonObject<unknown>(content)),
				response,
				usage: response.usage,
			} satisfies ManifestResult<TManifest>;
		} catch (error) {
			lastError = error;
			currentMessages = [
				...messages,
				{
					role: "user",
					content: `Previous JSON was invalid: ${errorMessage(error)}. Return only the requested JSON object. Every required key must be present. Keep every value short and direct.`,
				},
			];
		}
	}

	throw new Error(`Invalid manifest response: ${errorMessage(lastError)}.`);
}

export async function createRootManifest(prompt: string, nodeCount: number) {
	return structuredManifest<RootManifest>(
		[
			{
				role: "system",
				content:
					"You create terse cinematic branch-video manifests for image and image-to-video models. Preserve the user's main premise exactly. Return only valid JSON with the exact requested camelCase keys.",
			},
			{
				role: "user",
				content: `Create a root manifest for a branching video generation. User prompt: ${prompt}\nNode count: ${nodeCount}\nReturn exactly these JSON keys: title, styleBible, worldState, startImagePrompt, branchGoal, nodeCount.\nRules:\n- Be direct. No long prose. No ornate adjective stacks.\n- title: 3-8 words.\n- styleBible: 1 short sentence, under 25 words.\n- worldState: 1 short sentence, under 20 words.\n- branchGoal: 1 short sentence, under 18 words.\n- startImagePrompt: 1-2 direct sentences, under 45 words.\n- Keep the user's core premise, genre, main character, objective, and world intact.\n- startImagePrompt must show one third-person first frame with the main character and immediate premise.\n- Do not show the challenge completed. Do not introduce extra protagonists, first-person POV, or premise drift.`,
			},
		],
		normalizeRootManifest,
	);
}

export async function createNodeManifest(input: {
	rootManifest: RootManifest;
	previousNodeManifests: NodeManifest[];
	nodeIndex: number;
	sourceFrameDataUrl: string;
}) {
	return structuredManifest<NodeManifest>(
		[
			{
				role: "system",
				content:
					"You write terse Seedance 2.0 image-to-video prompts. Preserve the root premise and supplied source frame exactly. Return only valid JSON with the exact requested camelCase keys.",
			},
			{
				role: "user",
				content: [
					{
						type: "text",
						text: `Root manifest: ${JSON.stringify(input.rootManifest)}\nPrevious node manifests: ${JSON.stringify(input.previousNodeManifests)}\nCurrent node index: ${input.nodeIndex}\nReturn exactly these JSON keys: nodeTitle, sceneState, successPrompt, failurePrompt, successOutcome, failureOutcome, continuityNotes, nextStateIntent.\nRules:\n- Be very direct and clean. No long descriptions. No lore dumps. No ornate adjective stacks.\n- nodeTitle: 3-7 words.\n- sceneState, successOutcome, failureOutcome, continuityNotes, nextStateIntent: each 1 short sentence, under 18 words.\n- successPrompt and failurePrompt: each 1-2 short sentences, 25-45 words total.\n- Start from the exact source image. Keep character, costume, camera, setting, lighting, and premise unchanged.\n- Third-person perspective on the main character for the whole 5-second clip.\n- One simple interaction only. No montage, cuts, time jumps, new locations, or sudden new characters.\n- Success and failure are opposite outcomes of the same immediate action.`,
					},
					{
						type: "image_url",
						image_url: { url: input.sourceFrameDataUrl, detail: "high" },
					},
				],
			},
		],
		normalizeNodeManifest,
	);
}

export async function generateStartImage(prompt: string) {
	const response = await openRouterJson<ChatCompletionResponse>("/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			model: env.OPENROUTER_IMAGE_MODEL,
			messages: [
				{
					role: "user",
					content: prompt,
				},
			],
			modalities: ["image", "text"],
			max_tokens: 1000,
		}),
	});
	const imageUrl = response.choices?.[0]?.message?.images?.[0]?.image_url?.url;
	if (!imageUrl) {
		throw new Error("OpenRouter image model did not return an image URL.");
	}
	return { imageUrl, response, usage: response.usage };
}

export async function submitSeedanceVideo(input: {
	prompt: string;
	firstFrameDataUrl: string;
	duration: number;
	resolution: string;
	generateAudio: boolean;
	seed?: number;
}) {
	const response = await openRouterJson<VideoGenerationResponse>("/videos", {
		method: "POST",
		body: JSON.stringify({
			model: env.OPENROUTER_VIDEO_MODEL,
			prompt: input.prompt,
			resolution: input.resolution,
			duration: input.duration,
			generate_audio: input.generateAudio,
			seed: input.seed,
			frame_images: [
				{
					type: "image_url",
					frame_type: "first_frame",
					image_url: { url: input.firstFrameDataUrl },
				},
			],
			provider: {
				options: {
					bytedance: { watermark: false },
				},
			},
		}),
	});
	return {
		id: response.id,
		pollingUrl: response.polling_url,
		generationId: response.generation_id,
		response,
	} satisfies VideoGenerationJob;
}

export async function waitForVideo(job: VideoGenerationJob) {
	for (let attempt = 0; attempt < 180; attempt += 1) {
		const response = await openRouterJson<VideoGenerationResponse>(`/videos/${job.id}`, {
			method: "GET",
		});
		if (response.status === "completed" || response.status === "complete") {
			return {
				jobId: job.id,
				generationId: response.generation_id ?? job.generationId,
				response,
				usage: response.usage,
			} satisfies VideoGenerationResult;
		}
		if (["failed", "cancelled", "expired"].includes(response.status)) {
			throw new Error(response.error ?? `Video generation ${job.id} ${response.status}.`);
		}
		await new Promise((resolve) => setTimeout(resolve, 3000));
	}
	throw new Error(`Video generation ${job.id} timed out.`);
}

export async function downloadVideo(jobId: string) {
	const response = await fetch(`${OPENROUTER_BASE_URL}/videos/${jobId}/content`, {
		headers: openRouterHeaders(),
	});
	if (!response.ok) {
		throw new Error(`OpenRouter video download failed: ${await response.text()}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

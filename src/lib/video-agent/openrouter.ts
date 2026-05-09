import "server-only";

import { env } from "@/env";
import type {
	ManifestResult,
	NodeManifest,
	OpenRouterUsage,
	PreviousNodeManifest,
	RootManifest,
	ShotSpec,
	VideoGenerationJob,
	VideoGenerationResult,
} from "./types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const SHOT_SPEC_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["subject", "action", "scene", "camera", "style", "lighting", "audio", "constraints"],
	properties: {
		subject: { type: "string" },
		action: { type: "string" },
		scene: { type: "string" },
		camera: { type: "string" },
		style: { type: "string" },
		lighting: { type: "string" },
		audio: { type: "string" },
		constraints: { type: "string" },
	},
} satisfies Record<string, unknown>;

const ROOT_MANIFEST_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: ["title", "styleBible", "worldState", "startImagePrompt", "branchGoal", "nodeCount"],
	properties: {
		title: { type: "string" },
		styleBible: { type: "string" },
		worldState: { type: "string" },
		startImagePrompt: { type: "string" },
		branchGoal: { type: "string" },
		nodeCount: { type: "integer" },
	},
} satisfies Record<string, unknown>;

const NODE_MANIFEST_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: [
		"nodeTitle",
		"sceneState",
		"successShot",
		"failureShot",
		"successOutcome",
		"failureOutcome",
		"continuityNotes",
		"nextStateIntent",
	],
	properties: {
		nodeTitle: { type: "string" },
		sceneState: { type: "string" },
		successShot: SHOT_SPEC_SCHEMA,
		failureShot: SHOT_SPEC_SCHEMA,
		successOutcome: { type: "string" },
		failureOutcome: { type: "string" },
		continuityNotes: { type: "string" },
		nextStateIntent: { type: "string" },
	},
} satisfies Record<string, unknown>;

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

function objectField(record: UnknownRecord, fieldName: string, ...keys: string[]) {
	for (const key of keys) {
		const value = record[key];
		if (isRecord(value)) {
			return value;
		}
	}
	throw new Error(`Manifest missing required object field: ${fieldName}.`);
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

function normalizeShotSpec(value: unknown, fieldName: string): ShotSpec {
	if (!isRecord(value)) {
		throw new Error(`Manifest field ${fieldName} must be an object.`);
	}
	return {
		subject: conciseTextField(value, `${fieldName}.subject`, 22, "subject"),
		action: conciseTextField(value, `${fieldName}.action`, 30, "action"),
		scene: conciseTextField(value, `${fieldName}.scene`, 34, "scene"),
		camera: conciseTextField(value, `${fieldName}.camera`, 26, "camera"),
		style: conciseTextField(value, `${fieldName}.style`, 22, "style"),
		lighting: conciseTextField(value, `${fieldName}.lighting`, 22, "lighting"),
		audio: conciseTextField(value, `${fieldName}.audio`, 22, "audio"),
		constraints: conciseTextField(value, `${fieldName}.constraints`, 42, "constraints"),
	};
}

function normalizeNodeManifest(value: unknown): NodeManifest {
	const manifest = unwrapManifest(value, "manifest", "nodeManifest", "node_manifest");
	return {
		nodeTitle: conciseTextField(manifest, "nodeTitle", 7, "nodeTitle", "node_title", "title"),
		sceneState: conciseTextField(manifest, "sceneState", 18, "sceneState", "scene_state"),
		successShot: normalizeShotSpec(
			objectField(manifest, "successShot", "successShot", "success_shot"),
			"successShot",
		),
		failureShot: normalizeShotSpec(
			objectField(manifest, "failureShot", "failureShot", "failure_shot"),
			"failureShot",
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

async function fetchStructuredManifest(
	messages: ChatMessage[],
	responseSchema: { name: string; schema: Record<string, unknown> },
) {
	return openRouterJson<ChatCompletionResponse>("/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			model: env.OPENROUTER_MANIFEST_MODEL,
			messages,
			temperature: 0.25,
			reasoning: { effort: "high", summary: "concise" },
			response_format: {
				type: "json_schema",
				json_schema: {
					name: responseSchema.name,
					strict: true,
					schema: responseSchema.schema,
				},
			},
			max_tokens: 2200,
		}),
	});
}

async function structuredManifest<TManifest>(
	messages: ChatMessage[],
	normalize: (value: unknown) => TManifest,
	responseSchema: { name: string; schema: Record<string, unknown> },
) {
	let currentMessages = messages;
	let lastError: unknown;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		const response = await fetchStructuredManifest(currentMessages, responseSchema);
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
					content: `Previous JSON was invalid: ${errorMessage(error)}. Return only JSON matching the schema. Every required key must be present. Keep every value short and direct.`,
				},
			];
		}
	}

	throw new Error(`Invalid manifest response: ${errorMessage(lastError)}.`);
}

export function formatSeedancePrompt(shot: ShotSpec, duration: number) {
	return [
		`Subject: ${shot.subject}`,
		`Action: ${shot.action}`,
		`Scene: ${shot.scene}`,
		`Camera: ${shot.camera}`,
		`Style: ${shot.style}`,
		`Lighting: ${shot.lighting}`,
		`Audio: ${shot.audio}`,
		`Constraints: ${shot.constraints} One continuous ${duration}-second shot. No cuts. No zoom unless explicitly requested. No sudden camera angle changes. Stay in the same scene as the source frame. Do not turn the camera around or reveal a new location. Keep character, outfit, lighting, and world layout consistent. No text overlays or HUD unless explicitly requested.`,
	].join("\n");
}

export async function createRootManifest(prompt: string, nodeCount: number, aspectRatio: string) {
	return structuredManifest<RootManifest>(
		[
			{
				role: "system",
				content:
					"You create structured cinematic video-game shot manifests for image and image-to-video models. Preserve the user's main premise exactly. Return only JSON matching the requested schema.",
			},
			{
				role: "user",
				content: `Create a root manifest for a branching cinematic video-game shot generator. User prompt: ${prompt}\nNode count: ${nodeCount}\nAspect ratio: ${aspectRatio}\nReturn exactly these JSON keys: title, styleBible, worldState, startImagePrompt, branchGoal, nodeCount.\nRules:\n- Be direct. No long prose. No ornate adjective stacks.\n- title: 3-8 words.\n- styleBible: 1 short sentence, under 25 words, defining the cinematic game look.\n- worldState: 1 short sentence, under 20 words, defining the fixed location and current game-state.\n- branchGoal: 1 short sentence, under 18 words.\n- startImagePrompt: 1-2 direct sentences, under 45 words.\n- Keep the user's core premise, genre, main character, objective, and world intact.\n- startImagePrompt must be a third-person ${aspectRatio} cinematic game frame with the main character, fixed scene, and immediate premise.\n- The scene should be spatially stable and easy to continue: clear foreground subject, readable environment, no montage.\n- Do not show the challenge completed. Do not introduce extra protagonists, first-person POV, UI, HUD, subtitles, or premise drift.`,
			},
		],
		normalizeRootManifest,
		{ name: "root_manifest", schema: ROOT_MANIFEST_SCHEMA },
	);
}

export async function createNodeManifest(input: {
	rootManifest: RootManifest;
	previousNodeManifests: PreviousNodeManifest[];
	nodeIndex: number;
	clipDuration: number;
	aspectRatio: string;
	sourceFrameDataUrl: string;
}) {
	return structuredManifest<NodeManifest>(
		[
			{
				role: "system",
				content:
					"You write structured Seedance 2.0 image-to-video shot specs for cinematic video-game clips. Preserve the root premise and supplied source frame exactly. Return only JSON matching the requested schema.",
			},
			{
				role: "user",
				content: [
					{
						type: "text",
						text: `Root manifest: ${JSON.stringify(input.rootManifest)}\nPrevious node manifests: ${JSON.stringify(input.previousNodeManifests)}\nCurrent node index: ${input.nodeIndex}\nClip duration: ${input.clipDuration} seconds\nAspect ratio: ${input.aspectRatio}\nReturn exactly these JSON keys: nodeTitle, sceneState, successShot, failureShot, successOutcome, failureOutcome, continuityNotes, nextStateIntent.\nEach shot object must contain exactly: subject, action, scene, camera, style, lighting, audio, constraints.\nRules:\n- Be very direct and clean. No long descriptions. No lore dumps. No ornate adjective stacks.\n- nodeTitle: 3-7 words.\n- sceneState, successOutcome, failureOutcome, continuityNotes, nextStateIntent: each 1 short sentence, under 18 words.\n- Start from the exact source image. Keep character, costume, setting, lighting, and premise unchanged.\n- This is a third-person cinematic video-game shot for the whole clip.\n- Keep the camera mostly fixed to the current scene. Use one stable camera instruction only, like static medium shot, slow push-in, or subtle side tracking.\n- Do not turn the camera around, reveal a new location, cut, montage, time jump, or add sudden new characters.\n- Success and failure are opposite outcomes of the same immediate action.\n- The scene field must describe the same visible location as the source frame, not a new setting.\n- The constraints field must name the most important continuity locks for this shot.`,
					},
					{
						type: "image_url",
						image_url: { url: input.sourceFrameDataUrl, detail: "high" },
					},
				],
			},
		],
		normalizeNodeManifest,
		{ name: "node_manifest", schema: NODE_MANIFEST_SCHEMA },
	);
}

export async function generateStartImage(prompt: string, aspectRatio: string) {
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
			image_config: {
				aspect_ratio: aspectRatio,
				quality: "high",
			},
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
	aspectRatio: string;
	generateAudio: boolean;
	seed?: number;
}) {
	const response = await openRouterJson<VideoGenerationResponse>("/videos", {
		method: "POST",
		body: JSON.stringify({
			model: env.OPENROUTER_VIDEO_MODEL,
			prompt: input.prompt,
			resolution: input.resolution,
			aspect_ratio: input.aspectRatio,
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

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

async function structuredManifest<TManifest>(messages: ChatMessage[]) {
	const response = await openRouterJson<ChatCompletionResponse>("/chat/completions", {
		method: "POST",
		body: JSON.stringify({
			model: env.OPENROUTER_MANIFEST_MODEL,
			messages,
			temperature: 0.35,
			reasoning: { effort: "medium", summary: "concise" },
			response_format: { type: "json_object" },
			max_tokens: 2400,
		}),
	});
	const content = response.choices?.[0]?.message?.content;
	return {
		manifest: parseJsonObject<TManifest>(content),
		response,
		usage: response.usage,
	} satisfies ManifestResult<TManifest>;
}

export async function createRootManifest(prompt: string, nodeCount: number) {
	return structuredManifest<RootManifest>([
		{
			role: "system",
			content:
				"You create concise cinematic branch-video manifests. Return only valid JSON matching the requested keys.",
		},
		{
			role: "user",
			content: `Create a root manifest for a branching video generation. User prompt: ${prompt}\nNode count: ${nodeCount}\nReturn JSON keys: title, styleBible, worldState, startImagePrompt, branchGoal, nodeCount. The startImagePrompt must be ready for GPT Image 2 and describe one vivid first frame.`,
		},
	]);
}

export async function createNodeManifest(input: {
	rootManifest: RootManifest;
	previousNodeManifests: NodeManifest[];
	nodeIndex: number;
	sourceFrameDataUrl: string;
}) {
	return structuredManifest<NodeManifest>([
		{
			role: "system",
			content:
				"You write Seedance 2.0 image-to-video prompts for success/failure branches. Preserve visual continuity from the supplied source frame. Return only valid JSON.",
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: `Root manifest: ${JSON.stringify(input.rootManifest)}\nPrevious node manifests: ${JSON.stringify(input.previousNodeManifests)}\nCurrent node index: ${input.nodeIndex}\nReturn JSON keys: nodeTitle, sceneState, successPrompt, failurePrompt, successOutcome, failureOutcome, continuityNotes, nextStateIntent. Both prompts must be self-contained Seedance 2.0 prompts, cinematic, 720p-friendly, audio-aware, and start from the exact source frame.`,
				},
				{
					type: "image_url",
					image_url: { url: input.sourceFrameDataUrl, detail: "high" },
				},
			],
		},
	]);
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

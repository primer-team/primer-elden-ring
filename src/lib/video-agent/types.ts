export type GenerationStatus = "pending" | "started" | "completed" | "failed";
export type VideoBranchKind = "success" | "failure";

export interface NodeManifest {
	nodeTitle: string;
	sceneState: string;
	successPrompt: string;
	failurePrompt: string;
	successOutcome: string;
	failureOutcome: string;
	continuityNotes: string;
	nextStateIntent: string;
}

export interface RootManifest {
	title: string;
	styleBible: string;
	worldState: string;
	startImagePrompt: string;
	branchGoal: string;
	nodeCount: number;
}

export interface OpenRouterUsage {
	prompt_tokens?: number;
	completion_tokens?: number;
	total_tokens?: number;
	cost?: number;
	[key: string]: unknown;
}

export interface ManifestResult<TManifest> {
	manifest: TManifest;
	response: Record<string, unknown>;
	usage?: OpenRouterUsage;
}

export interface VideoGenerationJob {
	id: string;
	pollingUrl: string;
	generationId?: string;
	response: Record<string, unknown>;
}

export interface VideoGenerationResult {
	jobId: string;
	generationId?: string;
	response: Record<string, unknown>;
	usage?: OpenRouterUsage;
}

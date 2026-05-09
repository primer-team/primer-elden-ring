import { assetUrl } from "./storage";

type BranchKind = "success" | "failure";

type FailureRecord = {
	message: string;
};

type BranchRecord = {
	id: string;
	kind: BranchKind;
	prompt: string;
	outcome: string;
	output: { videoPath: string } | null;
	endFrame: { framePath: string } | null;
	failures?: FailureRecord[];
};

type NodeRecord = {
	id: string;
	runId: string;
	depthIndex: number;
	status: string;
	sourceFramePath: string;
	manifest?: {
		nodeTitle: string;
		sceneState: string;
		continuityNotes: string;
		nextStateIntent: string;
	} | null;
	branches: BranchRecord[];
	failures?: FailureRecord[];
};

type GenerationRecord = {
	id: string;
	prompt: string;
	status: string;
	createdAt: Date;
	updatedAt: Date;
	settings?: {
		depth: number;
		manifestModel: string;
		imageModel: string;
		videoModel: string;
		imageAspectRatio: string;
		videoAspectRatio: string;
		videoResolution: string;
		videoDuration: number;
		generateAudio: boolean;
	} | null;
	rootManifest?: {
		title: string;
		styleBible: string;
		worldState: string;
		startImagePrompt: string;
		branchGoal: string;
		nodeCount: number;
	} | null;
	startImage?: { path: string } | null;
	failures?: FailureRecord[];
	nodes?: NodeRecord[];
};

function nullableAssetUrl(runId: string, relativePath: string | null | undefined) {
	return relativePath ? assetUrl(runId, relativePath) : null;
}

function firstFailureMessage(failures: FailureRecord[] | undefined) {
	return failures?.[failures.length - 1]?.message ?? null;
}

export function serializeGeneration(generation: GenerationRecord) {
	return {
		id: generation.id,
		prompt: generation.prompt,
		status: generation.status,
		createdAt: generation.createdAt.toISOString(),
		updatedAt: generation.updatedAt.toISOString(),
		depth: generation.settings?.depth ?? 0,
		manifestModel: generation.settings?.manifestModel ?? null,
		imageModel: generation.settings?.imageModel ?? null,
		videoModel: generation.settings?.videoModel ?? null,
		imageAspectRatio: generation.settings?.imageAspectRatio ?? null,
		videoAspectRatio: generation.settings?.videoAspectRatio ?? null,
		videoResolution: generation.settings?.videoResolution ?? null,
		videoDuration: generation.settings?.videoDuration ?? 0,
		generateAudio: generation.settings?.generateAudio ?? false,
		rootManifest: generation.rootManifest ?? null,
		startImageUrl: nullableAssetUrl(generation.id, generation.startImage?.path),
		error: firstFailureMessage(generation.failures),
		nodes: generation.nodes?.map((node) => ({
			id: node.id,
			depthIndex: node.depthIndex,
			status: node.status,
			sourceFrameUrl: nullableAssetUrl(generation.id, node.sourceFramePath),
			manifest: node.manifest ?? null,
			error: firstFailureMessage(node.failures),
			branches: node.branches.map((branch) => ({
				id: branch.id,
				kind: branch.kind,
				prompt: branch.prompt,
				outcome: branch.outcome,
				videoUrl: nullableAssetUrl(generation.id, branch.output?.videoPath),
				endFrameUrl: nullableAssetUrl(generation.id, branch.endFrame?.framePath),
				error: firstFailureMessage(branch.failures),
			})),
		})),
	};
}

export type SerializedGeneration = ReturnType<typeof serializeGeneration>;
export type SerializedNode = NonNullable<SerializedGeneration["nodes"]>[number];
export type SerializedBranch = SerializedNode["branches"][number];

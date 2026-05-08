import { RunsListClient } from "@/components/runs/runs-list-client";
import { listVideoGenerations } from "@/lib/video-agent/pipeline";
import { serializeGeneration } from "@/lib/video-agent/serialize";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
	const generations = await listVideoGenerations();
	const initialRuns = generations.map((generation) => serializeGeneration(generation));
	return <RunsListClient initialRuns={initialRuns} />;
}

import { notFound } from "next/navigation";

import { RunDetailClient } from "@/components/runs/run-detail-client";
import { getVideoGeneration } from "@/lib/video-agent/pipeline";
import { serializeGeneration } from "@/lib/video-agent/serialize";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const generation = await getVideoGeneration(id);
	if (!generation) {
		notFound();
	}
	return <RunDetailClient initialRun={serializeGeneration(generation)} />;
}

import { NextResponse } from "next/server";

import { retryVideoGeneration } from "@/lib/video-agent/pipeline";
import { serializeGeneration } from "@/lib/video-agent/serialize";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	try {
		const generation = await retryVideoGeneration(id);
		return NextResponse.json({ generation: serializeGeneration(generation) }, { status: 202 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to retry video generation.";
		const status = message === "Video generation not found." ? 404 : 400;
		return NextResponse.json({ error: message }, { status });
	}
}

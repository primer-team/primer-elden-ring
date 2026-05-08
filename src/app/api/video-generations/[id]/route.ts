import { NextResponse } from "next/server";

import { getVideoGeneration } from "@/lib/video-agent/pipeline";
import { serializeGeneration } from "@/lib/video-agent/serialize";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
	const { id } = await context.params;
	const generation = await getVideoGeneration(id);
	if (!generation) {
		return NextResponse.json({ error: "Video generation not found." }, { status: 404 });
	}
	return NextResponse.json({ generation: serializeGeneration(generation) });
}

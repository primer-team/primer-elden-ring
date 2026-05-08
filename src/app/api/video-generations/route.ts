import { NextResponse } from "next/server";
import { z } from "zod";

import { createVideoGeneration, listVideoGenerations } from "@/lib/video-agent/pipeline";
import { serializeGeneration } from "@/lib/video-agent/serialize";

export const runtime = "nodejs";

const createSchema = z.object({
	prompt: z.string().trim().min(1).max(4000),
});

export async function GET() {
	const generations = await listVideoGenerations();
	return NextResponse.json({
		generations: generations.map((generation) => serializeGeneration(generation)),
	});
}

export async function POST(request: Request) {
	const body = createSchema.parse(await request.json());
	const generation = await createVideoGeneration(body.prompt);
	return NextResponse.json({ generation: serializeGeneration(generation) }, { status: 202 });
}

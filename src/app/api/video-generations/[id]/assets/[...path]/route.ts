import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

import { resolveGenerationPath } from "@/lib/video-agent/storage";

export const runtime = "nodejs";

const MIME_TYPES: Record<string, string> = {
	".mp4": "video/mp4",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".json": "application/json",
};

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string; path: string[] }> },
) {
	const params = await context.params;
	const relativePath = params.path.join("/");
	const absolutePath = resolveGenerationPath(params.id, relativePath);
	const fileStat = await stat(absolutePath);
	const contentType =
		MIME_TYPES[path.extname(absolutePath).toLowerCase()] ?? "application/octet-stream";
	const range = request.headers.get("range");

	if (range) {
		const match = /^bytes=(\d+)-(\d*)$/u.exec(range);
		if (!match?.[1]) {
			return new NextResponse(null, { status: 416 });
		}
		const start = Number.parseInt(match[1], 10);
		const end = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;
		const stream = createReadStream(absolutePath, { start, end });
		return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
			status: 206,
			headers: {
				"Accept-Ranges": "bytes",
				"Cache-Control": "no-store",
				"Content-Length": String(end - start + 1),
				"Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
				"Content-Type": contentType,
			},
		});
	}

	const stream = createReadStream(absolutePath);
	return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
		headers: {
			"Accept-Ranges": "bytes",
			"Cache-Control": "no-store",
			"Content-Length": String(fileStat.size),
			"Content-Type": contentType,
		},
	});
}

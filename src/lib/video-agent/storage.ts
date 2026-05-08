import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const OUTPUT_ROOT = path.join(process.cwd(), "out", "video-generations");

export function generationOutputDir(generationId: string) {
	return path.join(OUTPUT_ROOT, generationId);
}

export function resolveGenerationPath(generationId: string, relativePath: string) {
	const root = generationOutputDir(generationId);
	const target = path.resolve(root, relativePath);
	if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
		throw new Error("Invalid generation asset path.");
	}
	return target;
}

export async function writeGenerationFile(
	generationId: string,
	relativePath: string,
	contents: Buffer | string,
) {
	const absolutePath = resolveGenerationPath(generationId, relativePath);
	await mkdir(path.dirname(absolutePath), { recursive: true });
	await writeFile(absolutePath, contents);
	return relativePath;
}

export async function writeDataUrlFile(
	generationId: string,
	relativePath: string,
	dataUrl: string,
) {
	const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
	if (!match?.[1] || !match[2]) {
		throw new Error("Expected a base64 data URL.");
	}
	return writeGenerationFile(generationId, relativePath, Buffer.from(match[2], "base64"));
}

export async function fileToDataUrl(absolutePath: string, mimeType: string) {
	const file = await readFile(absolutePath);
	return `data:${mimeType};base64,${file.toString("base64")}`;
}

export async function generationFileToDataUrl(
	generationId: string,
	relativePath: string,
	mimeType: string,
) {
	return fileToDataUrl(resolveGenerationPath(generationId, relativePath), mimeType);
}

export async function extractFinalFrame(
	generationId: string,
	videoRelativePath: string,
	frameRelativePath: string,
) {
	const videoPath = resolveGenerationPath(generationId, videoRelativePath);
	const framePath = resolveGenerationPath(generationId, frameRelativePath);
	await mkdir(path.dirname(framePath), { recursive: true });
	await execFileAsync("ffmpeg", [
		"-y",
		"-sseof",
		"-0.1",
		"-i",
		videoPath,
		"-frames:v",
		"1",
		framePath,
	]);
	return frameRelativePath;
}

export function assetUrl(generationId: string, relativePath: string) {
	return `/api/video-generations/${generationId}/assets/${relativePath.split(path.sep).join("/")}`;
}

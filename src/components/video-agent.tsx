"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/primer/ui/button";
import { Textarea } from "@/components/primer/ui/textarea";

interface SerializedNode {
	id: string;
	depthIndex: number;
	status: string;
	sourceFrameUrl: string | null;
	error: string | null;
	branches: SerializedBranch[];
}

interface SerializedBranch {
	id: string;
	kind: "success" | "failure";
	prompt: string;
	outcome: string;
	videoUrl: string | null;
	endFrameUrl: string | null;
	error: string | null;
}

interface SerializedGeneration {
	id: string;
	prompt: string;
	status: string;
	depth: number;
	videoModel: string | null;
	videoResolution: string | null;
	videoDuration: number;
	generateAudio: boolean;
	startImageUrl: string | null;
	error: string | null;
	nodes?: SerializedNode[];
}

function BranchVideo({
	branch,
	generateAudio,
}: {
	branch: SerializedBranch;
	generateAudio: boolean;
}) {
	const label = branch.kind === "success" ? "Success branch" : "Failure branch";

	return (
		<div className="rounded-2xl border border-border bg-card p-3">
			<div className="mb-2 flex items-center justify-between gap-3">
				<h4 className="font-medium text-sm">{label}</h4>
				<span className="rounded-full bg-muted px-2 py-1 text-muted-foreground text-xs">
					Audio {generateAudio ? "enabled" : "disabled"}
				</span>
			</div>
			{branch.videoUrl ? (
				<video
					className="aspect-video w-full rounded-xl bg-black object-contain"
					controls
					muted={false}
					playsInline
					preload="metadata"
					src={branch.videoUrl}
				>
					<track kind="captions" />
				</video>
			) : (
				<div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground text-sm">
					Waiting for Seedance clip
				</div>
			)}
			{branch.error ? <p className="mt-3 text-destructive text-xs">{branch.error}</p> : null}
			<p className="mt-3 line-clamp-4 text-muted-foreground text-xs">{branch.prompt}</p>
			<p className="mt-2 text-muted-foreground text-xs">Outcome: {branch.outcome}</p>
			{branch.endFrameUrl ? (
				<div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted/40 p-3">
					<img
						src={branch.endFrameUrl}
						alt={`${label} end frame`}
						className="h-16 w-28 rounded-lg object-cover"
					/>
					<p className="text-muted-foreground text-sm">
						This end frame feeds Gemini Pro for the next node manifest.
					</p>
				</div>
			) : null}
		</div>
	);
}

function NodePreview({ node, generateAudio }: { node: SerializedNode; generateAudio: boolean }) {
	return (
		<section className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
			<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="font-semibold text-base">Node {node.depthIndex}</h3>
					<p className="text-muted-foreground text-sm">Status: {node.status}</p>
				</div>
				{node.sourceFrameUrl ? (
					<img
						src={node.sourceFrameUrl}
						alt={`Source frame for node ${node.depthIndex}`}
						className="h-20 w-32 rounded-xl border border-border object-cover"
					/>
				) : null}
			</div>
			{node.error ? <p className="mb-3 text-destructive text-sm">{node.error}</p> : null}
			<div className="grid gap-4 lg:grid-cols-2">
				{node.branches.map((branch) => (
					<BranchVideo key={branch.id} branch={branch} generateAudio={generateAudio} />
				))}
			</div>
		</section>
	);
}

export function VideoAgent() {
	const [prompt, setPrompt] = useState("");
	const [generation, setGeneration] = useState<SerializedGeneration | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!generation || generation.status === "completed" || generation.status === "failed") {
			return;
		}

		const interval = window.setInterval(async () => {
			const response = await fetch(`/api/video-generations/${generation.id}`, {
				cache: "no-store",
			});
			if (!response.ok) {
				return;
			}
			const body = (await response.json()) as { generation: SerializedGeneration };
			setGeneration(body.generation);
		}, 3000);

		return () => window.clearInterval(interval);
	}, [generation]);

	async function startGeneration() {
		setIsSubmitting(true);
		setError(null);
		try {
			const response = await fetch("/api/video-generations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});
			const body = (await response.json()) as { generation?: SerializedGeneration; error?: string };
			if (!response.ok || !body.generation) {
				throw new Error(body.error ?? "Failed to start video generation.");
			}
			setGeneration(body.generation);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to start video generation.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<section className="border-b border-border bg-muted/30 px-4 py-8 md:px-8">
			<div className="mx-auto flex max-w-6xl flex-col gap-6">
				<div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
					<div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
						<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[var(--tracking-label)]">
							Video Generation Agent
						</p>
						<h2 className="font-semibold text-2xl tracking-tight">Seedance branching pipeline</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							Gemini 3.1 Pro Preview creates frame-aware manifests, GPT Image 2 creates the start
							image, and Seedance 2.0 renders each success/failure clip at 720p with audio.
						</p>
						<div className="mt-5 flex flex-col gap-3">
							<Textarea
								rows={5}
								placeholder="Describe the branching challenge video you want to generate..."
								value={prompt}
								onChange={(event) => setPrompt(event.target.value)}
							/>
							<Button
								disabled={isSubmitting || prompt.trim().length === 0}
								onClick={startGeneration}
							>
								{isSubmitting ? "Starting..." : "Generate video tree"}
							</Button>
							{error ? <p className="text-destructive text-sm">{error}</p> : null}
						</div>
					</div>

					<div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
						<h3 className="font-semibold text-lg">Current run</h3>
						{generation ? (
							<div className="mt-4 grid gap-4 sm:grid-cols-[180px_1fr]">
								{generation.startImageUrl ? (
									<img
										src={generation.startImageUrl}
										alt="Generated starting frame"
										className="aspect-video w-full rounded-2xl border border-border object-cover"
									/>
								) : (
									<div className="aspect-video rounded-2xl border border-dashed border-border bg-muted/50" />
								)}
								<div className="space-y-2 text-sm">
									<p>Status: {generation.status}</p>
									<p className="text-muted-foreground">Model: {generation.videoModel}</p>
									<p className="text-muted-foreground">
										{generation.videoResolution}, {generation.videoDuration}s clips, audio{" "}
										{generation.generateAudio ? "on" : "off"}
									</p>
									{generation.error ? <p className="text-destructive">{generation.error}</p> : null}
								</div>
							</div>
						) : (
							<p className="mt-4 text-muted-foreground text-sm">
								Start a run to preview each success and failure branch as it completes.
							</p>
						)}
					</div>
				</div>

				{generation?.nodes?.length ? (
					<div className="grid gap-5">
						{generation.nodes.map((node) => (
							<NodePreview key={node.id} node={node} generateAudio={generation.generateAudio} />
						))}
					</div>
				) : null}
			</div>
		</section>
	);
}

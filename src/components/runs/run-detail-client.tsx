"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/primer/ui/button";
import { relativeTime } from "@/components/runs/relative-time";
import { RunTimeline } from "@/components/runs/run-timeline";
import { StatusPill } from "@/components/runs/status-pill";
import type { SerializedGeneration } from "@/lib/video-agent/serialize";

const POLL_INTERVAL_MS = 3000;

function isLive(status: string) {
	return status === "pending" || status === "started";
}

export function RunDetailClient({ initialRun }: { initialRun: SerializedGeneration }) {
	const [run, setRun] = useState(initialRun);
	const [isRetrying, setIsRetrying] = useState(false);
	const [retryError, setRetryError] = useState<string | null>(null);

	useEffect(() => {
		if (!isLive(run.status)) return;
		let cancelled = false;
		const interval = window.setInterval(async () => {
			try {
				const response = await fetch(`/api/video-generations/${run.id}`, {
					cache: "no-store",
				});
				if (!response.ok || cancelled) return;
				const body = (await response.json()) as { generation: SerializedGeneration };
				if (!cancelled) setRun(body.generation);
			} catch {
				// next tick will retry
			}
		}, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [run.id, run.status]);

	async function retryRun() {
		setIsRetrying(true);
		setRetryError(null);
		try {
			const response = await fetch(`/api/video-generations/${run.id}/retry`, {
				method: "POST",
				cache: "no-store",
			});
			const body = (await response.json()) as {
				generation?: SerializedGeneration;
				error?: string;
			};
			if (!response.ok || !body.generation) {
				throw new Error(body.error ?? "Failed to retry workflow.");
			}
			setRun(body.generation);
		} catch (error) {
			setRetryError(error instanceof Error ? error.message : "Failed to retry workflow.");
		} finally {
			setIsRetrying(false);
		}
	}

	const nodes = run.nodes ?? [];
	const canRetry = run.status === "failed";

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
			<div>
				<Link
					href="/runs"
					className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
				>
					← All runs
				</Link>
			</div>

			<header className="rounded-3xl border border-border bg-card p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-3">
					<div className="flex-1 min-w-0">
						<div className="mb-2 flex flex-wrap items-center gap-2">
							<div className="flex items-center gap-2">
								<StatusPill status={run.status} />
								<span className="text-muted-foreground text-xs">
									Started {relativeTime(run.createdAt)}
								</span>
							</div>
							{canRetry ? (
								<Button size="sm" variant="outline" disabled={isRetrying} onClick={retryRun}>
									{isRetrying ? "Retrying..." : "Retry failed step"}
								</Button>
							) : null}
						</div>
						<h1 className="font-semibold text-xl tracking-tight">
							{run.rootManifest?.title ?? "Untitled run"}
						</h1>
						<p className="mt-1 text-foreground/80 text-sm">{run.prompt}</p>
						{run.error ? <p className="mt-2 text-destructive text-sm">{run.error}</p> : null}
						{retryError ? <p className="mt-2 text-destructive text-sm">{retryError}</p> : null}
					</div>
					{run.startImageUrl ? (
						<img
							src={run.startImageUrl}
							alt="Generated starting frame"
							className="aspect-video w-44 shrink-0 rounded-2xl border border-border object-cover"
						/>
					) : (
						<div className="aspect-video w-44 shrink-0 rounded-2xl border border-dashed border-border bg-muted/40" />
					)}
				</div>

				<dl className="mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 md:grid-cols-5">
					<div>
						<dt className="text-muted-foreground">Model</dt>
						<dd className="text-foreground/90">{run.videoModel ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Aspect</dt>
						<dd className="text-foreground/90">
							{run.imageAspectRatio && run.videoAspectRatio
								? `${run.imageAspectRatio} image / ${run.videoAspectRatio} video`
								: "—"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Resolution</dt>
						<dd className="text-foreground/90">{run.videoResolution ?? "—"}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Clip duration</dt>
						<dd className="text-foreground/90">{run.videoDuration}s</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Audio</dt>
						<dd className="text-foreground/90">{run.generateAudio ? "On" : "Off"}</dd>
					</div>
				</dl>
			</header>

			<RunTimeline nodes={nodes} generateAudio={run.generateAudio} />
		</div>
	);
}

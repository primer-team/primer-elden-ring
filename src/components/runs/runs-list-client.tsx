"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { NewRunForm } from "@/components/runs/new-run-form";
import { relativeTime } from "@/components/runs/relative-time";
import { StatusPill } from "@/components/runs/status-pill";
import type { SerializedGeneration } from "@/lib/video-agent/serialize";

const POLL_INTERVAL_MS = 5000;

function isLive(status: string) {
	return status === "pending" || status === "started";
}

function sortedNewestFirst(runs: SerializedGeneration[]) {
	return [...runs].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
}

export function RunsListClient({ initialRuns }: { initialRuns: SerializedGeneration[] }) {
	const [runs, setRuns] = useState(() => sortedNewestFirst(initialRuns));
	const hasLive = runs.some((run) => isLive(run.status));

	useEffect(() => {
		if (!hasLive) return;
		let cancelled = false;
		const interval = window.setInterval(async () => {
			try {
				const response = await fetch("/api/video-generations", { cache: "no-store" });
				if (!response.ok || cancelled) return;
				const body = (await response.json()) as { generations: SerializedGeneration[] };
				if (!cancelled) setRuns(sortedNewestFirst(body.generations));
			} catch {
				// swallow — next tick will retry
			}
		}, POLL_INTERVAL_MS);
		return () => {
			cancelled = true;
			window.clearInterval(interval);
		};
	}, [hasLive]);

	return (
		<div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:px-8">
			<NewRunForm />

			<div className="rounded-3xl border border-border bg-background p-5 shadow-sm">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="font-semibold text-lg">Recent runs</h3>
					<p className="text-muted-foreground text-xs">
						{runs.length} total{hasLive ? " · live updating" : ""}
					</p>
				</div>
				{runs.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No runs yet — start one above.
					</p>
				) : (
					<ul className="flex flex-col divide-y divide-border">
						{runs.map((run) => (
							<li key={run.id}>
								<Link
									href={`/runs/${run.id}`}
									className="flex flex-col gap-2 py-3 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4 sm:px-2"
								>
									<StatusPill status={run.status} className="shrink-0" />
									<p className="line-clamp-2 flex-1 text-sm">{run.prompt}</p>
									<p className="shrink-0 text-muted-foreground text-xs sm:text-right">
										{relativeTime(run.createdAt)}
									</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

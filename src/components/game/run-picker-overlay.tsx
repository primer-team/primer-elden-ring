"use client";

import type { CompletedRunSummary } from "@/lib/video-agent/pipeline";

interface RunPickerOverlayProps {
	runs: CompletedRunSummary[];
	currentRunId: string | null;
	heading: string;
	subheading?: string;
	onPick: (id: string) => void;
	onDismiss?: () => void;
}

export function RunPickerOverlay({
	runs,
	currentRunId,
	heading,
	subheading,
	onPick,
	onDismiss,
}: RunPickerOverlayProps) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
			<div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-zinc-950/90 p-6 text-white shadow-2xl">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h2 className="text-2xl font-semibold tracking-tight">{heading}</h2>
						{subheading ? <p className="mt-1 text-sm text-white/70">{subheading}</p> : null}
					</div>
					{onDismiss ? (
						<button
							type="button"
							onClick={onDismiss}
							className="rounded-md border border-white/15 px-3 py-1 text-sm text-white/80 transition-colors hover:bg-white/10"
						>
							Close
						</button>
					) : null}
				</div>

				{runs.length === 0 ? (
					<p className="mt-8 text-center text-sm text-white/60">
						No completed runs yet. Generate one in <span className="font-mono">/runs</span> first.
					</p>
				) : (
					<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{runs.map((run) => {
							const isCurrent = run.id === currentRunId;
							return (
								<button
									key={run.id}
									type="button"
									onClick={() => onPick(run.id)}
									className={`group flex flex-col overflow-hidden rounded-xl border text-left transition-all ${
										isCurrent
											? "border-emerald-400 ring-2 ring-emerald-400/40"
											: "border-white/10 hover:border-white/30"
									}`}
								>
									<div className="aspect-video w-full bg-black">
										{run.startImageUrl ? (
											<img
												src={run.startImageUrl}
												alt=""
												className="h-full w-full object-cover transition-transform group-hover:scale-105"
											/>
										) : (
											<div className="flex h-full w-full items-center justify-center text-xs text-white/40">
												No preview
											</div>
										)}
									</div>
									<div className="flex flex-1 flex-col gap-1 bg-zinc-900/80 p-3">
										<div className="line-clamp-2 text-sm font-medium">
											{run.title ?? run.prompt}
										</div>
										{run.title ? (
											<div className="line-clamp-2 text-xs text-white/50">{run.prompt}</div>
										) : null}
										{isCurrent ? (
											<div className="mt-1 text-xs font-semibold text-emerald-400">
												Replay this run
											</div>
										) : null}
									</div>
								</button>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}

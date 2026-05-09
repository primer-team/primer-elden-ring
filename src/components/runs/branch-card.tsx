import { cn } from "@/components/primer/ui/cn";
import type { SerializedBranch } from "@/lib/video-agent/serialize";

const KIND_STYLES = {
	success: {
		ring: "border-emerald-500/40",
		accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
		label: "Success branch",
	},
	failure: {
		ring: "border-rose-500/40",
		accent: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
		label: "Failure branch",
	},
} as const;

export function BranchCard({
	branch,
	generateAudio,
	isChosen,
}: {
	branch: SerializedBranch;
	generateAudio: boolean;
	isChosen: boolean;
}) {
	const style = KIND_STYLES[branch.kind];

	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-2xl border bg-card p-3 transition-shadow",
				style.ring,
				isChosen ? "shadow-md ring-2 ring-current/20" : "opacity-90",
			)}
		>
			<div className="flex items-center justify-between gap-3">
				<span className={cn("rounded-full px-2 py-0.5 font-medium text-xs", style.accent)}>
					{style.label}
				</span>
				<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
					Audio {generateAudio ? "on" : "off"}
				</span>
			</div>

			{branch.videoUrl ? (
				<video
					className="aspect-video w-full rounded-xl bg-black object-contain"
					controls
					playsInline
					preload="metadata"
					src={branch.videoUrl}
				>
					<track kind="captions" />
				</video>
			) : (
				<div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground text-sm">
					Waiting for clip…
				</div>
			)}

			{branch.error ? <p className="text-destructive text-xs">{branch.error}</p> : null}

			<div className="space-y-1.5 text-xs">
				<p className="line-clamp-6 whitespace-pre-line text-foreground/80">{branch.prompt}</p>
				<p className="text-muted-foreground">
					<span className="font-medium text-foreground/70">Outcome:</span> {branch.outcome}
				</p>
			</div>

			{branch.endFrameUrl ? (
				<div
					className={cn(
						"flex items-center gap-3 rounded-xl bg-muted/40 p-2",
						!isChosen && "opacity-60",
					)}
				>
					<img
						src={branch.endFrameUrl}
						alt={`${style.label} end frame`}
						className="h-12 w-20 rounded-lg object-cover"
					/>
					<p className="text-muted-foreground text-xs">
						{isChosen ? "Feeds the next node" : "End frame (path not taken)"}
					</p>
				</div>
			) : null}
		</div>
	);
}

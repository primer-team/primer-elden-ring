import { cn } from "@/components/primer/ui/cn";

type RunStatus = "pending" | "started" | "completed" | "failed" | string;

const LABELS: Record<string, string> = {
	pending: "Pending",
	started: "Running",
	completed: "Completed",
	failed: "Failed",
};

const STYLES: Record<string, string> = {
	pending: "bg-muted text-muted-foreground",
	started: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
	completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
	failed: "bg-destructive/15 text-destructive",
};

export function StatusPill({ status, className }: { status: RunStatus; className?: string }) {
	const isLive = status === "started" || status === "pending";
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
				STYLES[status] ?? "bg-muted text-muted-foreground",
				className,
			)}
		>
			{isLive ? (
				<span className="relative flex h-1.5 w-1.5">
					<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
					<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
				</span>
			) : null}
			{LABELS[status] ?? status}
		</span>
	);
}

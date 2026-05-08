import { BranchCard } from "@/components/runs/branch-card";
import { StatusPill } from "@/components/runs/status-pill";
import type { SerializedNode } from "@/lib/video-agent/serialize";

export function NodeBlock({
	node,
	chosenBranchId,
	generateAudio,
	isLast,
}: {
	node: SerializedNode;
	chosenBranchId: string | null;
	generateAudio: boolean;
	isLast: boolean;
}) {
	const success = node.branches.find((b) => b.kind === "success");
	const failure = node.branches.find((b) => b.kind === "failure");

	return (
		<div className="flex flex-col gap-4">
			<section className="rounded-3xl border border-border bg-background/70 p-4 shadow-sm">
				<div className="mb-4 grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center">
					{node.sourceFrameUrl ? (
						<img
							src={node.sourceFrameUrl}
							alt={`Source frame for node ${node.depthIndex}`}
							className="aspect-video w-full rounded-xl border border-border object-cover"
						/>
					) : (
						<div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground text-xs">
							Awaiting source frame
						</div>
					)}
					<div className="flex flex-col gap-1.5">
						<div className="flex items-center gap-2">
							<h3 className="font-semibold text-base">Node {node.depthIndex}</h3>
							<StatusPill status={node.status} />
						</div>
						{node.manifest?.nodeTitle ? (
							<p className="text-foreground/80 text-sm">{node.manifest.nodeTitle}</p>
						) : null}
						{node.manifest?.sceneState ? (
							<p className="line-clamp-2 text-muted-foreground text-xs">
								{node.manifest.sceneState}
							</p>
						) : null}
						{node.error ? <p className="text-destructive text-xs">{node.error}</p> : null}
					</div>
				</div>

				<div className="grid gap-4 lg:grid-cols-2">
					{success ? (
						<BranchCard
							branch={success}
							generateAudio={generateAudio}
							isChosen={success.id === chosenBranchId}
						/>
					) : null}
					{failure ? (
						<BranchCard
							branch={failure}
							generateAudio={generateAudio}
							isChosen={failure.id === chosenBranchId}
						/>
					) : null}
				</div>
			</section>

			{!isLast ? (
				<div className="flex justify-center">
					<div className="flex flex-col items-center text-muted-foreground">
						<span className="h-6 w-px bg-border" />
						<span className="text-xs">↓ feeds Node {node.depthIndex + 1}</span>
						<span className="h-6 w-px bg-border" />
					</div>
				</div>
			) : null}
		</div>
	);
}

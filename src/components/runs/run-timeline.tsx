import { NodeBlock } from "@/components/runs/node-block";
import type { SerializedNode } from "@/lib/video-agent/serialize";

function chosenBranchIdForNode(
	node: SerializedNode,
	nextNode: SerializedNode | undefined,
): string | null {
	if (!nextNode?.sourceFrameUrl) return null;
	const match = node.branches.find((branch) => branch.endFrameUrl === nextNode.sourceFrameUrl);
	return match?.id ?? null;
}

export function RunTimeline({
	nodes,
	generateAudio,
}: {
	nodes: SerializedNode[];
	generateAudio: boolean;
}) {
	if (nodes.length === 0) {
		return (
			<div className="rounded-3xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground text-sm">
				Waiting for the first node to start…
			</div>
		);
	}

	const sorted = [...nodes].sort((a, b) => a.depthIndex - b.depthIndex);

	return (
		<div className="flex flex-col gap-4">
			{sorted.map((node, index) => (
				<NodeBlock
					key={node.id}
					node={node}
					chosenBranchId={chosenBranchIdForNode(node, sorted[index + 1])}
					generateAudio={generateAudio}
					isLast={index === sorted.length - 1}
				/>
			))}
		</div>
	);
}

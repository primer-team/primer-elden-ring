import { GameShell } from "@/components/game/game-shell";
import { listCompletedRunSummaries } from "@/lib/video-agent/pipeline";

export const dynamic = "force-dynamic";

export default async function Page() {
	const completedRuns = await listCompletedRunSummaries();
	return <GameShell completedRuns={completedRuns} />;
}

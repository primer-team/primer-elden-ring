"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { PrimerHandle } from "@/components/primer";
import type { CompletedRunSummary } from "@/lib/video-agent/pipeline";
import type { SerializedGeneration } from "@/lib/video-agent/serialize";

import { type FeedbackFlash, GameBackground, type Playback } from "./game-background";
import { PrimerDock } from "./primer-dock";
import { RunPickerOverlay } from "./run-picker-overlay";

const FLASH_DURATION_MS = 700;

interface GameShellProps {
	completedRuns: CompletedRunSummary[];
}

export function GameShell({ completedRuns }: GameShellProps) {
	const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
	const [loadedRun, setLoadedRun] = useState<SerializedGeneration | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
	const [playback, setPlayback] = useState<Playback | null>(null);
	const [feedbackFlash, setFeedbackFlash] = useState<FeedbackFlash>(null);
	const [endOfRunPickerOpen, setEndOfRunPickerOpen] = useState(false);

	const primerRef = useRef<PrimerHandle>(null);
	const flashTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (!selectedRunId) return;
		if (loadedRun?.id === selectedRunId) return;

		let cancelled = false;
		setLoadError(null);
		(async () => {
			try {
				const response = await fetch(`/api/video-generations/${selectedRunId}`, {
					cache: "no-store",
				});
				if (!response.ok) {
					throw new Error(`Failed to load run (${response.status}).`);
				}
				const body = (await response.json()) as { generation: SerializedGeneration };
				if (cancelled) return;
				setLoadedRun(body.generation);
				setCurrentNodeIndex(0);
				setPlayback(null);
				setFeedbackFlash(null);
				setEndOfRunPickerOpen(false);
			} catch (error) {
				if (cancelled) return;
				setLoadError(error instanceof Error ? error.message : "Failed to load run.");
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [selectedRunId, loadedRun?.id]);

	useEffect(() => {
		return () => {
			if (flashTimerRef.current !== null) {
				window.clearTimeout(flashTimerRef.current);
			}
		};
	}, []);

	const triggerFeedback = useCallback(
		(kind: "success" | "failure") => {
			if (!loadedRun) return;
			const nodes = loadedRun.nodes ?? [];
			const node = nodes[currentNodeIndex];
			if (!node) return;
			const branch = node.branches.find((b) => b.kind === kind);
			if (!branch?.videoUrl) {
				if (kind === "failure") setCurrentNodeIndex(0);
				else if (currentNodeIndex < nodes.length - 1) setCurrentNodeIndex((i) => i + 1);
				else setEndOfRunPickerOpen(true);
				primerRef.current?.advance();
				return;
			}

			setFeedbackFlash(kind === "success" ? "correct" : "incorrect");

			if (flashTimerRef.current !== null) {
				window.clearTimeout(flashTimerRef.current);
			}
			flashTimerRef.current = window.setTimeout(() => {
				setFeedbackFlash(null);
				setPlayback({ kind, nodeIndex: currentNodeIndex, branchId: branch.id });
				flashTimerRef.current = null;
			}, FLASH_DURATION_MS);
		},
		[loadedRun, currentNodeIndex],
	);

	const handleVideoEnded = useCallback(
		(kind: "success" | "failure") => {
			if (!loadedRun) return;
			const nodes = loadedRun.nodes ?? [];
			setPlayback(null);

			if (kind === "failure") {
				setCurrentNodeIndex(0);
				primerRef.current?.advance();
				return;
			}

			const isLast = currentNodeIndex >= nodes.length - 1;
			if (isLast) {
				setEndOfRunPickerOpen(true);
				return;
			}

			setCurrentNodeIndex((i) => i + 1);
			primerRef.current?.advance();
		},
		[loadedRun, currentNodeIndex],
	);

	const handlePick = useCallback(
		(id: string) => {
			if (id === selectedRunId) {
				setCurrentNodeIndex(0);
				setPlayback(null);
				setFeedbackFlash(null);
				setEndOfRunPickerOpen(false);
				if (loadedRun?.id === id) {
					primerRef.current?.advance();
				}
				return;
			}
			setSelectedRunId(id);
			setLoadedRun(null);
			setEndOfRunPickerOpen(false);
			primerRef.current?.advance();
		},
		[selectedRunId, loadedRun?.id],
	);

	const showInitialPicker = !selectedRunId;
	const isReady = !!loadedRun && loadedRun.id === selectedRunId;

	return (
		<div className="relative h-[calc(100vh-65px)] w-full overflow-hidden bg-black text-white">
			{isReady ? (
				<>
					<GameBackground
						run={loadedRun}
						currentNodeIndex={currentNodeIndex}
						playback={playback}
						feedbackFlash={feedbackFlash}
						onEnded={handleVideoEnded}
					/>
					<PrimerDock
						primerRef={primerRef}
						onCorrect={() => triggerFeedback("success")}
						onIncorrect={() => triggerFeedback("failure")}
					/>
				</>
			) : null}

			{selectedRunId && !isReady && !loadError ? (
				<div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
					Loading run…
				</div>
			) : null}

			{loadError ? (
				<div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-rose-300">
					{loadError}
				</div>
			) : null}

			{showInitialPicker ? (
				<RunPickerOverlay
					runs={completedRuns}
					currentRunId={null}
					heading="Pick a run to play"
					subheading="Each completed run becomes the world. Get questions right to advance, wrong to reset."
					onPick={handlePick}
				/>
			) : null}

			{endOfRunPickerOpen ? (
				<RunPickerOverlay
					runs={completedRuns}
					currentRunId={selectedRunId}
					heading="Run complete"
					subheading="Replay this one or pick another."
					onPick={handlePick}
				/>
			) : null}
		</div>
	);
}

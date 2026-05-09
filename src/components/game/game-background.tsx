"use client";

import { useEffect, useRef } from "react";

import type { SerializedGeneration } from "@/lib/video-agent/serialize";

export type Playback = {
	kind: "success" | "failure";
	nodeIndex: number;
	branchId: string;
};

export type FeedbackFlash = "correct" | "incorrect" | null;

interface GameBackgroundProps {
	run: SerializedGeneration;
	currentNodeIndex: number;
	playback: Playback | null;
	feedbackFlash: FeedbackFlash;
	onEnded: (kind: "success" | "failure") => void;
}

export function GameBackground({
	run,
	currentNodeIndex,
	playback,
	feedbackFlash,
	onEnded,
}: GameBackgroundProps) {
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const nodes = run.nodes ?? [];
	const currentNode = nodes[currentNodeIndex] ?? nodes[0] ?? null;

	const playbackBranch = playback
		? (nodes[playback.nodeIndex]?.branches.find((b) => b.id === playback.branchId) ?? null)
		: null;
	const playbackVideoUrl = playbackBranch?.videoUrl ?? null;

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		if (!playbackVideoUrl) {
			video.pause();
			return;
		}
		video.src = playbackVideoUrl;
		video.load();
		void video.play().catch(() => undefined);
	}, [playbackVideoUrl]);

	const stillUrl = currentNode?.sourceFrameUrl ?? run.startImageUrl ?? null;

	return (
		<div className="absolute inset-0 overflow-hidden bg-black">
			{stillUrl ? (
				<img
					src={stillUrl}
					alt=""
					className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
						playbackVideoUrl ? "opacity-0" : "opacity-100"
					}`}
				/>
			) : null}
			<video
				ref={videoRef}
				className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${
					playbackVideoUrl ? "opacity-100" : "opacity-0"
				}`}
				muted
				playsInline
				preload="auto"
				onEnded={() => {
					if (playback) onEnded(playback.kind);
				}}
			>
				<track kind="captions" />
			</video>

			{feedbackFlash ? (
				<div
					className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
						feedbackFlash === "correct" ? "bg-emerald-500/30" : "bg-rose-500/30"
					}`}
				>
					<span
						className={`rounded-full px-10 py-4 text-5xl font-black uppercase tracking-widest text-white shadow-2xl ${
							feedbackFlash === "correct" ? "bg-emerald-600/90" : "bg-rose-600/90"
						}`}
					>
						{feedbackFlash === "correct" ? "Right" : "Wrong"}
					</span>
				</div>
			) : null}
		</div>
	);
}

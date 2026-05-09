"use client";

import type { FeedbackState } from "@superbuilders/primer-tives/client";
import type { Ref } from "react";

import { Primer, type PrimerHandle } from "@/components/primer";

interface PrimerDockProps {
	primerRef: Ref<PrimerHandle>;
	onCorrect: (state: FeedbackState) => void;
	onIncorrect: (state: FeedbackState) => void;
	onComplete?: () => void;
}

export function PrimerDock({ primerRef, onCorrect, onIncorrect, onComplete }: PrimerDockProps) {
	return (
		<div className="primer-dock pointer-events-auto fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-black/85 px-4 py-3 text-white shadow-2xl backdrop-blur-md [&_section]:max-w-none [&_section]:py-2">
			<Primer
				ref={primerRef}
				onCorrect={onCorrect}
				onIncorrect={onIncorrect}
				onComplete={onComplete}
			/>
		</div>
	);
}

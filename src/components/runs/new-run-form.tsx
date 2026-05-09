"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/primer/ui/button";
import { Textarea } from "@/components/primer/ui/textarea";
import type { SerializedGeneration } from "@/lib/video-agent/serialize";

export function NewRunForm() {
	const router = useRouter();
	const [prompt, setPrompt] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function startGeneration() {
		setIsSubmitting(true);
		setError(null);
		try {
			const response = await fetch("/api/video-generations", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});
			const body = (await response.json()) as {
				generation?: SerializedGeneration;
				error?: string;
			};
			if (!response.ok || !body.generation) {
				throw new Error(body.error ?? "Failed to start video generation.");
			}
			router.push(`/runs/${body.generation.id}`);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Failed to start video generation.");
			setIsSubmitting(false);
		}
	}

	return (
		<div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
			<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-[var(--tracking-label)]">
				Video Generation Agent
			</p>
			<h2 className="font-semibold text-2xl tracking-tight">Start a new run</h2>
			<p className="mt-2 text-muted-foreground text-sm">
				Gemini 3.1 Pro Preview plans fixed-scene cinematic shots, GPT Image 2 paints a 16:9 start
				frame, and Seedance 2.0 renders each 8-second branch clip.
			</p>
			<div className="mt-5 flex flex-col gap-3">
				<Textarea
					rows={5}
					placeholder="Describe the cinematic video-game challenge, main character, setting, and objective..."
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					disabled={isSubmitting}
				/>
				<div className="flex items-center gap-3">
					<Button disabled={isSubmitting || prompt.trim().length === 0} onClick={startGeneration}>
						{isSubmitting ? "Starting..." : "Generate video tree"}
					</Button>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</div>
			</div>
		</div>
	);
}

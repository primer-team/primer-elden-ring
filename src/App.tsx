"use client";

import Image from "next/image";

import { Primer } from "@/components/primer";
import { VideoAgent } from "@/components/video-agent";

export function App() {
	return (
		<div className="flex min-h-screen flex-col bg-background text-foreground">
			<header className="flex items-center gap-3 border-b border-border px-6 py-4">
				<Image
					src="/primer-blackbg-icon.png"
					alt="Primer"
					width={32}
					height={32}
					className="rounded-md"
					priority
				/>
				<span className="text-lg font-semibold tracking-tight">Primer</span>
			</header>
			<main className="flex w-full flex-1 flex-col">
				<VideoAgent />
				<Primer />
			</main>
		</div>
	);
}

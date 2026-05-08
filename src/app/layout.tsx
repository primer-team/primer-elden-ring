import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
	title: "Primer",
	description: "Adaptive learning, powered by the Primer SDK.",
	icons: { icon: "/primer-blackbg-icon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<link rel="stylesheet" href="/temml/Temml-Local.css" />
			</head>
			<body>
				<div className="flex min-h-screen flex-col bg-background text-foreground">
					<header className="flex items-center gap-6 border-b border-border px-6 py-4">
						<Link href="/" className="flex items-center gap-3">
							<Image
								src="/primer-blackbg-icon.png"
								alt="Primer"
								width={32}
								height={32}
								className="rounded-md"
								priority
							/>
							<span className="text-lg font-semibold tracking-tight">Primer</span>
						</Link>
						<nav className="flex items-center gap-4 text-sm">
							<Link
								href="/"
								className="text-muted-foreground transition-colors hover:text-foreground"
							>
								Primer
							</Link>
							<Link
								href="/runs"
								className="text-muted-foreground transition-colors hover:text-foreground"
							>
								Runs
							</Link>
						</nav>
					</header>
					<main className="flex w-full flex-1 flex-col">{children}</main>
				</div>
			</body>
		</html>
	);
}

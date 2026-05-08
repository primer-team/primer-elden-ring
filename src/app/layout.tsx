import type { Metadata } from "next";

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
			<body>{children}</body>
		</html>
	);
}

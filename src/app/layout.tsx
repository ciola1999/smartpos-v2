import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Smart POS Hybrid",
	description: "Tauri v2 + Next.js 16 Local-First",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className="dark">
			<body
				className={cn(
					"min-h-screen bg-background font-sans antialiased",
					geistSans.variable,
					geistMono.variable,
				)}
			>
				<div className="flex min-h-screen w-full">
					<Sidebar />
					<div className="flex flex-1 flex-col transition-all duration-300 md:pl-64">
						<Header />
						<main className="flex-1 p-6">{children}</main>
					</div>
				</div>
			</body>
		</html>
	);
}

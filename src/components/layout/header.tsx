"use client";

import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";
import { Bell, Menu, Search, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function Header() {
	const { toggle } = useSidebar();
	const [mounted, setMounted] = useState(false);
	const [isOnline, setIsOnline] = useState(true); // Nanti diganti real hook

	// Hydration fix (menghindari error server-client mismatch untuk tanggal/jam)
	useEffect(() => {
		setMounted(true);
		// TODO: Pasang listener window.addEventListener('online', ...) nanti di hooks
	}, []);

	return (
		<header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md transition-all sm:px-6">
			<div className="flex items-center gap-4">
				{/* Mobile Toggle Button (Hidden di Desktop) */}
				<button
					type="button"
					onClick={toggle}
					className="rounded-md p-2 text-muted-foreground hover:bg-muted lg:hidden"
					aria-label="Toggle Menu"
				>
					<Menu className="h-5 w-5" />
				</button>

				{/* Global Search Bar (Quick Action) */}
				<div className="relative hidden md:block">
					<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Cari menu, transksi (Ctrl+K)"
						className="h-9 w-64 rounded-md border bg-background pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
					/>
				</div>
			</div>

			<div className="flex items-center gap-4">
				{/* Date & Time Display (CSR Only) */}
				{mounted && (
					<div className="hidden text-right text-xs sm:block">
						<p className="font-medium text-foreground">
							{new Date().toLocaleDateString("id-ID", {
								weekday: "long",
								day: "numeric",
								month: "short",
							})}
						</p>
						<p className="text-muted-foreground">
							{new Date().toLocaleTimeString("id-ID", {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</p>
					</div>
				)}

				<div className="h-8 w-px bg-border hidden sm:block" />

				{/* Network Status Indicator */}
				<div
					className={cn(
						"flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border",
						isOnline
							? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
							: "bg-destructive/10 text-destructive border-destructive/20",
					)}
				>
					{isOnline ? (
						<>
							<Wifi className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">ONLINE</span>
						</>
					) : (
						<>
							<WifiOff className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">OFFLINE</span>
						</>
					)}
				</div>

				{/* Notifications */}
				<button
					type="button"
					className="relative rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
				>
					<Bell className="h-5 w-5" />
					<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
				</button>

				{/* User Profile / Avatar Placeholder */}
				<div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
					<span className="text-xs font-bold text-primary">AD</span>
				</div>
			</div>
		</header>
	);
}

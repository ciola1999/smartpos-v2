// src/components/providers/tauri-provider.tsx
"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { initDb } from "@/lib/db";
import { isTauri } from "@/lib/utils";

export function TauriProvider({ children }: { children: React.ReactNode }) {
	// 1. Default TRUE agar Server & Client sama-sama menampilkan Loading dulu (Mencegah Hydration Error)
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function bootstrap() {
			// Jika bukan Tauri (browser biasa), matikan loading langsung
			if (!isTauri()) {
				setIsLoading(false);
				return;
			}

			// Jika Tauri, inisialisasi DB
			try {
				await initDb();
				setIsLoading(false);
			} catch (err: unknown) {
				console.error("Failed to bootstrap database:", err);
				setError(err instanceof Error ? err.message : String(err));
				// Tetap matikan loading agar user melihat pesan error
				// atau biarkan loading false jika ingin stuck di error screen
			}
		}

		bootstrap();
	}, []);

	// 2. Logic Render yang Konsisten
	if (isLoading) {
		return (
			<div className="flex h-screen w-full flex-col items-center justify-center bg-background gap-4">
				<div className="relative flex items-center justify-center">
					<div className="absolute h-16 w-16 animate-ping rounded-full bg-primary/20" />
					<Loader2 className="h-10 w-10 animate-spin text-primary" />
				</div>
				<div className="text-center space-y-1">
					<p className="text-sm font-medium">Inisialisasi Sistem...</p>
					{error && (
						<p className="max-w-xs text-xs text-destructive font-mono bg-destructive/10 p-2 rounded border border-destructive/20">
							Error: {error}
						</p>
					)}
				</div>
			</div>
		);
	}

	return <>{children}</>;
}

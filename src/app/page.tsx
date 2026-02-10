"use client";

import { initDatabase } from "@/lib/db";
import { runMigrations } from "@/lib/migration-runner";
import { StoreService } from "@/services/store";
import { useEffect, useState } from "react";

export default function Home() {
	const [status, setStatus] = useState("Initializing...");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const initSystem = async () => {
			try {
				console.log("🔄 Initializing System...");

				// 1. LOAD DATABASE TERLEBIH DAHULU (Wajib Await)
				const { db } = await initDatabase();

				// 2. JALANKAN MIGRASI (Kirim raw 'db' yang sudah pasti ada isinya)
				const migrationResult = await runMigrations(db);

				if (migrationResult.status === "error") {
					throw new Error(migrationResult.message);
				}

				// 3. INIT DEFAULT DATA (Jika perlu)
				await StoreService.initDefault();

				setStatus("✅ SYSTEM READY");
			} catch (err: any) {
				console.error("❌ System Init Failed:", err);
				setError(String(err));
				setStatus("❌ ERROR");
			}
		};

		initSystem();
	}, []);

	// ... rest of your component (return JSX)
	if (error) {
		return (
			<div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white">
				<h1 className="text-2xl text-red-500 font-bold mb-4">CRITICAL ERROR</h1>
				<p className="p-4 border border-red-800 rounded bg-red-950/30">
					{error}
				</p>
			</div>
		);
	}

	return (
		// ... UI Dashboard Anda
		<div className="flex h-screen w-full items-center justify-center">
			<h1 className="text-xl font-bold">{status}</h1>
		</div>
	);
}

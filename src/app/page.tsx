"use client";

import { CheckCircle2, Loader2, Terminal, XCircle } from "lucide-react";
// 👇 1. Tambahkan import ini
import { initDb } from "@/lib/db";
import { runSystemSetup } from "@/lib/setup";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Page() {
	// 👇 2. Inisialisasi Router
	const router = useRouter();

	const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
		"idle",
	);
	const [message, setMessage] = useState("Booting System...");
	const [errorDetail, setErrorDetail] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;

		const bootSequence = async () => {
			if (!mounted) return;
			setStatus("loading");

			try {
				// 1. Initialize Connection
				setMessage("🔌 Connecting to Local Database...");
				await initDb();

				// 2. Run Migrations & Seeding
				setMessage("⚙️ Verifying System Integrity...");
				await new Promise((r) => setTimeout(r, 800));

				await runSystemSetup();

				if (mounted) {
					setMessage("✅ SYSTEM ONLINE");
					setStatus("ready");
				}
			} catch (e: unknown) {
				if (mounted) {
					setStatus("error");
					setMessage("❌ CRITICAL SYSTEM FAILURE");
					setErrorDetail(e instanceof Error ? e.message : String(e));
					console.error("Boot Error:", e);
				}
			}
		};

		bootSequence();

		return () => {
			mounted = false;
		};
	}, []);

	// 👇 3. Buat fungsi navigasi sederhana
	const handleLogin = () => {
		// Di sini nanti bisa ditaruh logic simpan session
		router.push("/dashboard");
	};

	return (
		<div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in zoom-in duration-500">
			{/* Header */}
			<div className="space-y-2">
				<h1 className="text-3xl font-bold tracking-tight bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
					Smart POS
				</h1>
				<p className="text-sm text-muted-foreground font-mono">
					v1.0.0 • Local-First Hybrid Architecture
				</p>
			</div>

			{/* Status Card */}
			<div
				className={cn(
					"relative flex flex-col items-center gap-4 rounded-xl border p-6 shadow-sm transition-all min-w-[320px]",
					status === "ready" && "border-green-500/20 bg-green-500/5",
					status === "error" && "border-red-500/20 bg-red-500/5",
					status === "loading" && "border-border bg-card",
				)}
			>
				{/* Icon State */}
				<div className="relative">
					{status === "loading" && (
						<Loader2 className="h-10 w-10 animate-spin text-blue-500" />
					)}
					{status === "ready" && (
						<CheckCircle2 className="h-10 w-10 text-green-500" />
					)}
					{status === "error" && <XCircle className="h-10 w-10 text-red-500" />}
				</div>

				{/* Status Message */}
				<div className="space-y-1">
					<p
						className={cn(
							"font-medium tracking-tight",
							status === "ready"
								? "text-green-500"
								: status === "error"
									? "text-red-500"
									: "text-foreground",
						)}
					>
						{message}
					</p>

					{errorDetail && (
						<div className="mt-2 rounded-md bg-destructive/10 p-2 text-xs font-mono text-destructive text-left overflow-auto max-w-[280px] max-h-[100px]">
							{errorDetail}
						</div>
					)}
				</div>

				{/* Developer Hint (Only visible when ready) */}
				{status === "ready" && (
					<div className="mt-2 flex flex-col gap-2 w-full">
						<div className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground text-left">
							<div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
								<Terminal className="h-3 w-3" />
								<span className="font-semibold">Default Credentials</span>
							</div>
							<div className="grid grid-cols-[60px_1fr] gap-1">
								<span>User:</span>{" "}
								<span className="font-mono text-foreground">admin</span>
								<span>Pass:</span>{" "}
								<span className="font-mono text-foreground">admin123</span>
							</div>
						</div>

						<button
							type="button"
							onClick={handleLogin} // 👈 4. Pasang handler di sini
							className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						>
							Masuk ke Dashboard
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

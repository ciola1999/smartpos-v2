"use client";

import { cn } from "@/lib/utils"; // Pastikan utils ada, atau hapus cn dan pakai string biasa
import {
	AlertCircle,
	ArrowDownCircle,
	ArrowUpCircle,
	CheckCircle2,
	CloudCog,
	Database,
	RefreshCw,
	Save,
	Store,
} from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
	const [activeTab, setActiveTab] = useState<"store" | "database">("database");

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight">Pengaturan</h2>
					<p className="text-muted-foreground">
						Kelola konfigurasi toko dan sinkronisasi database.
					</p>
				</div>
			</div>

			{/* TABS NAVIGATION */}
			<div className="flex items-center space-x-1 rounded-lg border bg-muted p-1 w-fit">
				<button
					type="button"
					onClick={() => setActiveTab("store")}
					className={cn(
						"flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
						activeTab === "store"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:bg-background/50",
					)}
				>
					<Store className="h-4 w-4" />
					Profil Toko
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("database")}
					className={cn(
						"flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
						activeTab === "database"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:bg-background/50",
					)}
				>
					<Database className="h-4 w-4" />
					Database & Sync
				</button>
			</div>

			{/* CONTENT AREA */}
			<div className="space-y-6">
				{activeTab === "database" ? <DatabaseSettings /> : <StoreSettings />}
			</div>
		</div>
	);
}

// --- SUB-COMPONENT: DATABASE SETTINGS (Sync Control) ---
function DatabaseSettings() {
	const [isSyncing, setIsSyncing] = useState(false);
	const [status, setStatus] = useState<"connected" | "disconnected">(
		"disconnected",
	);

	const handleManualSync = async (type: "PUSH" | "PULL") => {
		setIsSyncing(true);
		// Simulasi Sync Process
		console.log(`Starting ${type} sequence...`);
		await new Promise((r) => setTimeout(r, 2000));
		setIsSyncing(false);
		alert(`${type} Berhasil! (Simulasi)`);
	};

	return (
		<div className="grid gap-6 md:grid-cols-2">
			{/* 1. Cloud Configuration Card */}
			<div className="rounded-xl border bg-card text-card-foreground shadow-sm">
				<div className="p-6 header border-b">
					<div className="flex items-center gap-2">
						<CloudCog className="h-5 w-5 text-blue-500" />
						<h3 className="font-semibold">Cloud Connection (Supabase)</h3>
					</div>
					<p className="text-sm text-muted-foreground mt-1">
						Hubungkan database lokal dengan cloud untuk backup & multi-device.
					</p>
				</div>
				<div className="p-6 space-y-4">
					<div className="space-y-2">
						<label htmlFor="projectUrl" className="text-sm font-medium">
							Project URL
						</label>
						<input
							id="projectUrl"
							type="text"
							placeholder="https://xyz.supabase.co"
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="anonPublicKey" className="text-sm font-medium">
							Anon Public Key
						</label>
						<input
							id="anonPublicKey"
							type="password"
							placeholder="eyJh..."
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
					</div>
					<div className="pt-2">
						<button
							type="button"
							className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
						>
							<RefreshCw className="h-4 w-4" />
							Test Connection
						</button>
					</div>
				</div>
			</div>

			{/* 2. Sync Status & Actions */}
			<div className="space-y-6">
				{/* Status Card */}
				<div className="rounded-xl border bg-card p-6 shadow-sm">
					<h3 className="font-semibold mb-4">Sync Status</h3>
					<div className="flex items-center gap-4">
						<div
							className={cn(
								"flex h-12 w-12 items-center justify-center rounded-full bg-muted",
								status === "connected"
									? "bg-green-500/10 text-green-500"
									: "bg-red-500/10 text-red-500",
							)}
						>
							{status === "connected" ? <CheckCircle2 /> : <AlertCircle />}
						</div>
						<div>
							<p className="font-medium">
								{status === "connected"
									? "Terhubung ke Cloud"
									: "Offline / Lokal Mode"}
							</p>
							<p className="text-sm text-muted-foreground">
								Terakhir sync:{" "}
								<span className="font-mono text-xs">Belum pernah</span>
							</p>
						</div>
					</div>
				</div>

				{/* Action Buttons */}
				<div className="rounded-xl border bg-card p-6 shadow-sm">
					<h3 className="font-semibold mb-4">Manual Actions</h3>
					<div className="grid grid-cols-2 gap-4">
						<button
							type="button"
							onClick={() => handleManualSync("PULL")}
							disabled={isSyncing}
							className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 hover:bg-muted/50 transition-colors disabled:opacity-50"
						>
							<ArrowDownCircle
								className={cn(
									"h-6 w-6 text-orange-500",
									isSyncing && "animate-bounce",
								)}
							/>
							<span className="text-sm font-medium">Pull from Cloud</span>
							<span className="text-xs text-muted-foreground text-center">
								Timpa data lokal dengan cloud
							</span>
						</button>

						<button
							type="button"
							onClick={() => handleManualSync("PUSH")}
							disabled={isSyncing}
							className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 hover:bg-muted/50 transition-colors disabled:opacity-50"
						>
							<ArrowUpCircle
								className={cn(
									"h-6 w-6 text-blue-500",
									isSyncing && "animate-bounce",
								)}
							/>
							<span className="text-sm font-medium">Push to Cloud</span>
							<span className="text-xs text-muted-foreground text-center">
								Upload data lokal ke cloud
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// --- SUB-COMPONENT: STORE SETTINGS (Placeholder) ---
function StoreSettings() {
	return (
		<div className="rounded-xl border bg-card text-card-foreground shadow-sm">
			<div className="p-6 space-y-4">
				<h3 className="text-lg font-semibold">Informasi Toko</h3>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<label htmlFor="namaToko" className="text-sm font-medium">
							Nama Toko
						</label>
						<input
							id="namaToko"
							type="text"
							className="w-full rounded-md border p-2"
							defaultValue="My Smart Store"
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="noTelp" className="text-sm font-medium">
							No. Telepon
						</label>
						<input
							id="noTelp"
							type="text"
							className="w-full rounded-md border p-2"
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="alamat" className="text-sm font-medium">
							Alamat
						</label>
						<textarea
							id="alamat"
							className="w-full rounded-md border p-2"
							rows={3}
						/>
					</div>
				</div>
				<div className="pt-4 flex justify-end">
					<button
						type="button"
						className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						<Save className="h-4 w-4" />
						Simpan Perubahan
					</button>
				</div>
			</div>
		</div>
	);
}

"use client";

import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
	AlertCircle,
	ArrowDownCircle,
	ArrowUpCircle,
	CheckCircle2,
	CloudCog,
	Database,
	Loader2,
	RefreshCw,
	Save,
	Store,
} from "lucide-react";
import { useState } from "react";
import { useStoreSettings } from "@/hooks/use-store-settings";
import { useSyncSettings } from "@/hooks/use-sync-settings";
import { cn } from "@/lib/utils";

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
	const {
		form,
		isLoading,
		isPending,
		isSyncing,
		lastSyncAt,
		testConnection,
		saveSettings,
		handleManualSync,
	} = useSyncSettings();

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center p-12 space-y-4 rounded-xl border bg-card/50">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
				<p className="text-sm text-muted-foreground">
					Memuat konfigurasi cloud...
				</p>
			</div>
		);
	}

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
				<form onSubmit={saveSettings} className="p-6 space-y-4">
					<div className="space-y-2">
						<label htmlFor="cloudUrl" className="text-sm font-medium">
							Project URL
						</label>
						<input
							id="cloudUrl"
							{...form.register("cloudUrl")}
							type="text"
							placeholder="https://xyz.supabase.co"
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						{form.formState.errors.cloudUrl && (
							<p className="text-xs text-destructive">
								{form.formState.errors.cloudUrl.message}
							</p>
						)}
					</div>
					<div className="space-y-2">
						<label htmlFor="cloudKey" className="text-sm font-medium">
							Anon Public Key
						</label>
						<input
							id="cloudKey"
							{...form.register("cloudKey")}
							type="password"
							placeholder="eyJh..."
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
						/>
						{form.formState.errors.cloudKey && (
							<p className="text-xs text-destructive">
								{form.formState.errors.cloudKey.message}
							</p>
						)}
					</div>
					<div className="pt-2 flex items-center gap-3">
						<button
							type="submit"
							disabled={isPending}
							className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{isPending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Save className="h-4 w-4" />
							)}
							Simpan Config
						</button>
						<button
							type="button"
							onClick={testConnection}
							disabled={isPending}
							className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
						>
							<RefreshCw
								className={cn("h-4 w-4", isPending && "animate-spin")}
							/>
							Test Connection
						</button>
					</div>
				</form>
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
								lastSyncAt
									? "bg-green-500/10 text-green-500"
									: "bg-red-500/10 text-red-500",
							)}
						>
							{lastSyncAt ? <CheckCircle2 /> : <AlertCircle />}
						</div>
						<div>
							<p className="font-medium">
								{lastSyncAt ? "Cloud Activated" : "Offline / Lokal Mode"}
							</p>
							<p className="text-sm text-muted-foreground">
								Terakhir sync:{" "}
								<span className="font-mono text-xs">
									{lastSyncAt && !Number.isNaN(new Date(lastSyncAt).getTime())
										? format(new Date(lastSyncAt), "PPPp", { locale: id })
										: "Belum pernah"}
								</span>
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
								Ambil data terbaru dari cloud
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
								Kirim perubahan lokal ke cloud
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

// --- SUB-COMPONENT: STORE SETTINGS ---
function StoreSettings() {
	const { form, isLoading, isPending, onSubmit } = useStoreSettings();

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center p-12 space-y-4 rounded-xl border bg-card/50">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
				<p className="text-sm text-muted-foreground">Mengambil data toko...</p>
			</div>
		);
	}

	return (
		<form
			onSubmit={onSubmit}
			className="rounded-xl border bg-card text-card-foreground shadow-sm"
		>
			<div className="p-6 space-y-4">
				<h3 className="text-lg font-semibold">Informasi Toko</h3>
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2">
						<label htmlFor="name" className="text-sm font-medium">
							Nama Toko
						</label>
						<input
							id="name"
							{...form.register("name")}
							type="text"
							className={cn(
								"w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
								form.formState.errors.name && "border-destructive",
							)}
							placeholder="Nama Toko Anda"
						/>
						{form.formState.errors.name && (
							<p className="text-xs text-destructive">
								{form.formState.errors.name.message}
							</p>
						)}
					</div>
					<div className="space-y-2">
						<label htmlFor="phone" className="text-sm font-medium">
							No. Telepon
						</label>
						<input
							id="phone"
							{...form.register("phone")}
							type="text"
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							placeholder="08123456789"
						/>
					</div>
					<div className="space-y-2">
						<label htmlFor="email" className="text-sm font-medium">
							Email Bisnis
						</label>
						<input
							id="email"
							{...form.register("email")}
							type="email"
							className={cn(
								"w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
								form.formState.errors.email && "border-destructive",
							)}
							placeholder="admin@toko.com"
						/>
						{form.formState.errors.email && (
							<p className="text-xs text-destructive">
								{form.formState.errors.email.message}
							</p>
						)}
					</div>
					<div className="space-y-2">
						<label htmlFor="currency" className="text-sm font-medium">
							Mata Uang
						</label>
						<select
							id="currency"
							{...form.register("currency")}
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
						>
							<option value="IDR">IDR (Rupiah)</option>
							<option value="USD">USD (Dollar)</option>
						</select>
					</div>
					<div className="space-y-2 md:col-span-2">
						<label htmlFor="address" className="text-sm font-medium">
							Alamat Lengkap
						</label>
						<textarea
							id="address"
							{...form.register("address")}
							className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
							rows={3}
							placeholder="Alamat toko..."
						/>
					</div>
				</div>
				<div className="pt-4 flex justify-end">
					<button
						type="submit"
						disabled={isPending}
						className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
					>
						{isPending ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Save className="h-4 w-4" />
						)}
						{isPending ? "Menyimpan..." : "Simpan Profil Toko"}
					</button>
				</div>
			</div>
		</form>
	);
}

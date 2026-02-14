import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@libsql/client";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { StoreService } from "@/services/store.service";
import { SyncService } from "@/services/sync.service";

const cloudConfigSchema = z.object({
	cloudUrl: z.string().url("URL tidak valid").or(z.literal("")),
	cloudKey: z.string().min(10, "Key terlalu pendek").or(z.literal("")),
});

type CloudConfigValues = z.infer<typeof cloudConfigSchema>;

export function useSyncSettings() {
	const [isPending, startTransition] = useTransition();
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

	const form = useForm<CloudConfigValues>({
		resolver: zodResolver(cloudConfigSchema),
		defaultValues: {
			cloudUrl: "",
			cloudKey: "",
		},
	});

	useEffect(() => {
		async function loadSettings() {
			try {
				const settings = await StoreService.getSettings();
				if (settings) {
					form.reset({
						cloudUrl: settings.cloudUrl ?? "",
						cloudKey: settings.cloudKey ?? "",
					});
					// ✅ FIX: Ensure value is a valid Date object or null
					const syncDate = settings.lastSyncAt
						? new Date(settings.lastSyncAt)
						: null;
					setLastSyncAt(
						syncDate && !Number.isNaN(syncDate.getTime()) ? syncDate : null,
					);
				}
			} catch (error) {
				console.error("Failed to load sync settings", error);
			} finally {
				setIsLoading(false);
			}
		}
		loadSettings();
	}, [form]);

	const saveSettings = async (values: CloudConfigValues) => {
		startTransition(async () => {
			try {
				const result = await StoreService.updateSettings(values);
				if (result.success) {
					toast.success("Konfigurasi cloud disimpan");
				} else {
					toast.error("Gagal menyimpan konfigurasi");
				}
			} catch (_error) {
				toast.error("Terjadi kesalahan");
			}
		});
	};

	const testConnection = async () => {
		const { cloudUrl, cloudKey } = form.getValues();
		if (!cloudUrl || !cloudKey) {
			toast.error("URL dan Key wajib diisi untuk tes koneksi");
			return;
		}

		startTransition(async () => {
			try {
				const client = createClient({
					url: cloudUrl,
					authToken: cloudKey,
				});

				// Coba eksekusi query ringan
				await client.execute("SELECT 1");
				toast.success("Koneksi Turso (LibSQL) Berhasil!");
			} catch (error) {
				console.error("Connection test error:", error);
				toast.error("Koneksi Gagal. Periksa URL, Key, atau jaringan.");
			}
		});
	};

	const handleSync = async (type: "PUSH" | "PULL") => {
		const { cloudUrl, cloudKey } = form.getValues();
		if (!cloudUrl || !cloudKey) {
			toast.error("Konfigurasi cloud belum lengkap");
			return;
		}

		setIsSyncing(true);
		toast.info(`Memulai ${type === "PUSH" ? "Upload" : "Download"} data...`);

		try {
			let result: { count: number };
			if (type === "PUSH") {
				result = await SyncService.push(cloudUrl, cloudKey);
			} else {
				result = await SyncService.pull(cloudUrl, cloudKey);
			}

			const now = new Date();
			await StoreService.updateSettings({ lastSyncAt: now });
			setLastSyncAt(now);

			toast.success(`${type} Berhasil! (${result.count} data diperbarui)`);
		} catch (error) {
			console.error(`Sync error (${type}):`, error);
			toast.error(
				`Gagal melakukan ${type}. Periksa koneksi atau schema cloud.`,
			);
		} finally {
			setIsSyncing(false);
		}
	};

	return {
		form,
		isLoading,
		isPending,
		isSyncing,
		lastSyncAt,
		testConnection,
		saveSettings: form.handleSubmit(saveSettings),
		handleManualSync: handleSync,
	};
}

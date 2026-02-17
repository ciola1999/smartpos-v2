import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@libsql/client";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  type CloudConfigValues,
  cloudConfigSchema,
} from "@/lib/validations/settings";
import { StoreService } from "@/services/store.service";
import { SyncService } from "@/services/sync.service";

// Schema and Type imported from @/lib/validations/settings.ts

export function useSyncSettings() {
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  // ---------------------------------------------------------------------------
  // 2️⃣ FORM SETUP
  // ---------------------------------------------------------------------------

  const form = useForm<CloudConfigValues>({
    resolver: zodResolver(cloudConfigSchema),
    defaultValues: {
      cloudUrl: "",
      cloudKey: "",
    },
  });

  // ---------------------------------------------------------------------------
  // 3️⃣ LOAD SETTINGS (FROM LOCAL DB)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // 3️⃣ LOAD SETTINGS (FROM LOCAL DB)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let isMounted = true;

    const applySettings = (
      settings: NonNullable<
        Awaited<ReturnType<typeof StoreService.getSettings>>
      >,
    ) => {
      if (!isMounted) return;

      // 1. Reset Form
      form.reset({
        cloudUrl: settings.cloudUrl ?? "",
        cloudKey: settings.cloudKey ?? "",
      });

      // 2. Handle Sync Date
      if (settings.lastSyncAt) {
        const syncDate = new Date(settings.lastSyncAt);
        const isValid = !Number.isNaN(syncDate.getTime());
        setLastSyncAt(isValid ? syncDate : null);
      }
    };

    async function fetchData() {
      setIsLoading(true);
      try {
        const settings = await StoreService.getSettings();
        if (settings) {
          applySettings(settings);
        }
      } catch (error) {
        console.error("❌ [HOOK] Error loading settings:", error);
        toast.error("Gagal memuat pengaturan toko.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [form.reset]); // form.reset is stable from react-hook-form

  // ---------------------------------------------------------------------------
  // 4️⃣ ACTIONS (SAVE, TEST, SYNC)
  // ---------------------------------------------------------------------------

  const saveSettings = async (values: CloudConfigValues) => {
    startTransition(async () => {
      try {
        // Update hanya field cloud config ke DB
        const result = await StoreService.updateSettings({
          cloudUrl: values.cloudUrl,
          cloudKey: values.cloudKey,
        });

        if (result.success) {
          toast.success("Konfigurasi Cloud berhasil disimpan");
        } else {
          toast.error("Gagal menyimpan konfigurasi");
        }
      } catch (error) {
        console.error("❌ [HOOK] Save Error:", error);
        toast.error("Terjadi kesalahan sistem saat menyimpan.");
      }
    });
  };

  const testConnection = async () => {
    const { cloudUrl, cloudKey } = form.getValues();

    if (!cloudUrl || !cloudKey) {
      toast.warning("Mohon isi URL dan Key terlebih dahulu.");
      form.setFocus("cloudUrl");
      return;
    }

    startTransition(async () => {
      const toastId = toast.loading("Menguji koneksi ke Turso...");
      try {
        // Create ephemeral client untuk tes ping
        const client = createClient({ url: cloudUrl, authToken: cloudKey });

        // Simple query untuk cek autentikasi
        await client.execute("SELECT 1");

        client.close();
        toast.success("Koneksi Berhasil! Database terhubung.", { id: toastId });
      } catch (error) {
        console.error("❌ [HOOK] Connection Test Error:", error);
        toast.error("Koneksi Gagal. Periksa URL dan Auth Token.", {
          id: toastId,
        });
      }
    });
  };

  const handleManualSync = async (type: "PUSH" | "PULL") => {
    const { cloudUrl, cloudKey } = form.getValues();

    if (!cloudUrl || !cloudKey) {
      toast.error("Konfigurasi Cloud belum lengkap.");
      return;
    }

    if (isSyncing) return;

    setIsSyncing(true);
    const actionName = type === "PUSH" ? "Upload (Push)" : "Download (Pull)";
    const toastId = toast.loading(`Memulai ${actionName}...`);

    try {
      let result: { success: boolean; count: number };

      if (type === "PUSH") {
        result = await SyncService.push(cloudUrl, cloudKey);
        toast.success(`PUSH Sukses! ${result.count} data terkirim.`, {
          id: toastId,
        });
      } else {
        result = await SyncService.pull(cloudUrl, cloudKey);
        toast.success(`PULL Sukses! ${result.count} data diterima.`, {
          id: toastId,
        });
      }

      // Update Timestamp Sync Terakhir
      const now = new Date();
      await StoreService.updateSettings({ lastSyncAt: now });
      setLastSyncAt(now);
    } catch (error) {
      console.error(`❌ [HOOK] Sync Error [${type}]:`, error);
      const errMsg = error instanceof Error ? error.message : "Network Error";
      toast.error(`Gagal ${type}: ${errMsg}`, { id: toastId });
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    form,
    isLoading, // Initial loading state from DB
    isPending, // Transition state for Save/Test
    isSyncing, // Sync process state
    lastSyncAt,
    testConnection,
    saveSettings: form.handleSubmit(saveSettings),
    handleManualSync,
  };
}

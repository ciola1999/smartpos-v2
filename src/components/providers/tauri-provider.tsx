// src/components/providers/tauri-provider.tsx
"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useSessionStore } from "@/hooks/use-session-store";
import { initDb } from "@/lib/db";
import { loadSessionData, runSystemSetup } from "@/lib/setup";
import { isTauri } from "@/lib/utils";

export function TauriProvider({ children }: { children: React.ReactNode }) {
  // 1. Default TRUE agar Server & Client sama-sama menampilkan Loading dulu (Mencegah Hydration Error)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { setBranchId, setWarehouseId, setUser } = useSessionStore();

  useEffect(() => {
    async function bootstrap() {
      // Jika bukan Tauri (browser biasa), matikan loading langsung
      if (!isTauri()) {
        setIsLoading(false);
        return;
      }

      // Jika Tauri, inisialisasi DB lalu muat sesi
      try {
        // 1. Init database
        await initDb();

        // 2. Seed data default (branch, warehouse, user, dll.)
        await runSystemSetup();

        // 3. Muat data sesi dari DB → isi Zustand store
        const session = await loadSessionData();
        if (session) {
          setBranchId(session.branchId);
          setWarehouseId(session.warehouseId);
          setUser(session.userId, session.userName);
        }

        setIsLoading(false);
      } catch (err: unknown) {
        console.error("Failed to bootstrap database:", err);
        setError(err instanceof Error ? err.message : String(err));
        // Tetap matikan loading agar user melihat pesan error
        setIsLoading(false);
      }
    }

    bootstrap();
  }, [setBranchId, setWarehouseId, setUser]);

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

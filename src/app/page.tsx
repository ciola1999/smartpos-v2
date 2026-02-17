"use client";

import {
  CheckCircle2,
  Loader2,
  MonitorX,
  Terminal,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { initDb } from "@/lib/db";
import { runSystemSetup } from "@/lib/setup";
import { cn, isTauri } from "@/lib/utils";

export default function Page() {
  const router = useRouter();

  // State machine sederhana untuk boot process
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error" | "web"
  >("idle");

  const [message, setMessage] = useState("Initializing...");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function updateStatus(
      newStatus: typeof status,
      newMessage: string,
      err: unknown = null,
    ) {
      if (!mounted) return;
      setStatus(newStatus);
      setMessage(newMessage);
      if (err) {
        setErrorDetail(err instanceof Error ? err.message : String(err));
      }
    }

    const bootSequence = async () => {
      // 1. Initial Check
      if (!isTauri()) {
        updateStatus("web", "Initializing...");
        return;
      }

      try {
        // 2. Database Initialization
        await updateStatus("loading", "🔌 Connecting to Local Database...");
        await initDb();

        // 3. System Integrity Check (Artificial delay for UX)
        await updateStatus("loading", "⚙️ Verifying System Integrity...");
        await new Promise((r) => setTimeout(r, 800));

        // 4. Data Seeding
        await updateStatus("loading", "📦 Seeding Initial Data...");
        await runSystemSetup();

        // 5. Success
        await updateStatus("ready", "✅ SYSTEM ONLINE");
      } catch (e) {
        console.error("Boot Error:", e);
        await updateStatus("error", "❌ CRITICAL SYSTEM FAILURE", e);
      }
    };

    bootSequence();

    return () => {
      mounted = false;
    };
  }, []);

  const handleLogin = () => {
    router.push("/dashboard");
  };

  // ------------------------------------------------------------------
  // 🖥️ TAMPILAN KHUSUS WEB (VERCEL / BROWSER)
  // ------------------------------------------------------------------
  if (status === "web") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-zinc-950 p-8 text-center text-white animate-in fade-in zoom-in duration-500">
        <div className="mb-6 rounded-full bg-zinc-900 p-6 border border-zinc-800 shadow-xl">
          <MonitorX className="h-16 w-16 text-zinc-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-zinc-200 to-zinc-500">
          Smart POS (Web View)
        </h1>
        <p className="text-zinc-400 max-w-md mb-8 leading-relaxed">
          Aplikasi ini dirancang sebagai{" "}
          <strong>Local-First Desktop App</strong>. Database berjalan secara
          lokal di komputer pengguna untuk performa offline maksimal.
        </p>

        <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg max-w-sm backdrop-blur-sm">
          <p className="text-sm text-yellow-500 font-medium flex items-center justify-center gap-2">
            ⚠️ Mode Web Terbatas
          </p>
          <p className="text-xs text-yellow-200/60 mt-2">
            Silakan unduh installer (.exe / .dmg) untuk menjalankan aplikasi
            dengan fitur database penuh.
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // 🖥️ TAMPILAN APLIKASI DESKTOP (LOADING / READY / ERROR)
  // ------------------------------------------------------------------
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 p-8 text-center animate-in fade-in zoom-in duration-500 bg-background">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">
          Smart POS
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          v1.0.0 • Local-First Hybrid Architecture
        </p>
      </div>

      {/* Status Card */}
      <div
        className={cn(
          "relative flex flex-col items-center gap-4 rounded-xl border p-8 shadow-sm transition-all min-w-[340px] backdrop-blur-sm",
          status === "ready" && "border-green-500/20 bg-green-500/5",
          status === "error" && "border-red-500/20 bg-red-500/5",
          status === "loading" && "border-border bg-card/50",
        )}
      >
        {/* Icon State */}
        <div className="relative">
          {status === "loading" && (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          )}
          {status === "ready" && (
            <CheckCircle2 className="h-12 w-12 text-green-500 animate-in zoom-in duration-300" />
          )}
          {status === "error" && (
            <XCircle className="h-12 w-12 text-destructive animate-in shake duration-300" />
          )}
        </div>

        {/* Status Message */}
        <div className="space-y-1">
          <p
            className={cn(
              "font-semibold tracking-tight text-lg",
              status === "ready"
                ? "text-green-600 dark:text-green-400"
                : status === "error"
                  ? "text-destructive"
                  : "text-foreground",
            )}
          >
            {message}
          </p>

          {errorDetail && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-xs font-mono text-destructive text-left overflow-auto max-w-[280px] max-h-[120px] border border-destructive/20">
              {errorDetail}
            </div>
          )}
        </div>

        {/* Developer Hint & Action (Only visible when ready) */}
        {status === "ready" && (
          <div className="mt-4 flex flex-col gap-3 w-full animate-in slide-in-from-bottom-2 duration-500">
            <div className="rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground text-left shadow-xs">
              <div className="flex items-center gap-2 mb-2 border-b border-border/50 pb-2">
                <Terminal className="h-3 w-3" />
                <span className="font-semibold">Default Credentials</span>
              </div>
              <div className="grid grid-cols-[60px_1fr] gap-1">
                <span>User:</span>{" "}
                <span className="font-mono text-foreground font-medium">
                  admin
                </span>
                <span>Pass:</span>{" "}
                <span className="font-mono text-foreground font-medium">
                  admin123
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogin}
              className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              Masuk ke Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

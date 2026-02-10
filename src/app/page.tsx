"use client";

import { initDb } from "@/lib/db";
import { useEffect, useState } from "react";

export default function Page() {
  const [status, setStatus] = useState("Initializing DB...");

  useEffect(() => {
    initDb()
      .then(() => setStatus("✅ DATABASE ONLINE (SQLite Connected)"))
      .catch((e) => setStatus(`❌ DB ERROR: ${e.message}`));
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h2 className="text-xl font-bold tracking-tight">System Status</h2>
      <div className={`rounded-md border px-4 py-2 font-mono text-sm ${status.includes("✅") ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>
        {status}
      </div>
    </div>
  );
}
import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// 1️⃣ MUAT ENVIRONMENT
dotenv.config({ path: ".env" });

const DB_URL = process.env.DATABASE_TURSO_DATABASE_URL || process.env.DATABASE_URL || "file:smartpos.db";
const DB_AUTH_TOKEN = process.env.DATABASE_TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

const isTurso = DB_URL.startsWith("libsql:");

// Debugging Terminal
console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.error("📍 [DRIZZLE-KIT] DB URL: ", DB_URL);
console.error("🛠️ [DRIZZLE-KIT] Dialect:", isTurso ? "turso" : "sqlite");
if (isTurso && !DB_AUTH_TOKEN) {
  console.error("❌ [DRIZZLE-KIT] Auth Token: MISSING! Check your .env");
} else if (isTurso) {
  console.error("🔑 [DRIZZLE-KIT] Auth Token: DETECTED");
}
console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

// 2️⃣ KONFIGURASI
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  // Gunakan dialect "turso" untuk Cloud, "sqlite" untuk local file
  dialect: isTurso ? "turso" : "sqlite",
  dbCredentials: {
    url: DB_URL,
    authToken: DB_AUTH_TOKEN,
  },
  verbose: true,
  strict: true,
});
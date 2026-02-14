// src/lib/validations/settings.ts

import { z } from "zod";

// --- VALIDASI PROFIL TOKO ---
export const storeProfileSchema = z.object({
	name: z.string().min(1, "Nama toko wajib diisi"),

	// ✅ FIX: Gunakan string biasa, allow empty string
	address: z.string(),

	// ✅ FIX: Gunakan string biasa, allow empty string
	phone: z.string(),

	// ✅ FIX: Email boleh kosong atau format valid
	email: z.union([z.literal(""), z.string().email("Format email salah")]),

	currency: z.string(),
});

export type StoreProfileValues = z.infer<typeof storeProfileSchema>;

// --- VALIDASI KONEKSI CLOUD ---
export const cloudConfigSchema = z.object({
	dbUrl: z
		.string()
		.url("URL Database tidak valid (harus starts with libsql:// or https://)"),
	authToken: z.string().min(10, "Token terlalu pendek"),
});

export type CloudConfigValues = z.infer<typeof cloudConfigSchema>;

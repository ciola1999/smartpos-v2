import { eq, sql } from "drizzle-orm";
import * as schema from "@/db/schema"; // Pastikan import schema benar
import { getDb } from "@/lib/db";

// 🆔 ID Konstanta (Harus String, bukan Angka)
const STORE_ID = "STORE_MAIN";

type UpdateStoreInput = Partial<
	Pick<
		typeof schema.storeSettings.$inferSelect,
		| "name"
		| "description"
		| "address"
		| "phone"
		| "email"
		| "website"
		| "logoUrl"
		| "currency"
		| "receiptFooter"
	>
>;

export const StoreService = {
	getSettings: async () => {
		try {
			const db = getDb();
			const result = await db
				.select()
				.from(schema.storeSettings)
				// 👇 PERBAIKAN DI SINI: Gunakan string STORE_ID, bukan angka 1
				.where(eq(schema.storeSettings.id, STORE_ID))
				.limit(1);

			return result[0];
		} catch (error) {
			console.error("[StoreService.getSettings]", error);
			return undefined;
		}
	},

	updateSettings: async (input: UpdateStoreInput) => {
		const db = getDb();

		// Pastikan setting sudah ada sebelum update
		const existing = await StoreService.getSettings();
		if (!existing) {
			await StoreService.initDefault();
		}

		try {
			await db
				.update(schema.storeSettings)
				.set({
					...input,
					updatedAt: new Date(),
					version: sql`${schema.storeSettings.version} + 1`,
					syncStatus: false,
				})
				.where(eq(schema.storeSettings.id, STORE_ID));

			return { success: true };
		} catch (error) {
			console.error("[StoreService.updateSettings]", error);
			return { success: false, error: "Gagal update pengaturan toko." };
		}
	},

	initDefault: async () => {
		const db = getDb();
		const existing = await StoreService.getSettings();

		if (!existing) {
			try {
				await db.insert(schema.storeSettings).values({
					id: STORE_ID, // ✅ String
					name: "My Smart POS",
					description: "Toko default",
					address: "Alamat belum diatur",
					currency: "IDR",
					receiptFooter: "Terima kasih atas kunjungan Anda!",
					createdAt: new Date(),
					updatedAt: new Date(),
					version: 1,
					syncStatus: false,
				});
			} catch (error) {
				console.error(
					"❌ [StoreService] Failed to init default settings",
					error,
				);
			}
		}
	},
};

import { eq } from "drizzle-orm";
import { type StoreSetting, storeSettings } from "../db/schema";
import { getDb } from "../lib/db";

export const StoreService = {
	// Ambil setting toko (selalu ambil ID 1 karena single store)
	getSettings: async (): Promise<StoreSetting | undefined> => {
		const db = await getDb();
		const result = await db
			.select()
			.from(storeSettings)
			.where(eq(storeSettings.id, 1))
			.limit(1);

		return result[0];
	},

	// Init default setting jika belum ada
	initDefault: async () => {
		const db = await getDb();
		const existing = await StoreService.getSettings();

		if (!existing) {
			await db.insert(storeSettings).values({
				id: 1,
				name: "My Smart POS",
				address: "Alamat Toko Belum Diatur",
				currency: "IDR",
			});
			console.log("🏪 Default Store Settings Created");
		}
	},
};

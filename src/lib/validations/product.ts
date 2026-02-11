import { z } from "zod";

export const productSchema = z.object({
	name: z.string().min(1, "Nama produk wajib diisi"),
	// Handle empty string from select input as null
	categoryId: z
		.string()
		.optional()
		.nullable()
		.transform((val) => (val === "" ? null : val)),
	sku: z.string().optional(),
	barcode: z.string().optional(),
	// Input UI (number) -> Validasi Math -> Service terima number
	price: z.coerce.number().min(0, "Harga tidak boleh negatif"),
	stock: z.coerce.number().int().default(0),
	unit: z.string().default("pcs"),
});

export type ProductInput = z.infer<typeof productSchema>;

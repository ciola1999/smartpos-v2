import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import * as schema from "@/db/schema";

// --- 1. GENERIC HELPERS ---
// Validasi untuk memastikan string angka valid (karena kita pakai Text untuk uang)
const numericString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Must be a valid number");
const uuidv7 = z.string().uuid("Invalid UUID format");

// --- 2. AUTH & USERS ---
export const insertUserSchema = createInsertSchema(schema.users, {
  username: (schema) => schema.min(3, "Username min 3 chars"),
  password: (schema) => schema.min(6, "Password min 6 chars"), // Plaintext length check
  role: z.enum(["admin", "cashier"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  syncStatus: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username required"),
  password: z.string().min(1, "Password required"),
});

// --- 3. PRODUCTS (CATALOG) ---
export const insertProductSchema = createInsertSchema(schema.products, {
  name: (schema) => schema.min(1, "Product name required"),
  price: numericString,
  costPrice: numericString,
  minStock: z.number().nonnegative(),
  stock: z.number().int(), // Bisa negatif jika oversold, tapi idealnya dicegah
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  syncStatus: true,
});

// --- 4. INGREDIENTS & RECIPES ---
export const insertIngredientSchema = createInsertSchema(schema.ingredients, {
  name: (schema) => schema.min(1, "Ingredient name required"),
  costPerUnit: numericString,
  // Nutrition validation (optional but good sanity check)
  protein: z.number().nonnegative().optional(),
  sugar: z.number().nonnegative().optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  syncStatus: true,
});

export const insertRecipeSchema = createInsertSchema(schema.productRecipes, {
  quantity: z.number().positive("Quantity must be > 0"),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  syncStatus: true,
});

// Composite Schema: Product + Recipes (untuk Form "Create Menu")
export const createMenuSchema = insertProductSchema.extend({
  recipeItems: z
    .array(
      z.object({
        ingredientId: uuidv7,
        quantity: z.number().positive(),
      }),
    )
    .optional(),
});

// --- 5. ORDERS (TRANSACTION) ---
export const insertOrderSchema = createInsertSchema(schema.orders, {
  amountPaid: numericString,
  totalAmount: numericString,
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  syncStatus: true,
  // Field snapshot diisi otomatis oleh Backend/Service, bukan input user
  taxNameSnapshot: true,
  taxRateSnapshot: true,
  change: true,
});

export const insertOrderItemSchema = createInsertSchema(schema.orderItems).omit(
  {
    id: true,
    // Snapshot di-handle system
    productNameSnapshot: true,
    skuSnapshot: true,
    priceAtTime: true,
    costPriceAtTime: true,
  },
);

// Payload Cart dari Frontend ke Backend
export const checkoutPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        productId: uuidv7,
        quantity: z.number().int().positive(),
        // Price dikirim dari frontend sebagai referensi, tapi backend wajib re-verify
        price: z.number().nonnegative(),
      }),
    )
    .min(1, "Cart cannot be empty"),

  memberId: uuidv7.optional().nullable(),
  discountId: uuidv7.optional().nullable(),
  paymentMethod: z.enum(["cash", "debit", "qris", "split"]),
  amountPaid: z.string(), // Input user (misal: "50000")

  orderType: z.enum(["dine_in", "take_away"]),
  tableNumber: z.string().optional(),
});

// --- 6. TYPES INFERENCE ---
// TypeScript otomatis tau tipe data dari validasi di atas
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type CreateMenuPayload = z.infer<typeof createMenuSchema>;
export type CheckoutPayload = z.infer<typeof checkoutPayloadSchema>;

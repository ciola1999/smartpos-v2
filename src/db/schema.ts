import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// --- 1. SHARED HELPERS (DRY & CONSTISTENCY) ---

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(strftime('%s', 'now') * 1000)`)
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .default(sql`(strftime('%s', 'now') * 1000)`)
    .$onUpdate(() => new Date())
    .notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
};

// Kolom wajib untuk Sync Engine (Turso <-> Local)
const syncColumns = {
  version: integer("version").default(1).notNull(), // Optimistic Concurrency Control
  syncStatus: integer("sync_status", { mode: "boolean" })
    .default(false)
    .notNull(), // false = dirty/local, true = synced
};

// --- 2. CORE TABLES ---

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(), // UUID v7
    name: text("name").notNull(),
    username: text("username").unique().notNull(),
    email: text("email").unique(),
    password: text("password").notNull(),
    role: text("role", { enum: ["admin", "cashier"] })
      .default("cashier")
      .notNull(),
    avatarUrl: text("avatar_url").default(""),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    usernameIdx: index("users_username_idx").on(table.username),
  }),
);

export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").unique().notNull(),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    slugIdx: index("categories_slug_idx").on(table.slug),
  }),
);

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    barcode: text("barcode").unique(),
    sku: text("sku").unique(),

    // 💰 Money Handling: Selalu gunakan String/Text untuk menghindari floating point error
    price: text("price").notNull().default("0"),
    costPrice: text("cost_price").notNull().default("0"),

    stock: real("stock").notNull().default(0),
    minStock: real("min_stock").notNull().default(0),
    unit: text("unit").default("pcs"),

    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),

    // 🔥 Logic Inventory: Jika true, stok diambil dari ingredients
    hasRecipe: integer("has_recipe", { mode: "boolean" })
      .default(false)
      .notNull(),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    nameIdx: index("product_name_idx").on(table.name),
    categoryIdx: index("product_category_idx").on(table.categoryId),
    activeIdx: index("product_active_idx").on(table.isActive),
    barcodeIdx: index("product_barcode_idx").on(table.barcode), // Penting untuk scan barcode
  }),
);

// --- 3. INGREDIENTS & RECIPES (RECIPE ENGINE) ---

export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    unit: text("unit").default("gr"),
    stock: real("stock").notNull().default(0),
    minStock: real("min_stock").notNull().default(0),
    costPerUnit: text("cost_per_unit").default("0"),

    // Nutrition Facts (Optional)
    calories: real("calories").default(0),
    protein: real("protein").default(0),
    carbohydrates: real("carbs").default(0),
    sugar: real("sugar").default(0),
    fat: real("fat").default(0),
    sodium: real("sodium").default(0),

    isGlutenFree: integer("is_gluten_free", { mode: "boolean" }).default(true),
    containsDairy: integer("contains_dairy", { mode: "boolean" }).default(
      false,
    ),
    containsNuts: integer("contains_nuts", { mode: "boolean" }).default(false),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    nameIdx: index("ingredient_name_idx").on(table.name),
  }),
);

export const productRecipes = sqliteTable(
  "product_recipes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    ingredientId: text("ingredient_id")
      .references(() => ingredients.id, { onDelete: "restrict" })
      .notNull(),

    quantity: real("quantity").notNull(), // Jumlah pemakaian (misal: 15gr)

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    productIdx: index("recipe_product_idx").on(table.productId),
  }),
);

// --- 4. SALES & LOGS ---

export const members = sqliteTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").unique().notNull(),
  email: text("email"),
  points: integer("points").default(0),
  tier: text("tier").default("Silver"),
  ...timestamps,
  ...syncColumns,
});

export const discounts = sqliteTable("discounts", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["PERCENTAGE", "FIXED"] }).notNull(),
  value: text("value").notNull(),
  startDate: integer("start_date", { mode: "timestamp" }),
  endDate: integer("end_date", { mode: "timestamp" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

export const taxes = sqliteTable("taxes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  rate: text("rate").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    memberId: text("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    discountId: text("discount_id").references(() => discounts.id, {
      onDelete: "set null",
    }),
    cashierId: text("cashier_id").references(() => users.id),

    // Financial Snapshots (Penting untuk audit)
    subtotal: text("subtotal").notNull().default("0"),
    discountAmount: text("discount_amount").default("0"),
    taxAmount: text("tax_amount").default("0"),
    totalAmount: text("total_amount").notNull(),

    taxNameSnapshot: text("tax_name_snapshot"),
    taxRateSnapshot: text("tax_rate_snapshot"),

    orderType: text("order_type", { enum: ["dine_in", "take_away"] })
      .default("dine_in")
      .notNull(),
    paymentMethod: text("payment_method", {
      enum: ["cash", "debit", "qris", "split"],
    })
      .notNull()
      .default("cash"),

    amountPaid: text("amount_paid").notNull(),
    change: text("change").notNull().default("0"),

    tableNumber: text("table_number"),
    customerName: text("customer_name"),
    queueNumber: integer("queue_number").notNull().default(1),

    status: text("status", {
      enum: ["pending", "completed", "cancelled"],
    }).default("pending"),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    createdAtIdx: index("order_created_at_idx").on(table.createdAt),
    statusIdx: index("order_status_idx").on(table.status),
    memberIdx: index("order_member_idx").on(table.memberId),
  }),
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null", // Keep history even if product deleted
    }),

    // Snapshot Data (Wajib ada jika produk master berubah harga/nama)
    productNameSnapshot: text("product_name_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    quantity: integer("quantity").notNull(),
    priceAtTime: text("price_at_time").notNull(),
    costPriceAtTime: text("cost_price_at_time").default("0"),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    orderIdIdx: index("order_item_order_idx").on(table.orderId),
    productIdIdx: index("order_item_product_idx").on(table.productId),
  }),
);

export const orderPayments = sqliteTable("order_payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id")
    .references(() => orders.id, { onDelete: "cascade" })
    .notNull(),
  paymentMethod: text("payment_method").notNull(),
  amount: text("amount").notNull(),
  referenceId: text("reference_id"), // No. Ref EDC / Transfer
  ...timestamps,
  ...syncColumns,
});

export const inventoryLogs = sqliteTable(
  "inventory_logs",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").references(() => products.id),
    ingredientId: text("ingredient_id").references(() => ingredients.id),

    changeAmount: real("change_amount").notNull(), // Negatif = Keluar, Positif = Masuk
    finalStock: real("final_stock").notNull(),

    type: text("type", {
      enum: ["sale", "restock", "correction", "damage", "void"],
    }).notNull(),

    note: text("note"),
    referenceId: text("reference_id"), // Bisa ID Order atau ID Restock
    userId: text("user_id").references(() => users.id),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    productIdx: index("inv_log_product_idx").on(table.productId),
    ingredientIdx: index("inv_log_ingredient_idx").on(table.ingredientId),
    createdAtIdx: index("inv_log_date_idx").on(table.createdAt),
  }),
);

export const shifts = sqliteTable("shifts", {
  id: text("id").primaryKey(),
  cashierId: text("cashier_id")
    .references(() => users.id)
    .notNull(),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp" }),

  startCash: text("start_cash").notNull(),
  expectedEndCash: text("expected_end_cash"),
  actualEndCash: text("actual_end_cash"),
  difference: text("difference"), // Selisih

  status: text("status", { enum: ["open", "closed"] }).default("open"),
  ...timestamps,
  ...syncColumns,
});

export const storeSettings = sqliteTable("store_settings", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("Smart POS Store"),
  description: text("description"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  logoUrl: text("logo_url"),
  currency: text("currency").default("IDR"),
  receiptFooter: text("receipt_footer").default(
    "Terima kasih atas kunjungan Anda!",
  ),

  // ☁️ Cloud Sync Config (Turso Integration)
  cloudUrl: text("cloud_url"),
  cloudKey: text("cloud_key"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp" }),

  ...timestamps,
  ...syncColumns,
});

// --- 5. RELATIONS (DRY & CONNECTED) ---

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  recipes: many(productRecipes),
  inventoryLogs: many(inventoryLogs),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  usedIn: many(productRecipes),
  logs: many(inventoryLogs), // Added: Relasi balik ke logs
}));

export const productRecipesRelations = relations(productRecipes, ({ one }) => ({
  product: one(products, {
    fields: [productRecipes.productId],
    references: [products.id],
  }),
  ingredient: one(ingredients, {
    fields: [productRecipes.ingredientId],
    references: [ingredients.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  shifts: many(shifts),
  inventoryLogs: many(inventoryLogs),
}));

export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  payments: many(orderPayments),
  cashier: one(users, {
    fields: [orders.cashierId],
    references: [users.id],
  }),
  member: one(members, {
    fields: [orders.memberId],
    references: [members.id],
  }),
  discount: one(discounts, {
    fields: [orders.discountId],
    references: [discounts.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const orderPaymentsRelations = relations(orderPayments, ({ one }) => ({
  order: one(orders, {
    fields: [orderPayments.orderId],
    references: [orders.id],
  }),
}));

export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  product: one(products, {
    fields: [inventoryLogs.productId],
    references: [products.id],
  }),
  ingredient: one(ingredients, {
    fields: [inventoryLogs.ingredientId],
    references: [ingredients.id],
  }),
  user: one(users, {
    fields: [inventoryLogs.userId],
    references: [users.id],
  }),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  cashier: one(users, {
    fields: [shifts.cashierId],
    references: [users.id],
  }),
}));

// --- 6. TYPE EXPORTS (STRICT INFERENCE) ---

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;

export type ProductRecipe = typeof productRecipes.$inferSelect;
export type NewProductRecipe = typeof productRecipes.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderPayment = typeof orderPayments.$inferSelect;
export type NewOrderPayment = typeof orderPayments.$inferInsert;

export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type NewInventoryLog = typeof inventoryLogs.$inferInsert;

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;

export type Tax = typeof taxes.$inferSelect;
export type NewTax = typeof taxes.$inferInsert;

export type StoreSetting = typeof storeSettings.$inferSelect;
export type NewStoreSetting = typeof storeSettings.$inferInsert;

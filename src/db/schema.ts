import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// --- HELPERS ---
// Timestamp otomatis (Epoch Seconds) compatible dengan SQLite & Tauri
const timestamps = {
	createdAt: integer("created_at", { mode: "timestamp" })
		.default(sql`(strftime('%s', 'now'))`)
		.notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(strftime('%s', 'now'))`)
		.$onUpdate(() => new Date())
		.notNull(),
	deletedAt: integer("deleted_at", { mode: "timestamp" }), // Soft Delete support
};

// --- USERS ---
export const users = sqliteTable("users", {
	id: text("id").primaryKey(), // UUID v7
	name: text("name").notNull(),
	username: text("username").unique().notNull(),
	password: text("password").notNull(), // Hashed
	role: text("role", { enum: ["admin", "cashier"] })
		.default("cashier")
		.notNull(),
	avatarUrl: text("avatar_url"),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	...timestamps,
});

// --- CATEGORIES ---
export const categories = sqliteTable("categories", {
	id: text("id").primaryKey(), // UUID v7
	name: text("name").notNull(),
	description: text("description"),
	// Slug bisa digenerate dari name di frontend/backend
	slug: text("slug").unique().notNull(),
	...timestamps,
});

// --- PRODUCTS ---
export const products = sqliteTable("products", {
	id: text("id").primaryKey(), // UUID v7
	categoryId: text("category_id").references(() => categories.id, {
		onDelete: "set null",
	}),
	name: text("name").notNull(),
	description: text("description"),
	imageUrl: text("image_url"),
	barcode: text("barcode").unique(), // Scan barcode
	sku: text("sku").unique(),

	// 💰 MONEY: Text untuk presisi (Big.js / Dinero.js ready)
	price: text("price").notNull().default("0"),
	costPrice: text("cost_price").notNull().default("0"),

	stock: integer("stock").notNull().default(0),
	minStock: integer("min_stock").notNull().default(5),
	unit: text("unit").default("pcs"),
	isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
	...timestamps,
});

// --- MEMBERS ---
export const members = sqliteTable("members", {
	id: text("id").primaryKey(), // UUID v7
	name: text("name").notNull(),
	phone: text("phone").unique().notNull(),
	email: text("email"),
	points: integer("points").default(0),
	tier: text("tier").default("Silver"),
	...timestamps,
});

// --- DISCOUNTS ---
export const discounts = sqliteTable("discounts", {
	id: text("id").primaryKey(), // UUID v7
	code: text("code").unique().notNull(),
	name: text("name").notNull(),
	type: text("type", { enum: ["PERCENTAGE", "FIXED"] }).notNull(),
	value: text("value").notNull(),
	startDate: integer("start_date", { mode: "timestamp" }),
	endDate: integer("end_date", { mode: "timestamp" }),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	...timestamps,
});

// --- TAXES ---
export const taxes = sqliteTable("taxes", {
	id: text("id").primaryKey(), // UUID v7
	name: text("name").notNull(),
	rate: text("rate").notNull(), // "0.11"
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	...timestamps,
});

// --- ORDERS ---
export const orders = sqliteTable("orders", {
	id: text("id").primaryKey(), // UUID v7
	memberId: text("member_id").references(() => members.id, {
		onDelete: "set null",
	}),
	discountId: text("discount_id").references(() => discounts.id, {
		onDelete: "set null",
	}),
	cashierId: text("cashier_id").references(() => users.id),

	// 💰 FINANCIAL DATA
	subtotal: text("subtotal").notNull().default("0"),
	discountAmount: text("discount_amount").default("0"),
	taxAmount: text("tax_amount").default("0"),
	totalAmount: text("total_amount").notNull(),

	// 📸 SNAPSHOTS (Immutable History - Anti Perubahan Harga)
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

	// Data Antrian / Meja
	tableNumber: text("table_number"),
	customerName: text("customer_name"),
	customerPhone: text("customer_phone"),
	queueNumber: integer("queue_number").notNull().default(1),

	status: text("status", {
		enum: ["pending", "completed", "cancelled"],
	}).default("pending"),
	...timestamps,
});

// --- ORDER ITEMS ---
export const orderItems = sqliteTable("order_items", {
	id: text("id").primaryKey(), // UUID v7
	orderId: text("order_id")
		.references(() => orders.id, { onDelete: "cascade" })
		.notNull(),
	productId: text("product_id").references(() => products.id, {
		onDelete: "set null",
	}),

	// Snapshot Data Produk saat transaksi terjadi
	productNameSnapshot: text("product_name_snapshot").notNull(),
	skuSnapshot: text("sku_snapshot"),

	quantity: integer("quantity").notNull(),

	// 💰 PRICE AT TIME (Penting untuk laporan laba rugi akurat)
	priceAtTime: text("price_at_time").notNull(),
	costPriceAtTime: text("cost_price_at_time").default("0"),
});

// --- ORDER PAYMENTS (Untuk Split Payment) ---
export const orderPayments = sqliteTable("order_payments", {
	id: text("id").primaryKey(), // UUID v7
	orderId: text("order_id")
		.references(() => orders.id, { onDelete: "cascade" })
		.notNull(),
	paymentMethod: text("payment_method").notNull(),
	amount: text("amount").notNull(),
	referenceId: text("reference_id"), // No. Ref EDC / TRX ID QRIS
	...timestamps,
});

// --- STORE SETTINGS ---
export const storeSettings = sqliteTable("store_settings", {
	id: text("id").primaryKey(), // UUID v7
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
	...timestamps,
});

// --- RELATIONS ---
export const categoriesRelations = relations(categories, ({ many }) => ({
	products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
	category: one(categories, {
		fields: [products.categoryId],
		references: [categories.id],
	}),
	orderItems: many(orderItems),
}));

export const usersRelations = relations(users, ({ many }) => ({
	orders: many(orders),
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

// --- TYPES EXPORT ---
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderPayment = typeof orderPayments.$inferSelect;

export type Member = typeof members.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type Tax = typeof taxes.$inferSelect;
export type StoreSetting = typeof storeSettings.$inferSelect;

import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// --- HELPERS ---
// Fungsi timestamp otomatis untuk SQLite
const timestamp = (name: string) =>
	integer(name, { mode: "timestamp" }).default(sql`(unixepoch())`).notNull();

// --- USERS ---
export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	username: text("username").unique().notNull(),
	password: text("password").notNull(),
	role: text("role", { enum: ["admin", "cashier"] })
		.default("cashier")
		.notNull(),
	avatarUrl: text("avatar_url"),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	createdAt: timestamp("created_at"),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
});

// --- CATEGORIES ---
export const categories = sqliteTable("categories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	description: text("description"),
	slug: text("slug").unique().notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
});

// --- PRODUCTS ---
export const products = sqliteTable("products", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	categoryId: integer("category_id").references(() => categories.id, {
		onDelete: "set null",
	}),
	name: text("name").notNull(),
	description: text("description"),
	imageUrl: text("image_url"),
	barcode: text("barcode").unique(),
	sku: text("sku").unique(),
	// 💰 MONEY: Disimpan sebagai TEXT agar presisi desimal 100% terjaga di SQLite
	price: text("price").notNull().default("0"),
	costPrice: text("cost_price").notNull().default("0"),
	stock: integer("stock").notNull().default(0),
	minStock: integer("min_stock").notNull().default(5),
	isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
});

// --- MEMBERS ---
export const members = sqliteTable("members", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	phone: text("phone").unique().notNull(),
	email: text("email"),
	points: integer("points").default(0),
	tier: text("tier").default("Silver"), // Logic tier diurus di aplikasi
	createdAt: timestamp("created_at"),
});

// --- DISCOUNTS ---
export const discounts = sqliteTable("discounts", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	code: text("code").unique().notNull(),
	name: text("name").notNull(),
	type: text("type", { enum: ["PERCENTAGE", "FIXED"] }).notNull(),
	value: text("value").notNull(), // Bisa persen (0.1) atau nominal (10000)
	startDate: integer("start_date", { mode: "timestamp" }),
	endDate: integer("end_date", { mode: "timestamp" }),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
});

// --- TAXES ---
export const taxes = sqliteTable("taxes", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	rate: text("rate").notNull(), // Contoh: "0.11" untuk 11%
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	createdAt: timestamp("created_at"),
});

// --- ORDERS ---
export const orders = sqliteTable("orders", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	memberId: integer("member_id").references(() => members.id, {
		onDelete: "set null",
	}),
	discountId: integer("discount_id").references(() => discounts.id, {
		onDelete: "set null",
	}),
	cashierId: integer("cashier_id").references(() => users.id),

	// 💰 FINANCIAL DATA
	subtotal: text("subtotal").notNull().default("0"),
	discountAmount: text("discount_amount").default("0"),
	taxAmount: text("tax_amount").default("0"),
	totalAmount: text("total_amount").notNull(),

	// 📸 SNAPSHOTS (Immutable History)
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
	customerPhone: text("customer_phone"),
	queueNumber: integer("queue_number").notNull().default(1),
	createdAt: timestamp("created_at"),
});

// --- ORDER ITEMS ---
export const orderItems = sqliteTable("order_items", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	orderId: integer("order_id")
		.references(() => orders.id, { onDelete: "cascade" })
		.notNull(),
	productId: integer("product_id").references(() => products.id, {
		onDelete: "set null",
	}),

	productNameSnapshot: text("product_name_snapshot").notNull(),
	skuSnapshot: text("sku_snapshot"),
	quantity: integer("quantity").notNull(),

	// 💰 PRICE AT TIME (Penting untuk laporan laba rugi akurat)
	priceAtTime: text("price_at_time").notNull(),
	costPriceAtTime: text("cost_price_at_time").default("0"),
});

// --- ORDER PAYMENTS ---
export const orderPayments = sqliteTable("order_payments", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	orderId: integer("order_id")
		.references(() => orders.id, { onDelete: "cascade" })
		.notNull(),
	paymentMethod: text("payment_method").notNull(),
	amount: text("amount").notNull(),
	referenceId: text("reference_id"),
	createdAt: timestamp("created_at"),
});

// --- STORE SETTINGS ---
export const storeSettings = sqliteTable("store_settings", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().default("Toko Saya"),
	description: text("description"),
	address: text("address"),
	phone: text("phone"),
	email: text("email"),
	website: text("website"),
	logoUrl: text("logo_url"),
	currency: text("currency").default("IDR"),
	receiptFooter: text("receipt_footer").default("Terima kasih!"),
	createdAt: timestamp("created_at"),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date()),
});

// --- RELATIONS (Sama seperti sebelumnya) ---
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

// --- TYPES (WAJIB ADA UNTUK SERVICE) ---
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderPayment = typeof orderPayments.$inferSelect;
export type User = typeof users.$inferSelect;

// 👇 INI YANG HILANG DAN MENYEBABKAN ERROR
export type StoreSetting = typeof storeSettings.$inferSelect;

export type Member = typeof members.$inferSelect;
export type Discount = typeof discounts.$inferSelect;
export type Tax = typeof taxes.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

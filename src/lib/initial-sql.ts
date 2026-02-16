export const INITIAL_MIGRATION_SQL = `
-- 1. USERS (Core Auth)
CREATE TABLE IF NOT EXISTS "users" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "username" text NOT NULL UNIQUE,
    "password" text NOT NULL,
    "role" text DEFAULT 'cashier' NOT NULL,
    "avatar_url" text DEFAULT '',
    "is_active" integer DEFAULT true,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

-- 2. CATEGORIES
CREATE TABLE IF NOT EXISTS "categories" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "slug" text NOT NULL UNIQUE,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

-- 3. PRODUCTS (Updated with has_recipe)
CREATE TABLE IF NOT EXISTS "products" (
    "id" text PRIMARY KEY NOT NULL,
    "category_id" text REFERENCES categories(id) ON DELETE SET NULL,
    "name" text NOT NULL,
    "description" text,
    "image_url" text,
    "barcode" text UNIQUE,
    "sku" text UNIQUE,
    "price" text DEFAULT '0' NOT NULL,
    "cost_price" text DEFAULT '0' NOT NULL,
    "stock" real DEFAULT 0 NOT NULL,
    "min_stock" real DEFAULT 0 NOT NULL,
    "unit" text DEFAULT 'pcs',
    "is_active" integer DEFAULT true NOT NULL,
    "has_recipe" integer DEFAULT false NOT NULL,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "product_name_idx" ON "products" ("name");
CREATE INDEX IF NOT EXISTS "product_category_idx" ON "products" ("category_id");

-- 4. INGREDIENTS (Updated with stock & min_stock)
CREATE TABLE IF NOT EXISTS "ingredients" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "unit" text DEFAULT 'gr',
    "stock" real DEFAULT 0 NOT NULL,
    "min_stock" real DEFAULT 0 NOT NULL,
    "cost_per_unit" text DEFAULT '0',
    "calories" real DEFAULT 0,
    "protein" real DEFAULT 0,
    "carbs" real DEFAULT 0,
    "sugar" real DEFAULT 0,
    "fat" real DEFAULT 0,
    "sodium" real DEFAULT 0,
    "is_gluten_free" integer DEFAULT true,
    "contains_dairy" integer DEFAULT false,
    "contains_nuts" integer DEFAULT false,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "ingredient_name_idx" ON "ingredients" ("name");

-- 5. PRODUCT RECIPES
CREATE TABLE IF NOT EXISTS "product_recipes" (
    "id" text PRIMARY KEY NOT NULL,
    "product_id" text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    "ingredient_id" text NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    "quantity" real NOT NULL,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "recipe_product_idx" ON "product_recipes" ("product_id");

-- 6. AUXILIARY TABLES (Members, Discounts, Taxes)
CREATE TABLE IF NOT EXISTS "members" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "phone" text NOT NULL UNIQUE,
    "email" text,
    "points" integer DEFAULT 0,
    "tier" text DEFAULT 'Silver',
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "discounts" (
    "id" text PRIMARY KEY NOT NULL,
    "code" text NOT NULL UNIQUE,
    "name" text NOT NULL,
    "type" text NOT NULL,
    "value" text NOT NULL,
    "start_date" integer,
    "end_date" integer,
    "is_active" integer DEFAULT true,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

CREATE TABLE IF NOT EXISTS "taxes" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "rate" text NOT NULL,
    "is_active" integer DEFAULT true,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

-- 7. ORDERS
CREATE TABLE IF NOT EXISTS "orders" (
    "id" text PRIMARY KEY NOT NULL,
    "member_id" text REFERENCES members(id) ON DELETE SET NULL,
    "discount_id" text REFERENCES discounts(id) ON DELETE SET NULL,
    "cashier_id" text REFERENCES users(id),
    "subtotal" text DEFAULT '0' NOT NULL,
    "discount_amount" text DEFAULT '0',
    "tax_amount" text DEFAULT '0',
    "total_amount" text NOT NULL,
    "tax_name_snapshot" text,
    "tax_rate_snapshot" text,
    "order_type" text DEFAULT 'dine_in' NOT NULL,
    "payment_method" text DEFAULT 'cash' NOT NULL,
    "amount_paid" text NOT NULL,
    "change" text DEFAULT '0' NOT NULL,
    "table_number" text,
    "customer_name" text,
    "queue_number" integer DEFAULT 1 NOT NULL,
    "status" text DEFAULT 'pending',
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "order_created_at_idx" ON "orders" ("created_at");
CREATE INDEX IF NOT EXISTS "order_status_idx" ON "orders" ("status");

-- 8. ORDER ITEMS
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" text PRIMARY KEY NOT NULL,
    "order_id" text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    "product_id" text REFERENCES products(id) ON DELETE SET NULL,
    "product_name_snapshot" text NOT NULL,
    "sku_snapshot" text,
    "quantity" integer NOT NULL,
    "price_at_time" text NOT NULL,
    "cost_price_at_time" text DEFAULT '0',
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "order_item_order_idx" ON "order_items" ("order_id");

-- 9. ORDER PAYMENTS
CREATE TABLE IF NOT EXISTS "order_payments" (
    "id" text PRIMARY KEY NOT NULL,
    "order_id" text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    "payment_method" text NOT NULL,
    "amount" text NOT NULL,
    "reference_id" text,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

-- 10. INVENTORY LOGS (Updated: ingredient_id nullable & final_stock real)
CREATE TABLE IF NOT EXISTS "inventory_logs" (
    "id" text PRIMARY KEY NOT NULL,
    "product_id" text REFERENCES products(id),
    "ingredient_id" text REFERENCES ingredients(id),
    "change_amount" real NOT NULL,
    "final_stock" real NOT NULL,
    "type" text NOT NULL,
    "note" text,
    "reference_id" text,
    "user_id" text REFERENCES users(id),
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "inv_log_product_idx" ON "inventory_logs" ("product_id");
CREATE INDEX IF NOT EXISTS "inv_log_ingredient_idx" ON "inventory_logs" ("ingredient_id");
CREATE INDEX IF NOT EXISTS "inv_log_date_idx" ON "inventory_logs" ("created_at");

-- 11. SHIFTS
CREATE TABLE IF NOT EXISTS "shifts" (
    "id" text PRIMARY KEY NOT NULL,
    "cashier_id" text NOT NULL REFERENCES users(id),
    "start_time" integer NOT NULL,
    "end_time" integer,
    "start_cash" text NOT NULL,
    "expected_end_cash" text,
    "actual_end_cash" text,
    "difference" text,
    "status" text DEFAULT 'open',
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);

-- 12. STORE SETTINGS
CREATE TABLE IF NOT EXISTS "store_settings" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text DEFAULT 'Smart POS Store' NOT NULL,
    "description" text,
    "address" text,
    "phone" text,
    "email" text,
    "website" text,
    "logo_url" text,
    "currency" text DEFAULT 'IDR',
    "receipt_footer" text DEFAULT 'Terima kasih atas kunjungan Anda!',
    "cloud_url" text,
    "cloud_key" text,
    "last_sync_at" integer,
    "created_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    "deleted_at" integer,
    "version" integer DEFAULT 1 NOT NULL,
    "sync_status" integer DEFAULT false NOT NULL
);
`;

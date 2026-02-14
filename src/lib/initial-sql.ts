export const INITIAL_MIGRATION_SQL = `
-- 1. TABEL UTAMA (MASTER DATA) --
CREATE TABLE IF NOT EXISTS \`users\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`username\` text NOT NULL,
    \`password\` text NOT NULL,
    \`role\` text DEFAULT 'cashier' NOT NULL,
    \`avatar_url\` text DEFAULT '',
    \`is_active\` integer DEFAULT true,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`users_username_unique\` ON \`users\` (\`username\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`categories\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`description\` text,
    \`slug\` text NOT NULL,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`categories_slug_unique\` ON \`categories\` (\`slug\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`discounts\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`code\` text NOT NULL,
    \`name\` text NOT NULL,
    \`type\` text NOT NULL,
    \`value\` text NOT NULL,
    \`start_date\` integer,
    \`end_date\` integer,
    \`is_active\` integer DEFAULT true,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`discounts_code_unique\` ON \`discounts\` (\`code\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`members\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`phone\` text NOT NULL,
    \`email\` text,
    \`points\` integer DEFAULT 0,
    \`tier\` text DEFAULT 'Silver',
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`members_phone_unique\` ON \`members\` (\`phone\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`ingredients\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`unit\` text DEFAULT 'gr',
    \`cost_per_unit\` text DEFAULT '0',
    \`calories\` real DEFAULT 0,
    \`protein\` real DEFAULT 0,
    \`carbs\` real DEFAULT 0,
    \`sugar\` real DEFAULT 0,
    \`fat\` real DEFAULT 0,
    \`sodium\` real DEFAULT 0,
    \`is_gluten_free\` integer DEFAULT true,
    \`contains_dairy\` integer DEFAULT false,
    \`contains_nuts\` integer DEFAULT false,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`ingredient_name_idx\` ON \`ingredients\` (\`name\`);
--> statement-breakpoint

-- 2. TABEL DEPENDEN (BUTUH TABEL DI ATAS) --
CREATE TABLE IF NOT EXISTS \`products\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`category_id\` text,
    \`name\` text NOT NULL,
    \`description\` text,
    \`image_url\` text,
    \`barcode\` text,
    \`sku\` text,
    \`price\` text DEFAULT '0' NOT NULL,
    \`cost_price\` text DEFAULT '0' NOT NULL,
    \`stock\` integer DEFAULT 0 NOT NULL,
    \`min_stock\` integer DEFAULT 5 NOT NULL,
    \`unit\` text DEFAULT 'pcs',
    \`is_active\` integer DEFAULT true NOT NULL,
    \`has_recipe\` integer DEFAULT false NOT NULL,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL,
    FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`products_barcode_unique\` ON \`products\` (\`barcode\`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS \`products_sku_unique\` ON \`products\` (\`sku\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`product_name_idx\` ON \`products\` (\`name\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`product_category_idx\` ON \`products\` (\`category_id\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`product_active_idx\` ON \`products\` (\`is_active\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`product_recipes\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`product_id\` text NOT NULL,
    \`ingredient_id\` text NOT NULL,
    \`quantity\` real NOT NULL,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\`(\`id\`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`recipe_product_idx\` ON \`product_recipes\` (\`product_id\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`inventory_logs\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`product_id\` text NOT NULL,
    \`change_amount\` integer NOT NULL,
    \`final_stock\` integer NOT NULL,
    \`type\` text NOT NULL,
    \`note\` text,
    \`reference_id\` text,
    \`user_id\` text,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`inv_log_product_idx\` ON \`inventory_logs\` (\`product_id\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`inv_log_date_idx\` ON \`inventory_logs\` (\`created_at\`);
--> statement-breakpoint

-- 3. TABEL TRANSAKSI --
CREATE TABLE IF NOT EXISTS \`orders\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`member_id\` text,
    \`discount_id\` text,
    \`cashier_id\` text,
    \`subtotal\` text DEFAULT '0' NOT NULL,
    \`discount_amount\` text DEFAULT '0',
    \`tax_amount\` text DEFAULT '0',
    \`total_amount\` text NOT NULL,
    \`tax_name_snapshot\` text,
    \`tax_rate_snapshot\` text,
    \`order_type\` text DEFAULT 'dine_in' NOT NULL,
    \`payment_method\` text DEFAULT 'cash' NOT NULL,
    \`amount_paid\` text NOT NULL,
    \`change\` text DEFAULT '0' NOT NULL,
    \`table_number\` text,
    \`customer_name\` text,
    \`queue_number\` integer DEFAULT 1 NOT NULL,
    \`status\` text DEFAULT 'pending',
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL,
    FOREIGN KEY (\`member_id\`) REFERENCES \`members\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`discount_id\`) REFERENCES \`discounts\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`cashier_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`order_created_at_idx\` ON \`orders\` (\`created_at\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`order_status_idx\` ON \`orders\` (\`status\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`order_member_idx\` ON \`orders\` (\`member_id\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`order_items\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`order_id\` text NOT NULL,
    \`product_id\` text,
    \`product_name_snapshot\` text NOT NULL,
    \`sku_snapshot\` text,
    \`quantity\` integer NOT NULL,
    \`price_at_time\` text NOT NULL,
    \`cost_price_at_time\` text DEFAULT '0',
    FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`order_item_order_idx\` ON \`order_items\` (\`order_id\`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS \`order_item_product_idx\` ON \`order_items\` (\`product_id\`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`order_payments\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`order_id\` text NOT NULL,
    \`payment_method\` text NOT NULL,
    \`amount\` text NOT NULL,
    \`reference_id\` text,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL,
    FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

-- 4. TABEL LAINNYA --
CREATE TABLE IF NOT EXISTS \`shifts\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`cashier_id\` text NOT NULL,
    \`start_time\` integer NOT NULL,
    \`end_time\` integer,
    \`start_cash\` text NOT NULL,
    \`expected_end_cash\` text,
    \`actual_end_cash\` text,
    \`difference\` text,
    \`status\` text DEFAULT 'open',
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL,
    FOREIGN KEY (\`cashier_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`store_settings\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text DEFAULT 'Smart POS Store' NOT NULL,
    \`description\` text,
    \`address\` text,
    \`phone\` text,
    \`email\` text,
    \`website\` text,
    \`logo_url\` text,
    \`currency\` text DEFAULT 'IDR',
    \`receipt_footer\` text DEFAULT 'Terima kasih atas kunjungan Anda!',
    \`cloud_url\` text,
    \`cloud_key\` text,
    \`last_sync_at\` integer,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS \`taxes\` (
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`rate\` text NOT NULL,
    \`is_active\` integer DEFAULT true,
    \`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
    \`deleted_at\` integer,
    \`version\` integer DEFAULT 1 NOT NULL,
    \`sync_status\` integer DEFAULT false NOT NULL
);
`;

export const INITIAL_MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS "categories" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "slug" text NOT NULL,
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_unique" ON "categories" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discounts" (
    "id" text PRIMARY KEY NOT NULL,
    "code" text NOT NULL,
    "name" text NOT NULL,
    "type" text NOT NULL,
    "value" text NOT NULL,
    "start_date" integer,
    "end_date" integer,
    "is_active" integer DEFAULT true,
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discounts_code_unique" ON "discounts" ("code");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "members" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "phone" text NOT NULL,
    "email" text,
    "points" integer DEFAULT 0,
    "tier" text DEFAULT 'Silver',
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_phone_unique" ON "members" ("phone");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "username" text NOT NULL,
    "password" text NOT NULL,
    "role" text DEFAULT 'cashier' NOT NULL,
    "avatar_url" text,
    "is_active" integer DEFAULT true,
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
--> statement-breakpoint
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
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "taxes" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "rate" text NOT NULL,
    "is_active" integer DEFAULT true,
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
    "id" text PRIMARY KEY NOT NULL,
    "category_id" text,
    "name" text NOT NULL,
    "description" text,
    "image_url" text,
    "barcode" text,
    "sku" text,
    "price" text DEFAULT '0' NOT NULL,
    "cost_price" text DEFAULT '0' NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "min_stock" integer DEFAULT 5 NOT NULL,
    "unit" text DEFAULT 'pcs',
    "is_active" integer DEFAULT true NOT NULL,
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer,
    FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_barcode_unique" ON "products" ("barcode");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_unique" ON "products" ("sku");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orders" (
    "id" text PRIMARY KEY NOT NULL,
    "member_id" text,
    "discount_id" text,
    "cashier_id" text,
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
    "customer_phone" text,
    "queue_number" integer DEFAULT 1 NOT NULL,
    "status" text DEFAULT 'pending',
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer,
    FOREIGN KEY ("member_id") REFERENCES "members"("id") ON UPDATE no action ON DELETE set null,
    FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON UPDATE no action ON DELETE set null,
    FOREIGN KEY ("cashier_id") REFERENCES "users"("id") ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" text PRIMARY KEY NOT NULL,
    "order_id" text NOT NULL,
    "product_id" text,
    "product_name_snapshot" text NOT NULL,
    "sku_snapshot" text,
    "quantity" integer NOT NULL,
    "price_at_time" text NOT NULL,
    "cost_price_at_time" text DEFAULT '0',
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "order_payments" (
    "id" text PRIMARY KEY NOT NULL,
    "order_id" text NOT NULL,
    "payment_method" text NOT NULL,
    "amount" text NOT NULL,
    "reference_id" text,
    "created_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "updated_at" integer DEFAULT (strftime('%s', 'now')) NOT NULL,
    "deleted_at" integer,
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE no action ON DELETE cascade
);
`;

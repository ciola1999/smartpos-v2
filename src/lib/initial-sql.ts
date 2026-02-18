/**
 * 🗄️ INITIAL DATABASE SCHEMA (SQLITE)
 *
 * Setiap elemen array = 1 SQL statement LENGKAP.
 * Tidak perlu split by ";" — langsung siap execute per-item.
 *
 * Generated from drizzle/0000_quick_living_lightning.sql
 */

export const INITIAL_SQL_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS \`branches\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`code\` text NOT NULL,
	\`name\` text NOT NULL,
	\`address\` text,
	\`city\` text,
	\`province\` text,
	\`postal_code\` text,
	\`country\` text DEFAULT 'Indonesia',
	\`phone\` text,
	\`email\` text,
	\`tax_id\` text,
	\`is_headquarters\` integer DEFAULT false,
	\`timezone\` text DEFAULT 'Asia/Jakarta',
	\`settings\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL
);`,

  `CREATE TABLE IF NOT EXISTS \`users\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`name\` text NOT NULL,
	\`username\` text NOT NULL,
	\`email\` text,
	\`password\` text NOT NULL,
	\`role\` text DEFAULT 'cashier' NOT NULL,
	\`avatar_url\` text DEFAULT '',
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE TABLE IF NOT EXISTS \`accounts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`code\` text NOT NULL,
	\`name\` text NOT NULL,
	\`type\` text NOT NULL,
	\`normal_balance\` text NOT NULL,
	\`parent_id\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`accounts_code_branch_unique\` ON \`accounts\` (\`code\`,\`branch_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`accounts_parent_idx\` ON \`accounts\` (\`parent_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`addresses\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`owner_type\` text NOT NULL,
	\`owner_id\` text NOT NULL,
	\`label\` text DEFAULT 'utama',
	\`recipient_name\` text,
	\`phone\` text,
	\`address_line1\` text NOT NULL,
	\`address_line2\` text,
	\`city\` text NOT NULL,
	\`state\` text,
	\`postal_code\` text,
	\`country\` text DEFAULT 'Indonesia',
	\`latitude\` real,
	\`longitude\` real,
	\`is_default\` integer DEFAULT false,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL
);`,

  `CREATE INDEX IF NOT EXISTS \`addresses_owner_idx\` ON \`addresses\` (\`owner_type\`,\`owner_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`user_id\` text,
	\`action\` text NOT NULL,
	\`table_name\` text NOT NULL,
	\`record_id\` text NOT NULL,
	\`old_data\` text,
	\`new_data\` text,
	\`ip_address\` text,
	\`user_agent\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE TABLE IF NOT EXISTS \`batches\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`product_id\` text,
	\`ingredient_id\` text,
	\`batch_number\` text NOT NULL,
	\`expiry_date\` integer,
	\`manufacturing_date\` integer,
	\`initial_quantity\` real NOT NULL,
	\`remaining_quantity\` real NOT NULL,
	\`unit_cost\` text NOT NULL,
	\`received_date\` integer NOT NULL,
	\`status\` text DEFAULT 'active',
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE INDEX IF NOT EXISTS \`batches_product_idx\` ON \`batches\` (\`product_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`batches_ingredient_idx\` ON \`batches\` (\`ingredient_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`batches_expiry_idx\` ON \`batches\` (\`expiry_date\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`branches_code_unique\` ON \`branches\` (\`code\`);`,

  `CREATE TABLE IF NOT EXISTS \`categories\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`name\` text NOT NULL,
	\`description\` text,
	\`slug\` text NOT NULL,
	\`parent_id\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`categories_slug_branch_unique\` ON \`categories\` (\`slug\`,\`branch_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`categories_parent_idx\` ON \`categories\` (\`parent_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`commissions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`employee_id\` text NOT NULL,
	\`order_id\` text,
	\`amount\` text NOT NULL,
	\`paid\` integer DEFAULT false,
	\`paid_at\` integer,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`discounts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`code\` text,
	\`name\` text NOT NULL,
	\`type\` text NOT NULL,
	\`value\` text NOT NULL,
	\`start_date\` integer,
	\`end_date\` integer,
	\`min_purchase\` text,
	\`applicable_products\` text,
	\`applicable_categories\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`discounts_code_unique\` ON \`discounts\` (\`code\`);`,

  `CREATE TABLE IF NOT EXISTS \`employees\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text NOT NULL,
	\`user_id\` text,
	\`employee_number\` text NOT NULL,
	\`full_name\` text NOT NULL,
	\`position\` text,
	\`salary_type\` text,
	\`base_salary\` text,
	\`commission_rate\` text,
	\`hire_date\` integer NOT NULL,
	\`termination_date\` integer,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`employees_user_id_unique\` ON \`employees\` (\`user_id\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`employees_employee_number_unique\` ON \`employees\` (\`employee_number\`);`,

  `CREATE INDEX IF NOT EXISTS \`employees_branch_idx\` ON \`employees\` (\`branch_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`ingredients\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`supplier_id\` text,
	\`category_id\` text,
	\`name\` text NOT NULL,
	\`sku\` text,
	\`barcode\` text,
	\`unit\` text DEFAULT 'gr',
	\`stock\` real DEFAULT 0 NOT NULL,
	\`min_stock\` real DEFAULT 0,
	\`cost_per_unit\` text DEFAULT '0',
	\`track_batch\` integer DEFAULT false,
	\`calories\` real DEFAULT 0,
	\`protein\` real DEFAULT 0,
	\`carbs\` real DEFAULT 0,
	\`sugar\` real DEFAULT 0,
	\`fat\` real DEFAULT 0,
	\`sodium\` real DEFAULT 0,
	\`is_gluten_free\` integer DEFAULT true,
	\`contains_dairy\` integer DEFAULT false,
	\`contains_nuts\` integer DEFAULT false,
	\`image_url\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`ingredients_sku_unique\` ON \`ingredients\` (\`sku\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`ingredients_sku_idx\` ON \`ingredients\` (\`sku\`);`,

  `CREATE INDEX IF NOT EXISTS \`ingredients_supplier_idx\` ON \`ingredients\` (\`supplier_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`journal_entries\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`entry_date\` integer NOT NULL,
	\`reference\` text,
	\`description\` text,
	\`created_by\` text,
	\`approved_at\` integer,
	\`approved_by\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`approved_by\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE no action
);`,

  `CREATE INDEX IF NOT EXISTS \`journal_entries_date_idx\` ON \`journal_entries\` (\`entry_date\`);`,

  `CREATE TABLE IF NOT EXISTS \`journal_lines\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`journal_entry_id\` text NOT NULL,
	\`account_id\` text NOT NULL,
	\`debit\` text DEFAULT '0',
	\`credit\` text DEFAULT '0',
	\`description\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`journal_entry_id\`) REFERENCES \`journal_entries\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`account_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE restrict
);`,

  `CREATE TABLE IF NOT EXISTS \`loyalty_accounts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`member_id\` text NOT NULL,
	\`program_id\` text NOT NULL,
	\`points_balance\` integer DEFAULT 0,
	\`tier\` text,
	\`enrolled_at\` integer NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`member_id\`) REFERENCES \`members\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`program_id\`) REFERENCES \`loyalty_programs\`(\`id\`) ON UPDATE no action ON DELETE restrict
);`,

  `CREATE TABLE IF NOT EXISTS \`loyalty_programs\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`name\` text NOT NULL,
	\`type\` text NOT NULL,
	\`rules\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`loyalty_transactions\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`account_id\` text NOT NULL,
	\`points_change\` integer NOT NULL,
	\`balance_after\` integer NOT NULL,
	\`reason\` text,
	\`reference_id\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`account_id\`) REFERENCES \`loyalty_accounts\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`marketplace_connections\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`marketplace\` text NOT NULL,
	\`shop_id\` text NOT NULL,
	\`shop_name\` text,
	\`access_token\` text,
	\`refresh_token\` text,
	\`token_expires_at\` integer,
	\`settings\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`marketplace_orders\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`connection_id\` text NOT NULL,
	\`marketplace_order_id\` text NOT NULL,
	\`order_data\` text,
	\`status_mapping\` text,
	\`linked_order_id\` text,
	\`imported_at\` integer,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`connection_id\`) REFERENCES \`marketplace_connections\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`linked_order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE TABLE IF NOT EXISTS \`marketplace_product_mapping\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`connection_id\` text NOT NULL,
	\`product_id\` text NOT NULL,
	\`marketplace_product_id\` text NOT NULL,
	\`marketplace_sku\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`connection_id\`) REFERENCES \`marketplace_connections\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`members\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`code\` text,
	\`name\` text NOT NULL,
	\`email\` text,
	\`phone\` text NOT NULL,
	\`date_of_birth\` integer,
	\`anniversary\` integer,
	\`tax_id\` text,
	\`notes\` text,
	\`default_address_id\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`members_code_unique\` ON \`members\` (\`code\`);`,

  `CREATE INDEX IF NOT EXISTS \`members_phone_idx\` ON \`members\` (\`phone\`);`,

  `CREATE INDEX IF NOT EXISTS \`members_email_idx\` ON \`members\` (\`email\`);`,

  `CREATE TABLE IF NOT EXISTS \`order_items\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`order_id\` text NOT NULL,
	\`product_id\` text,
	\`variant_id\` text,
	\`batch_id\` text,
	\`tax_id\` text,
	\`product_name_snapshot\` text NOT NULL,
	\`sku_snapshot\` text,
	\`quantity\` real NOT NULL,
	\`unit_price\` text NOT NULL,
	\`discount_amount\` text DEFAULT '0',
	\`tax_rate_snapshot\` text,
	\`total_amount\` text NOT NULL,
	\`cost_price_at_time\` text DEFAULT '0',
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`batch_id\`) REFERENCES \`batches\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`tax_id\`) REFERENCES \`taxes\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE INDEX IF NOT EXISTS \`order_items_order_idx\` ON \`order_items\` (\`order_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`order_items_product_idx\` ON \`order_items\` (\`product_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`order_payments\` (
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
);`,

  `CREATE INDEX IF NOT EXISTS \`payments_order_idx\` ON \`order_payments\` (\`order_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`orders\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text NOT NULL,
	\`warehouse_id\` text,
	\`member_id\` text,
	\`discount_id\` text,
	\`cashier_id\` text,
	\`order_number\` text NOT NULL,
	\`order_date\` integer NOT NULL,
	\`status\` text DEFAULT 'draft',
	\`order_type\` text DEFAULT 'dine_in' NOT NULL,
	\`table_number\` text,
	\`customer_name\` text,
	\`queue_number\` integer,
	\`subtotal\` text DEFAULT '0' NOT NULL,
	\`discount_amount\` text DEFAULT '0',
	\`tax_amount\` text DEFAULT '0',
	\`shipping_amount\` text DEFAULT '0',
	\`total_amount\` text NOT NULL,
	\`tax_name_snapshot\` text,
	\`tax_rate_snapshot\` text,
	\`amount_paid\` text,
	\`change\` text DEFAULT '0',
	\`shipping_address_id\` text,
	\`billing_address_id\` text,
	\`shipment_id\` text,
	\`notes\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`member_id\`) REFERENCES \`members\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`discount_id\`) REFERENCES \`discounts\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`cashier_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`shipping_address_id\`) REFERENCES \`addresses\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`billing_address_id\`) REFERENCES \`addresses\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`orders_order_number_unique\` ON \`orders\` (\`order_number\`);`,

  `CREATE INDEX IF NOT EXISTS \`orders_branch_idx\` ON \`orders\` (\`branch_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`orders_member_idx\` ON \`orders\` (\`member_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`orders_status_idx\` ON \`orders\` (\`status\`);`,

  `CREATE INDEX IF NOT EXISTS \`orders_date_idx\` ON \`orders\` (\`order_date\`);`,

  `CREATE TABLE IF NOT EXISTS \`price_list_items\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`price_list_id\` text NOT NULL,
	\`product_id\` text,
	\`variant_id\` text,
	\`price\` text NOT NULL,
	\`min_quantity\` real DEFAULT 1,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`price_list_id\`) REFERENCES \`price_lists\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`price_lists\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`name\` text NOT NULL,
	\`type\` text NOT NULL,
	\`start_date\` integer,
	\`end_date\` integer,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`product_recipes\` (
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
);`,

  `CREATE INDEX IF NOT EXISTS \`recipe_product_idx\` ON \`product_recipes\` (\`product_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`recipe_ingredient_idx\` ON \`product_recipes\` (\`ingredient_id\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`recipe_unique_product_ingredient\` ON \`product_recipes\` (\`product_id\`,\`ingredient_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`product_variants\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`product_id\` text NOT NULL,
	\`sku\` text NOT NULL,
	\`barcode\` text,
	\`attributes\` text,
	\`price_adjustment\` text DEFAULT '0',
	\`stock\` real DEFAULT 0,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`variants_sku_product_unique\` ON \`product_variants\` (\`sku\`,\`product_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`variants_product_idx\` ON \`product_variants\` (\`product_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`products\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`category_id\` text,
	\`tax_id\` text,
	\`name\` text NOT NULL,
	\`description\` text,
	\`image_urls\` text,
	\`barcode\` text,
	\`sku\` text NOT NULL,
	\`type\` text DEFAULT 'simple' NOT NULL,
	\`track_inventory\` integer DEFAULT true NOT NULL,
	\`valuation_method\` text DEFAULT 'fifo',
	\`price\` text DEFAULT '0' NOT NULL,
	\`cost_price\` text DEFAULT '0' NOT NULL,
	\`has_recipe\` integer DEFAULT false NOT NULL,
	\`weight\` real,
	\`weight_unit\` text DEFAULT 'kg',
	\`dimensions\` text,
	\`min_stock\` real DEFAULT 0,
	\`max_stock\` real,
	\`unit\` text DEFAULT 'pcs',
	\`is_active\` integer DEFAULT true NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`tax_id\`) REFERENCES \`taxes\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`products_sku_branch_unique\` ON \`products\` (\`sku\`,\`branch_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`products_barcode_idx\` ON \`products\` (\`barcode\`);`,

  `CREATE INDEX IF NOT EXISTS \`products_category_idx\` ON \`products\` (\`category_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`products_active_idx\` ON \`products\` (\`is_active\`);`,

  `CREATE TABLE IF NOT EXISTS \`purchase_order_items\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`purchase_order_id\` text NOT NULL,
	\`product_id\` text,
	\`variant_id\` text,
	\`ingredient_id\` text,
	\`quantity\` real NOT NULL,
	\`unit_cost\` text NOT NULL,
	\`tax_id\` text,
	\`tax_rate_snapshot\` text,
	\`discount_amount\` text DEFAULT '0',
	\`total_amount\` text NOT NULL,
	\`received_quantity\` real DEFAULT 0,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\`(\`id\`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (\`tax_id\`) REFERENCES \`taxes\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE INDEX IF NOT EXISTS \`poi_po_idx\` ON \`purchase_order_items\` (\`purchase_order_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`purchase_orders\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text NOT NULL,
	\`supplier_id\` text NOT NULL,
	\`warehouse_id\` text,
	\`user_id\` text,
	\`order_number\` text NOT NULL,
	\`order_date\` integer NOT NULL,
	\`expected_delivery_date\` integer,
	\`status\` text DEFAULT 'draft',
	\`subtotal\` text DEFAULT '0' NOT NULL,
	\`tax_amount\` text DEFAULT '0',
	\`discount_amount\` text DEFAULT '0',
	\`total_amount\` text NOT NULL,
	\`notes\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`supplier_id\`) REFERENCES \`suppliers\`(\`id\`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`purchase_orders_order_number_unique\` ON \`purchase_orders\` (\`order_number\`);`,

  `CREATE INDEX IF NOT EXISTS \`po_supplier_idx\` ON \`purchase_orders\` (\`supplier_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`po_status_idx\` ON \`purchase_orders\` (\`status\`);`,

  `CREATE TABLE IF NOT EXISTS \`shifts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`cashier_id\` text NOT NULL,
	\`employee_id\` text,
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
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`cashier_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`employee_id\`) REFERENCES \`employees\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE INDEX IF NOT EXISTS \`shifts_cashier_idx\` ON \`shifts\` (\`cashier_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`shifts_branch_idx\` ON \`shifts\` (\`branch_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`shipment_items\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`shipment_id\` text NOT NULL,
	\`order_item_id\` text NOT NULL,
	\`quantity_shipped\` real NOT NULL,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`shipment_id\`) REFERENCES \`shipments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`order_item_id\`) REFERENCES \`order_items\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE TABLE IF NOT EXISTS \`shipments\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`order_id\` text,
	\`carrier\` text,
	\`service\` text,
	\`tracking_number\` text,
	\`status\` text DEFAULT 'draft',
	\`origin_address_id\` text,
	\`destination_address_id\` text,
	\`shipped_at\` integer,
	\`estimated_delivery\` integer,
	\`delivered_at\` integer,
	\`total_weight\` real,
	\`total_volume\` real,
	\`shipping_cost\` text DEFAULT '0',
	\`insurance_cost\` text DEFAULT '0',
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`origin_address_id\`) REFERENCES \`addresses\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`destination_address_id\`) REFERENCES \`addresses\`(\`id\`) ON UPDATE no action ON DELETE no action
);`,

  `CREATE INDEX IF NOT EXISTS \`shipments_order_idx\` ON \`shipments\` (\`order_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`shipments_tracking_idx\` ON \`shipments\` (\`tracking_number\`);`,

  `CREATE TABLE IF NOT EXISTS \`stock_movements\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`warehouse_id\` text,
	\`product_id\` text,
	\`variant_id\` text,
	\`ingredient_id\` text,
	\`batch_id\` text,
	\`quantity\` real NOT NULL,
	\`type\` text NOT NULL,
	\`reference_id\` text,
	\`reference_type\` text,
	\`unit_cost\` text,
	\`note\` text,
	\`user_id\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (\`warehouse_id\`) REFERENCES \`warehouses\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`product_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`variant_id\`) REFERENCES \`product_variants\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`ingredient_id\`) REFERENCES \`ingredients\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`batch_id\`) REFERENCES \`batches\`(\`id\`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null
);`,

  `CREATE INDEX IF NOT EXISTS \`stock_movements_product_idx\` ON \`stock_movements\` (\`product_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`stock_movements_ingredient_idx\` ON \`stock_movements\` (\`ingredient_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`stock_movements_batch_idx\` ON \`stock_movements\` (\`batch_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`stock_movements_warehouse_idx\` ON \`stock_movements\` (\`warehouse_id\`);`,

  `CREATE INDEX IF NOT EXISTS \`stock_movements_reference_idx\` ON \`stock_movements\` (\`reference_id\`,\`reference_type\`);`,

  `CREATE INDEX IF NOT EXISTS \`stock_movements_created_at_idx\` ON \`stock_movements\` (\`created_at\`);`,

  `CREATE TABLE IF NOT EXISTS \`store_settings\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`name\` text DEFAULT 'SmartPOS Store' NOT NULL,
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
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`store_settings_branch_id_unique\` ON \`store_settings\` (\`branch_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`suppliers\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`code\` text NOT NULL,
	\`name\` text NOT NULL,
	\`contact_person\` text,
	\`phone\` text,
	\`email\` text,
	\`tax_id\` text,
	\`payment_terms\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`suppliers_code_branch_unique\` ON \`suppliers\` (\`code\`,\`branch_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`sync_conflicts\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`table_name\` text NOT NULL,
	\`record_id\` text NOT NULL,
	\`client_version\` integer NOT NULL,
	\`server_version\` integer NOT NULL,
	\`client_data\` text,
	\`server_data\` text,
	\`resolved_at\` integer,
	\`resolution\` text,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer
);`,

  `CREATE TABLE IF NOT EXISTS \`taxes\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text,
	\`name\` text NOT NULL,
	\`rate\` text NOT NULL,
	\`is_compound\` integer DEFAULT false,
	\`account_id\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`users_username_unique\` ON \`users\` (\`username\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`users_email_unique\` ON \`users\` (\`email\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`users_username_idx\` ON \`users\` (\`username\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`users_email_idx\` ON \`users\` (\`email\`);`,

  `CREATE INDEX IF NOT EXISTS \`users_branch_idx\` ON \`users\` (\`branch_id\`);`,

  `CREATE TABLE IF NOT EXISTS \`warehouses\` (
	\`id\` text PRIMARY KEY NOT NULL,
	\`branch_id\` text NOT NULL,
	\`code\` text NOT NULL,
	\`name\` text NOT NULL,
	\`address\` text,
	\`is_active\` integer DEFAULT true,
	\`created_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`updated_at\` integer DEFAULT (strftime('%s', 'now') * 1000) NOT NULL,
	\`deleted_at\` integer,
	\`version\` integer DEFAULT 1 NOT NULL,
	\`sync_status\` integer DEFAULT false NOT NULL,
	FOREIGN KEY (\`branch_id\`) REFERENCES \`branches\`(\`id\`) ON UPDATE no action ON DELETE cascade
);`,

  `CREATE INDEX IF NOT EXISTS \`warehouses_branch_idx\` ON \`warehouses\` (\`branch_id\`);`,

  `CREATE UNIQUE INDEX IF NOT EXISTS \`warehouses_code_branch_unique\` ON \`warehouses\` (\`code\`,\`branch_id\`);`,
] as const;

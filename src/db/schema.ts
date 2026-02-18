import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ============================================================================
// SHARED HELPERS (DRY & CONSISTENCY)
// ============================================================================

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

const syncColumns = {
  version: integer("version").default(1).notNull(),
  syncStatus: integer("sync_status", { mode: "boolean" })
    .default(false)
    .notNull(), // false = local/dirty, true = synced
};

// ============================================================================
// CORE TABLES (MULTI‑BRANCH AWARE)
// ============================================================================

// Cabang / Outlet
export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  postalCode: text("postal_code"),
  country: text("country").default("Indonesia"),
  phone: text("phone"),
  email: text("email"),
  taxId: text("tax_id"),
  isHeadquarters: integer("is_headquarters", { mode: "boolean" }).default(
    false,
  ),
  timezone: text("timezone").default("Asia/Jakarta"),
  settings: text("settings"), // JSON string untuk konfigurasi spesifik cabang
  ...timestamps,
  ...syncColumns,
});

// Pengguna sistem (login)
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    username: text("username").unique().notNull(),
    email: text("email").unique(),
    password: text("password").notNull(),
    role: text("role", {
      enum: ["superadmin", "admin", "manager", "cashier", "kitchen"],
    })
      .default("cashier")
      .notNull(),
    avatarUrl: text("avatar_url").default(""),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    usernameIdx: uniqueIndex("users_username_idx").on(table.username),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    branchIdx: index("users_branch_idx").on(table.branchId),
  }),
);

// Gudang per cabang
export const warehouses = sqliteTable(
  "warehouses",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .references(() => branches.id, { onDelete: "cascade" })
      .notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    branchIdx: index("warehouses_branch_idx").on(table.branchId),
    codeUniquePerBranch: uniqueIndex("warehouses_code_branch_unique").on(
      table.code,
      table.branchId,
    ),
  }),
);

// Kategori produk
export const categories = sqliteTable(
  "categories",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    description: text("description"),
    slug: text("slug").notNull(),
    parentId: text("parent_id"),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    slugUniquePerBranch: uniqueIndex("categories_slug_branch_unique").on(
      table.slug,
      table.branchId,
    ),
    parentIdx: index("categories_parent_idx").on(table.parentId),
  }),
);

// Pajak
export const taxes = sqliteTable("taxes", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  rate: text("rate").notNull(), // "10" untuk 10% (string)
  isCompound: integer("is_compound", { mode: "boolean" }).default(false),
  accountId: text("account_id"), // akan di-foreign key setelah tabel accounts didefinisikan
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

// Pemasok
export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    email: text("email"),
    taxId: text("tax_id"),
    paymentTerms: text("payment_terms"), // misal: "net30"
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    codeUniquePerBranch: uniqueIndex("suppliers_code_branch_unique").on(
      table.code,
      table.branchId,
    ),
  }),
);

// ============================================================================
// PRODUCTS & INVENTORY
// ============================================================================

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    taxId: text("tax_id").references(() => taxes.id, { onDelete: "set null" }),

    name: text("name").notNull(),
    description: text("description"),
    imageUrls: text("image_urls"), // JSON array string
    barcode: text("barcode"),
    sku: text("sku").notNull(),
    type: text("type", { enum: ["simple", "variable"] })
      .default("simple")
      .notNull(),
    trackInventory: integer("track_inventory", { mode: "boolean" })
      .default(true)
      .notNull(),
    valuationMethod: text("valuation_method", {
      enum: ["fifo", "lifo", "average"],
    }).default("fifo"),

    // Harga default
    price: text("price").notNull().default("0"),
    costPrice: text("cost_price").notNull().default("0"),

    // Untuk produk dengan resep (F&B)
    hasRecipe: integer("has_recipe", { mode: "boolean" })
      .default(false)
      .notNull(),

    // Atribut fisik (untuk logistik)
    weight: real("weight"), // dalam kg
    weightUnit: text("weight_unit").default("kg"),
    dimensions: text("dimensions"), // JSON {length,width,height,unit}

    minimumStock: real("min_stock").default(0),
    maximumStock: real("max_stock"),
    unit: text("unit").default("pcs"),

    isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    skuUniquePerBranch: uniqueIndex("products_sku_branch_unique").on(
      table.sku,
      table.branchId,
    ),
    barcodeIdx: index("products_barcode_idx").on(table.barcode),
    categoryIdx: index("products_category_idx").on(table.categoryId),
    activeIdx: index("products_active_idx").on(table.isActive),
  }),
);

// Varian produk (untuk type = "variable")
export const productVariants = sqliteTable(
  "product_variants",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    sku: text("sku").notNull(),
    barcode: text("barcode"),
    attributes: text("attributes"), // JSON, misal: {"warna":"merah","ukuran":"L"}
    priceAdjustment: text("price_adjustment").default("0"), // selisih dari harga produk utama
    stock: real("stock").default(0), // jika trackInventory per varian, bisa diisi
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    skuUniquePerProduct: uniqueIndex("variants_sku_product_unique").on(
      table.sku,
      table.productId,
    ),
    productIdx: index("variants_product_idx").on(table.productId),
  }),
);

// Bahan baku (untuk resep)
export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    supplierId: text("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),

    name: text("name").notNull(),
    sku: text("sku").unique(),
    barcode: text("barcode"),
    unit: text("unit").default("gr"),
    stock: real("stock").notNull().default(0),
    minStock: real("min_stock").default(0),
    costPerUnit: text("cost_per_unit").default("0"),

    // Opsi pelacakan batch (untuk bahan yang punya expiry)
    trackBatch: integer("track_batch", { mode: "boolean" }).default(false),

    // Nutritional info (opsional)
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

    imageUrl: text("image_url"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    skuIdx: uniqueIndex("ingredients_sku_idx").on(table.sku),
    supplierIdx: index("ingredients_supplier_idx").on(table.supplierId),
  }),
);

// Resep produk jadi (hubungan many-to-many dengan jumlah)
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
    quantity: real("quantity").notNull(), // jumlah ingredient yang digunakan per unit produk
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    productIdx: index("recipe_product_idx").on(table.productId),
    ingredientIdx: index("recipe_ingredient_idx").on(table.ingredientId),
    uniqueProductIngredient: uniqueIndex("recipe_unique_product_ingredient").on(
      table.productId,
      table.ingredientId,
    ),
  }),
);

// Batch (untuk produk/ingredient yang punya expiry)
export const batches = sqliteTable(
  "batches",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "cascade",
    }),
    ingredientId: text("ingredient_id").references(() => ingredients.id, {
      onDelete: "cascade",
    }),
    batchNumber: text("batch_number").notNull(),
    expiryDate: integer("expiry_date", { mode: "timestamp_ms" }),
    manufacturingDate: integer("manufacturing_date", { mode: "timestamp_ms" }),
    initialQuantity: real("initial_quantity").notNull(),
    remainingQuantity: real("remaining_quantity").notNull(),
    unitCost: text("unit_cost").notNull(), // harga pokok per unit dalam batch ini
    receivedDate: integer("received_date", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: ["active", "expired", "depleted"] }).default(
      "active",
    ),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    productIdx: index("batches_product_idx").on(table.productId),
    ingredientIdx: index("batches_ingredient_idx").on(table.ingredientId),
    expiryIdx: index("batches_expiry_idx").on(table.expiryDate),
  }),
);

// ============================================================================
// INVENTORY MOVEMENTS (menggantikan inventoryLogs)
// ============================================================================

export const stockMovements = sqliteTable(
  "stock_movements",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    warehouseId: text("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    productId: text("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    variantId: text("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    ingredientId: text("ingredient_id").references(() => ingredients.id, {
      onDelete: "set null",
    }),
    batchId: text("batch_id").references(() => batches.id, {
      onDelete: "set null",
    }),

    quantity: real("quantity").notNull(), // positif = masuk, negatif = keluar
    type: text("type", {
      enum: [
        "sale",
        "purchase",
        "return",
        "adjustment",
        "transfer",
        "damage",
        "void",
        "production", // from recipe
      ],
    }).notNull(),
    referenceId: text("reference_id"), // ID order, purchase, transfer, dll
    referenceType: text("reference_type"), // "order", "purchase_order", "transfer", dll
    unitCost: text("unit_cost"), // harga pokok saat movement
    note: text("note"),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    productIdx: index("stock_movements_product_idx").on(table.productId),
    ingredientIdx: index("stock_movements_ingredient_idx").on(
      table.ingredientId,
    ),
    batchIdx: index("stock_movements_batch_idx").on(table.batchId),
    warehouseIdx: index("stock_movements_warehouse_idx").on(table.warehouseId),
    referenceIdx: index("stock_movements_reference_idx").on(
      table.referenceId,
      table.referenceType,
    ),
    dateIdx: index("stock_movements_created_at_idx").on(table.createdAt),
  }),
);

// ============================================================================
// PURCHASING
// ============================================================================

export const purchaseOrders = sqliteTable(
  "purchase_orders",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .references(() => branches.id, { onDelete: "cascade" })
      .notNull(),
    supplierId: text("supplier_id")
      .references(() => suppliers.id, { onDelete: "restrict" })
      .notNull(),
    warehouseId: text("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    orderNumber: text("order_number").notNull().unique(),
    orderDate: integer("order_date", { mode: "timestamp_ms" }).notNull(),
    expectedDeliveryDate: integer("expected_delivery_date", {
      mode: "timestamp_ms",
    }),
    status: text("status", {
      enum: ["draft", "sent", "partial", "completed", "cancelled"],
    }).default("draft"),

    subtotal: text("subtotal").notNull().default("0"),
    taxAmount: text("tax_amount").default("0"),
    discountAmount: text("discount_amount").default("0"),
    totalAmount: text("total_amount").notNull(),

    notes: text("notes"),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    supplierIdx: index("po_supplier_idx").on(table.supplierId),
    statusIdx: index("po_status_idx").on(table.status),
  }),
);

export const purchaseOrderItems = sqliteTable(
  "purchase_order_items",
  {
    id: text("id").primaryKey(),
    purchaseOrderId: text("purchase_order_id")
      .references(() => purchaseOrders.id, { onDelete: "cascade" })
      .notNull(),
    productId: text("product_id").references(() => products.id, {
      onDelete: "restrict",
    }),
    variantId: text("variant_id").references(() => productVariants.id, {
      onDelete: "restrict",
    }),
    ingredientId: text("ingredient_id").references(() => ingredients.id, {
      onDelete: "restrict",
    }),

    quantity: real("quantity").notNull(),
    unitCost: text("unit_cost").notNull(),
    taxId: text("tax_id").references(() => taxes.id, { onDelete: "set null" }),
    taxRateSnapshot: text("tax_rate_snapshot"),
    discountAmount: text("discount_amount").default("0"),
    totalAmount: text("total_amount").notNull(),

    receivedQuantity: real("received_quantity").default(0),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    poIdx: index("poi_po_idx").on(table.purchaseOrderId),
  }),
);

// ============================================================================
// CUSTOMER & LOYALTY
// ============================================================================

export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    code: text("code").unique(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone").notNull(),
    dateOfBirth: integer("date_of_birth", { mode: "timestamp_ms" }),
    anniversary: integer("anniversary", { mode: "timestamp_ms" }),
    taxId: text("tax_id"),
    notes: text("notes"),
    defaultAddressId: text("default_address_id"), // nanti foreign key ke addresses
    isActive: integer("is_active", { mode: "boolean" }).default(true),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    phoneIdx: index("members_phone_idx").on(table.phone),
    emailIdx: index("members_email_idx").on(table.email),
  }),
);

// Alamat polymorphic (untuk member, supplier, branch)
export const addresses = sqliteTable(
  "addresses",
  {
    id: text("id").primaryKey(),
    ownerType: text("owner_type", {
      enum: ["member", "supplier", "branch"],
    }).notNull(),
    ownerId: text("owner_id").notNull(),
    label: text("label").default("utama"),
    recipientName: text("recipient_name"),
    phone: text("phone"),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    city: text("city").notNull(),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country").default("Indonesia"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    isDefault: integer("is_default", { mode: "boolean" }).default(false),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    ownerIdx: index("addresses_owner_idx").on(table.ownerType, table.ownerId),
  }),
);

// Program loyalitas
export const loyaltyPrograms = sqliteTable("loyalty_programs", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  type: text("type", { enum: ["points", "stamp", "tier"] }).notNull(),
  rules: text("rules"), // JSON: misal { pointsPerAmount: 10, minAmount: 10000 }
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

// Akun loyalitas per member per program
export const loyaltyAccounts = sqliteTable("loyalty_accounts", {
  id: text("id").primaryKey(),
  memberId: text("member_id")
    .references(() => members.id, { onDelete: "cascade" })
    .notNull(),
  programId: text("program_id")
    .references(() => loyaltyPrograms.id, { onDelete: "restrict" })
    .notNull(),
  pointsBalance: integer("points_balance").default(0),
  tier: text("tier"),
  enrolledAt: integer("enrolled_at", { mode: "timestamp_ms" }).notNull(),
  ...timestamps,
  ...syncColumns,
});

// Transaksi loyalitas (perubahan poin)
export const loyaltyTransactions = sqliteTable("loyalty_transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .references(() => loyaltyAccounts.id, { onDelete: "cascade" })
    .notNull(),
  pointsChange: integer("points_change").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason"), // "earn", "redeem", "expire", "adjust"
  referenceId: text("reference_id"), // order id atau lainnya
  ...timestamps,
  ...syncColumns,
});

// ============================================================================
// PRICING & DISCOUNTS
// ============================================================================

// Daftar harga (price list)
export const priceLists = sqliteTable("price_lists", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["default", "promo", "member", "wholesale"],
  }).notNull(),
  startDate: integer("start_date", { mode: "timestamp_ms" }),
  endDate: integer("end_date", { mode: "timestamp_ms" }),
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

// Item dalam price list
export const priceListItems = sqliteTable("price_list_items", {
  id: text("id").primaryKey(),
  priceListId: text("price_list_id")
    .references(() => priceLists.id, { onDelete: "cascade" })
    .notNull(),
  productId: text("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),
  variantId: text("variant_id").references(() => productVariants.id, {
    onDelete: "cascade",
  }),
  price: text("price").notNull(),
  minQuantity: real("min_quantity").default(1),
  ...timestamps,
  ...syncColumns,
});

// Diskon (promo)
export const discounts = sqliteTable("discounts", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  code: text("code").unique(),
  name: text("name").notNull(),
  type: text("type", { enum: ["PERCENTAGE", "FIXED"] }).notNull(),
  value: text("value").notNull(),
  startDate: integer("start_date", { mode: "timestamp_ms" }),
  endDate: integer("end_date", { mode: "timestamp_ms" }),
  minPurchase: text("min_purchase"),
  applicableProducts: text("applicable_products"), // JSON array atau "all"
  applicableCategories: text("applicable_categories"), // JSON array
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

// ============================================================================
// SALES (ORDERS)
// ============================================================================

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .references(() => branches.id, { onDelete: "restrict" })
      .notNull(),
    warehouseId: text("warehouse_id").references(() => warehouses.id, {
      onDelete: "set null",
    }),
    memberId: text("member_id").references(() => members.id, {
      onDelete: "set null",
    }),
    discountId: text("discount_id").references(() => discounts.id, {
      onDelete: "set null",
    }),
    cashierId: text("cashier_id").references(() => users.id, {
      onDelete: "set null",
    }),

    orderNumber: text("order_number").notNull().unique(),
    orderDate: integer("order_date", { mode: "timestamp_ms" }).notNull(),
    status: text("status", {
      enum: [
        "draft",
        "confirmed",
        "processing",
        "completed",
        "cancelled",
        "refunded",
      ],
    }).default("draft"),

    orderType: text("order_type", {
      enum: ["dine_in", "take_away", "delivery"],
    })
      .default("dine_in")
      .notNull(),
    tableNumber: text("table_number"),
    customerName: text("customer_name"), // jika bukan member
    queueNumber: integer("queue_number"),

    subtotal: text("subtotal").notNull().default("0"),
    discountAmount: text("discount_amount").default("0"),
    taxAmount: text("tax_amount").default("0"),
    shippingAmount: text("shipping_amount").default("0"),
    totalAmount: text("total_amount").notNull(),

    taxNameSnapshot: text("tax_name_snapshot"),
    taxRateSnapshot: text("tax_rate_snapshot"),

    amountPaid: text("amount_paid"),
    change: text("change").default("0"),

    shippingAddressId: text("shipping_address_id").references(
      () => addresses.id,
      { onDelete: "set null" },
    ),
    billingAddressId: text("billing_address_id").references(
      () => addresses.id,
      { onDelete: "set null" },
    ),
    shipmentId: text("shipment_id"), // akan di-foreign ke shipments

    notes: text("notes"),

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    branchIdx: index("orders_branch_idx").on(table.branchId),
    memberIdx: index("orders_member_idx").on(table.memberId),
    statusIdx: index("orders_status_idx").on(table.status),
    dateIdx: index("orders_date_idx").on(table.orderDate),
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
      onDelete: "set null",
    }),
    variantId: text("variant_id").references(() => productVariants.id, {
      onDelete: "set null",
    }),
    batchId: text("batch_id").references(() => batches.id, {
      onDelete: "set null",
    }),
    taxId: text("tax_id").references(() => taxes.id, { onDelete: "set null" }),

    // Snapshot data
    productNameSnapshot: text("product_name_snapshot").notNull(),
    skuSnapshot: text("sku_snapshot"),
    quantity: real("quantity").notNull(),
    unitPrice: text("unit_price").notNull(),
    discountAmount: text("discount_amount").default("0"),
    taxRateSnapshot: text("tax_rate_snapshot"),
    totalAmount: text("total_amount").notNull(),
    costPriceAtTime: text("cost_price_at_time").default("0"), // untuk margin

    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    orderIdx: index("order_items_order_idx").on(table.orderId),
    productIdx: index("order_items_product_idx").on(table.productId),
  }),
);

export const orderPayments = sqliteTable(
  "order_payments",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    paymentMethod: text("payment_method", {
      enum: ["cash", "debit", "credit", "qris", "transfer", "split"],
    }).notNull(),
    amount: text("amount").notNull(),
    referenceId: text("reference_id"), // nomor referensi dari payment gateway/edc
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    orderIdx: index("payments_order_idx").on(table.orderId),
  }),
);

// ============================================================================
// SHIPMENTS (LOGISTIK)
// ============================================================================

export const shipments = sqliteTable(
  "shipments",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    orderId: text("order_id").references(() => orders.id, {
      onDelete: "set null",
    }),
    carrier: text("carrier"), // JNE, SiCepat, dll
    service: text("service"), // REG, YES
    trackingNumber: text("tracking_number"),
    status: text("status", {
      enum: [
        "draft",
        "booked",
        "picked_up",
        "in_transit",
        "delivered",
        "failed",
        "returned",
      ],
    }).default("draft"),
    originAddressId: text("origin_address_id").references(() => addresses.id),
    destinationAddressId: text("destination_address_id").references(
      () => addresses.id,
    ),
    shippedAt: integer("shipped_at", { mode: "timestamp_ms" }),
    estimatedDelivery: integer("estimated_delivery", { mode: "timestamp_ms" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp_ms" }),
    totalWeight: real("total_weight"),
    totalVolume: real("total_volume"),
    shippingCost: text("shipping_cost").default("0"),
    insuranceCost: text("insurance_cost").default("0"),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    orderIdx: index("shipments_order_idx").on(table.orderId),
    trackingIdx: index("shipments_tracking_idx").on(table.trackingNumber),
  }),
);

export const shipmentItems = sqliteTable("shipment_items", {
  id: text("id").primaryKey(),
  shipmentId: text("shipment_id")
    .references(() => shipments.id, { onDelete: "cascade" })
    .notNull(),
  orderItemId: text("order_item_id")
    .references(() => orderItems.id, { onDelete: "cascade" })
    .notNull(),
  quantityShipped: real("quantity_shipped").notNull(),
  ...timestamps,
  ...syncColumns,
});

// ============================================================================
// EMPLOYEE & SHIFT MANAGEMENT
// ============================================================================

export const employees = sqliteTable(
  "employees",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id")
      .references(() => branches.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "set null" })
      .unique(),
    employeeNumber: text("employee_number").notNull().unique(),
    fullName: text("full_name").notNull(),
    position: text("position"),
    salaryType: text("salary_type", { enum: ["monthly", "daily", "hourly"] }),
    baseSalary: text("base_salary"),
    commissionRate: text("commission_rate"), // misal "5" untuk 5%
    hireDate: integer("hire_date", { mode: "timestamp_ms" }).notNull(),
    terminationDate: integer("termination_date", { mode: "timestamp_ms" }),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    branchIdx: index("employees_branch_idx").on(table.branchId),
  }),
);

export const shifts = sqliteTable(
  "shifts",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    cashierId: text("cashier_id")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
    employeeId: text("employee_id").references(() => employees.id, {
      onDelete: "set null",
    }),

    startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
    endTime: integer("end_time", { mode: "timestamp_ms" }),

    startCash: text("start_cash").notNull(),
    expectedEndCash: text("expected_end_cash"),
    actualEndCash: text("actual_end_cash"),
    difference: text("difference"),

    status: text("status", { enum: ["open", "closed"] }).default("open"),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    cashierIdx: index("shifts_cashier_idx").on(table.cashierId),
    branchIdx: index("shifts_branch_idx").on(table.branchId),
  }),
);

export const commissions = sqliteTable("commissions", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .references(() => employees.id, { onDelete: "cascade" })
    .notNull(),
  orderId: text("order_id").references(() => orders.id, {
    onDelete: "cascade",
  }),
  amount: text("amount").notNull(),
  paid: integer("paid", { mode: "boolean" }).default(false),
  paidAt: integer("paid_at", { mode: "timestamp_ms" }),
  ...timestamps,
  ...syncColumns,
});

// ============================================================================
// ACCOUNTING (DOUBLE-ENTRY)
// ============================================================================

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    type: text("type", {
      enum: ["asset", "liability", "equity", "income", "expense"],
    }).notNull(),
    normalBalance: text("normal_balance", {
      enum: ["debit", "credit"],
    }).notNull(),
    parentId: text("parent_id"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    codeUniquePerBranch: uniqueIndex("accounts_code_branch_unique").on(
      table.code,
      table.branchId,
    ),
    parentIdx: index("accounts_parent_idx").on(table.parentId),
  }),
);

export const journalEntries = sqliteTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    branchId: text("branch_id").references(() => branches.id, {
      onDelete: "cascade",
    }),
    entryDate: integer("entry_date", { mode: "timestamp_ms" }).notNull(),
    reference: text("reference"), // nomor jurnal
    description: text("description"),
    createdBy: text("created_by").references(() => users.id),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    approvedBy: text("approved_by").references(() => users.id),
    ...timestamps,
    ...syncColumns,
  },
  (table) => ({
    dateIdx: index("journal_entries_date_idx").on(table.entryDate),
  }),
);

export const journalLines = sqliteTable("journal_lines", {
  id: text("id").primaryKey(),
  journalEntryId: text("journal_entry_id")
    .references(() => journalEntries.id, { onDelete: "cascade" })
    .notNull(),
  accountId: text("account_id")
    .references(() => accounts.id, { onDelete: "restrict" })
    .notNull(),
  debit: text("debit").default("0"),
  credit: text("credit").default("0"),
  description: text("description"),
  ...timestamps,
  ...syncColumns,
});

// ============================================================================
// MARKETPLACE INTEGRATION
// ============================================================================

export const marketplaceConnections = sqliteTable("marketplace_connections", {
  id: text("id").primaryKey(),
  branchId: text("branch_id").references(() => branches.id, {
    onDelete: "cascade",
  }),
  marketplace: text("marketplace", {
    enum: ["tokopedia", "shopee", "lazada", "tiktok"],
  }).notNull(),
  shopId: text("shop_id").notNull(),
  shopName: text("shop_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: integer("token_expires_at", { mode: "timestamp_ms" }),
  settings: text("settings"), // JSON
  isActive: integer("is_active", { mode: "boolean" }).default(true),
  ...timestamps,
  ...syncColumns,
});

export const marketplaceOrders = sqliteTable("marketplace_orders", {
  id: text("id").primaryKey(),
  connectionId: text("connection_id")
    .references(() => marketplaceConnections.id, { onDelete: "cascade" })
    .notNull(),
  marketplaceOrderId: text("marketplace_order_id").notNull(),
  orderData: text("order_data"), // JSON snapshot pesanan dari marketplace
  statusMapping: text("status_mapping"), // status di marketplace vs di POS
  linkedOrderId: text("linked_order_id").references(() => orders.id, {
    onDelete: "set null",
  }),
  importedAt: integer("imported_at", { mode: "timestamp_ms" }),
  ...timestamps,
  ...syncColumns,
});

export const marketplaceProductMapping = sqliteTable(
  "marketplace_product_mapping",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .references(() => marketplaceConnections.id, { onDelete: "cascade" })
      .notNull(),
    productId: text("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    marketplaceProductId: text("marketplace_product_id").notNull(),
    marketplaceSku: text("marketplace_sku"),
    ...timestamps,
    ...syncColumns,
  },
);

// ============================================================================
// AUDIT & SYNC
// ============================================================================

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action", { enum: ["INSERT", "UPDATE", "DELETE"] }).notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  oldData: text("old_data"), // JSON
  newData: text("new_data"), // JSON
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .default(sql`(strftime('%s', 'now') * 1000)`)
    .notNull(),
});

export const syncConflicts = sqliteTable("sync_conflicts", {
  id: text("id").primaryKey(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  clientVersion: integer("client_version").notNull(),
  serverVersion: integer("server_version").notNull(),
  clientData: text("client_data"), // JSON
  serverData: text("server_data"), // JSON
  resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  resolution: text("resolution", {
    enum: ["client_wins", "server_wins", "manual"],
  }),
  ...timestamps,
});

// ============================================================================
// SETTINGS
// ============================================================================

export const storeSettings = sqliteTable("store_settings", {
  id: text("id").primaryKey(),
  branchId: text("branch_id")
    .references(() => branches.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull().default("SmartPOS Store"),
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

  // Cloud sync config
  cloudUrl: text("cloud_url"),
  cloudKey: text("cloud_key"),
  lastSyncAt: integer("last_sync_at", { mode: "timestamp_ms" }),

  ...timestamps,
  ...syncColumns,
});

// ============================================================================
// RELATIONS (didefinisikan di sini agar tidak mengganggu deklarasi tabel)
// ============================================================================

export const branchesRelations = relations(branches, ({ many }) => ({
  users: many(users),
  warehouses: many(warehouses),
  categories: many(categories),
  taxes: many(taxes),
  suppliers: many(suppliers),
  products: many(products),
  ingredients: many(ingredients),
  batches: many(batches),
  stockMovements: many(stockMovements),
  purchaseOrders: many(purchaseOrders),
  members: many(members),
  loyaltyPrograms: many(loyaltyPrograms),
  priceLists: many(priceLists),
  discounts: many(discounts),
  orders: many(orders),
  shipments: many(shipments),
  employees: many(employees),
  shifts: many(shifts),
  accounts: many(accounts),
  journalEntries: many(journalEntries),
  marketplaceConnections: many(marketplaceConnections),
  storeSettings: many(storeSettings),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  branch: one(branches, {
    fields: [users.branchId],
    references: [branches.id],
  }),
  orders: many(orders),
  shifts: many(shifts),
  stockMovements: many(stockMovements),
  purchaseOrders: many(purchaseOrders),
  auditLogs: many(auditLogs),
  journalEntries: many(journalEntries),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  branch: one(branches, {
    fields: [warehouses.branchId],
    references: [branches.id],
  }),
  stockMovements: many(stockMovements),
  purchaseOrders: many(purchaseOrders),
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  branch: one(branches, {
    fields: [categories.branchId],
    references: [branches.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
  }),
  products: many(products),
  ingredients: many(ingredients),
}));

export const taxesRelations = relations(taxes, ({ one, many }) => ({
  branch: one(branches, {
    fields: [taxes.branchId],
    references: [branches.id],
  }),
  account: one(accounts, {
    fields: [taxes.accountId],
    references: [accounts.id],
  }),
  products: many(products),
  purchaseOrderItems: many(purchaseOrderItems),
  orderItems: many(orderItems),
}));

export const suppliersRelations = relations(suppliers, ({ one, many }) => ({
  branch: one(branches, {
    fields: [suppliers.branchId],
    references: [branches.id],
  }),
  ingredients: many(ingredients),
  purchaseOrders: many(purchaseOrders),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  branch: one(branches, {
    fields: [products.branchId],
    references: [branches.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  tax: one(taxes, { fields: [products.taxId], references: [taxes.id] }),
  variants: many(productVariants),
  recipes: many(productRecipes),
  batches: many(batches),
  stockMovements: many(stockMovements),
  purchaseOrderItems: many(purchaseOrderItems),
  priceListItems: many(priceListItems),
  orderItems: many(orderItems),
  marketplaceMappings: many(marketplaceProductMapping),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    stockMovements: many(stockMovements),
    purchaseOrderItems: many(purchaseOrderItems),
    priceListItems: many(priceListItems),
    orderItems: many(orderItems),
  }),
);

export const ingredientsRelations = relations(ingredients, ({ one, many }) => ({
  branch: one(branches, {
    fields: [ingredients.branchId],
    references: [branches.id],
  }),
  supplier: one(suppliers, {
    fields: [ingredients.supplierId],
    references: [suppliers.id],
  }),
  category: one(categories, {
    fields: [ingredients.categoryId],
    references: [categories.id],
  }),
  recipes: many(productRecipes),
  batches: many(batches),
  stockMovements: many(stockMovements),
  purchaseOrderItems: many(purchaseOrderItems),
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

export const batchesRelations = relations(batches, ({ one, many }) => ({
  branch: one(branches, {
    fields: [batches.branchId],
    references: [branches.id],
  }),
  product: one(products, {
    fields: [batches.productId],
    references: [products.id],
  }),
  ingredient: one(ingredients, {
    fields: [batches.ingredientId],
    references: [ingredients.id],
  }),
  stockMovements: many(stockMovements),
  orderItems: many(orderItems),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  branch: one(branches, {
    fields: [stockMovements.branchId],
    references: [branches.id],
  }),
  warehouse: one(warehouses, {
    fields: [stockMovements.warehouseId],
    references: [warehouses.id],
  }),
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [stockMovements.variantId],
    references: [productVariants.id],
  }),
  ingredient: one(ingredients, {
    fields: [stockMovements.ingredientId],
    references: [ingredients.id],
  }),
  batch: one(batches, {
    fields: [stockMovements.batchId],
    references: [batches.id],
  }),
  user: one(users, { fields: [stockMovements.userId], references: [users.id] }),
}));

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [purchaseOrders.branchId],
      references: [branches.id],
    }),
    supplier: one(suppliers, {
      fields: [purchaseOrders.supplierId],
      references: [suppliers.id],
    }),
    warehouse: one(warehouses, {
      fields: [purchaseOrders.warehouseId],
      references: [warehouses.id],
    }),
    user: one(users, {
      fields: [purchaseOrders.userId],
      references: [users.id],
    }),
    items: many(purchaseOrderItems),
  }),
);

export const purchaseOrderItemsRelations = relations(
  purchaseOrderItems,
  ({ one }) => ({
    purchaseOrder: one(purchaseOrders, {
      fields: [purchaseOrderItems.purchaseOrderId],
      references: [purchaseOrders.id],
    }),
    product: one(products, {
      fields: [purchaseOrderItems.productId],
      references: [products.id],
    }),
    variant: one(productVariants, {
      fields: [purchaseOrderItems.variantId],
      references: [productVariants.id],
    }),
    ingredient: one(ingredients, {
      fields: [purchaseOrderItems.ingredientId],
      references: [ingredients.id],
    }),
    tax: one(taxes, {
      fields: [purchaseOrderItems.taxId],
      references: [taxes.id],
    }),
  }),
);

export const membersRelations = relations(members, ({ one, many }) => ({
  branch: one(branches, {
    fields: [members.branchId],
    references: [branches.id],
  }),
  loyaltyAccounts: many(loyaltyAccounts),
  orders: many(orders),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  // polymorphic, tidak bisa di-define dengan one secara langsung, akan di-handle di aplikasi
}));

export const loyaltyProgramsRelations = relations(
  loyaltyPrograms,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [loyaltyPrograms.branchId],
      references: [branches.id],
    }),
    accounts: many(loyaltyAccounts),
  }),
);

export const loyaltyAccountsRelations = relations(
  loyaltyAccounts,
  ({ one, many }) => ({
    member: one(members, {
      fields: [loyaltyAccounts.memberId],
      references: [members.id],
    }),
    program: one(loyaltyPrograms, {
      fields: [loyaltyAccounts.programId],
      references: [loyaltyPrograms.id],
    }),
    transactions: many(loyaltyTransactions),
  }),
);

export const loyaltyTransactionsRelations = relations(
  loyaltyTransactions,
  ({ one }) => ({
    account: one(loyaltyAccounts, {
      fields: [loyaltyTransactions.accountId],
      references: [loyaltyAccounts.id],
    }),
  }),
);

export const priceListsRelations = relations(priceLists, ({ one, many }) => ({
  branch: one(branches, {
    fields: [priceLists.branchId],
    references: [branches.id],
  }),
  items: many(priceListItems),
}));

export const priceListItemsRelations = relations(priceListItems, ({ one }) => ({
  priceList: one(priceLists, {
    fields: [priceListItems.priceListId],
    references: [priceLists.id],
  }),
  product: one(products, {
    fields: [priceListItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [priceListItems.variantId],
    references: [productVariants.id],
  }),
}));

export const discountsRelations = relations(discounts, ({ one, many }) => ({
  branch: one(branches, {
    fields: [discounts.branchId],
    references: [branches.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  branch: one(branches, {
    fields: [orders.branchId],
    references: [branches.id],
  }),
  warehouse: one(warehouses, {
    fields: [orders.warehouseId],
    references: [warehouses.id],
  }),
  member: one(members, { fields: [orders.memberId], references: [members.id] }),
  discount: one(discounts, {
    fields: [orders.discountId],
    references: [discounts.id],
  }),
  cashier: one(users, { fields: [orders.cashierId], references: [users.id] }),
  items: many(orderItems),
  payments: many(orderPayments),
  shipment: one(shipments, {
    fields: [orders.shipmentId],
    references: [shipments.id],
  }),
  shippingAddress: one(addresses, {
    fields: [orders.shippingAddressId],
    references: [addresses.id],
  }),
  billingAddress: one(addresses, {
    fields: [orders.billingAddressId],
    references: [addresses.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
  }),
  batch: one(batches, {
    fields: [orderItems.batchId],
    references: [batches.id],
  }),
  tax: one(taxes, { fields: [orderItems.taxId], references: [taxes.id] }),
}));

export const orderPaymentsRelations = relations(orderPayments, ({ one }) => ({
  order: one(orders, {
    fields: [orderPayments.orderId],
    references: [orders.id],
  }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  branch: one(branches, {
    fields: [shipments.branchId],
    references: [branches.id],
  }),
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  originAddress: one(addresses, {
    fields: [shipments.originAddressId],
    references: [addresses.id],
  }),
  destinationAddress: one(addresses, {
    fields: [shipments.destinationAddressId],
    references: [addresses.id],
  }),
  items: many(shipmentItems),
}));

export const shipmentItemsRelations = relations(shipmentItems, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentItems.shipmentId],
    references: [shipments.id],
  }),
  orderItem: one(orderItems, {
    fields: [shipmentItems.orderItemId],
    references: [orderItems.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  branch: one(branches, {
    fields: [employees.branchId],
    references: [branches.id],
  }),
  user: one(users, { fields: [employees.userId], references: [users.id] }),
  shifts: many(shifts),
  commissions: many(commissions),
}));

export const shiftsRelations = relations(shifts, ({ one }) => ({
  branch: one(branches, {
    fields: [shifts.branchId],
    references: [branches.id],
  }),
  cashier: one(users, { fields: [shifts.cashierId], references: [users.id] }),
  employee: one(employees, {
    fields: [shifts.employeeId],
    references: [employees.id],
  }),
}));

export const commissionsRelations = relations(commissions, ({ one }) => ({
  employee: one(employees, {
    fields: [commissions.employeeId],
    references: [employees.id],
  }),
  order: one(orders, {
    fields: [commissions.orderId],
    references: [orders.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  branch: one(branches, {
    fields: [accounts.branchId],
    references: [branches.id],
  }),
  parent: one(accounts, {
    fields: [accounts.parentId],
    references: [accounts.id],
  }),
  children: many(accounts),
  journalLines: many(journalLines),
  taxes: many(taxes),
}));

export const journalEntriesRelations = relations(
  journalEntries,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [journalEntries.branchId],
      references: [branches.id],
    }),
    createdByUser: one(users, {
      fields: [journalEntries.createdBy],
      references: [users.id],
    }),
    approvedByUser: one(users, {
      fields: [journalEntries.approvedBy],
      references: [users.id],
    }),
    lines: many(journalLines),
  }),
);

export const journalLinesRelations = relations(journalLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalLines.accountId],
    references: [accounts.id],
  }),
}));

export const marketplaceConnectionsRelations = relations(
  marketplaceConnections,
  ({ one, many }) => ({
    branch: one(branches, {
      fields: [marketplaceConnections.branchId],
      references: [branches.id],
    }),
    orders: many(marketplaceOrders),
    productMappings: many(marketplaceProductMapping),
  }),
);

export const marketplaceOrdersRelations = relations(
  marketplaceOrders,
  ({ one }) => ({
    connection: one(marketplaceConnections, {
      fields: [marketplaceOrders.connectionId],
      references: [marketplaceConnections.id],
    }),
    linkedOrder: one(orders, {
      fields: [marketplaceOrders.linkedOrderId],
      references: [orders.id],
    }),
  }),
);

export const marketplaceProductMappingRelations = relations(
  marketplaceProductMapping,
  ({ one }) => ({
    connection: one(marketplaceConnections, {
      fields: [marketplaceProductMapping.connectionId],
      references: [marketplaceConnections.id],
    }),
    product: one(products, {
      fields: [marketplaceProductMapping.productId],
      references: [products.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const storeSettingsRelations = relations(storeSettings, ({ one }) => ({
  branch: one(branches, {
    fields: [storeSettings.branchId],
    references: [branches.id],
  }),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Warehouse = typeof warehouses.$inferSelect;
export type NewWarehouse = typeof warehouses.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Tax = typeof taxes.$inferSelect;
export type NewTax = typeof taxes.$inferInsert;

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

export type ProductVariant = typeof productVariants.$inferSelect;
export type NewProductVariant = typeof productVariants.$inferInsert;

export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;

export type ProductRecipe = typeof productRecipes.$inferSelect;
export type NewProductRecipe = typeof productRecipes.$inferInsert;

export type Batch = typeof batches.$inferSelect;
export type NewBatch = typeof batches.$inferInsert;

export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;

export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Address = typeof addresses.$inferSelect;
export type NewAddress = typeof addresses.$inferInsert;

export type LoyaltyProgram = typeof loyaltyPrograms.$inferSelect;
export type NewLoyaltyProgram = typeof loyaltyPrograms.$inferInsert;

export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
export type NewLoyaltyAccount = typeof loyaltyAccounts.$inferInsert;

export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;
export type NewLoyaltyTransaction = typeof loyaltyTransactions.$inferInsert;

export type PriceList = typeof priceLists.$inferSelect;
export type NewPriceList = typeof priceLists.$inferInsert;

export type PriceListItem = typeof priceListItems.$inferSelect;
export type NewPriceListItem = typeof priceListItems.$inferInsert;

export type Discount = typeof discounts.$inferSelect;
export type NewDiscount = typeof discounts.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type OrderItem = typeof orderItems.$inferSelect;
export type NewOrderItem = typeof orderItems.$inferInsert;

export type OrderPayment = typeof orderPayments.$inferSelect;
export type NewOrderPayment = typeof orderPayments.$inferInsert;

export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;

export type ShipmentItem = typeof shipmentItems.$inferSelect;
export type NewShipmentItem = typeof shipmentItems.$inferInsert;

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;

export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;

export type Commission = typeof commissions.$inferSelect;
export type NewCommission = typeof commissions.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;

export type JournalLine = typeof journalLines.$inferSelect;
export type NewJournalLine = typeof journalLines.$inferInsert;

export type MarketplaceConnection = typeof marketplaceConnections.$inferSelect;
export type NewMarketplaceConnection =
  typeof marketplaceConnections.$inferInsert;

export type MarketplaceOrder = typeof marketplaceOrders.$inferSelect;
export type NewMarketplaceOrder = typeof marketplaceOrders.$inferInsert;

export type MarketplaceProductMapping =
  typeof marketplaceProductMapping.$inferSelect;
export type NewMarketplaceProductMapping =
  typeof marketplaceProductMapping.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

export type SyncConflict = typeof syncConflicts.$inferSelect;
export type NewSyncConflict = typeof syncConflicts.$inferInsert;

export type StoreSetting = typeof storeSettings.$inferSelect;
export type NewStoreSetting = typeof storeSettings.$inferInsert;

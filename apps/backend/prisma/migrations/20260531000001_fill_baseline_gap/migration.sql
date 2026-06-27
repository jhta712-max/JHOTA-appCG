-- Fill baseline gap: creates objects that exist in 20260531000000_init_baseline
-- but were NOT created by the pre-baseline migrations (20260518*).
-- Uses IF NOT EXISTS throughout so this is a no-op on DBs that already ran the baseline.

-- Missing enums (CREATE TYPE has no IF NOT EXISTS for enums in PostgreSQL — use DO blocks)
DO $$ BEGIN CREATE TYPE "quotation_status" AS ENUM ('PENDING', 'APPROVED', 'ADVANCE_PAID', 'IN_PROGRESS', 'PARTIAL_INVOICED', 'INVOICED', 'PAID', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "quotation_link_type" AS ENUM ('ADVANCE', 'PARTIAL_INVOICE', 'FINAL_INVOICE', 'COMPLEMENTARY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "office_expense_category" AS ENUM ('CLEANING_SUPPLIES', 'CONSUMABLES', 'OFFICE_SERVICES', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "office_expense_status" AS ENUM ('ACTIVE', 'VOIDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Missing tables
CREATE TABLE IF NOT EXISTS "company_cards" (
    "id" SERIAL NOT NULL,
    "holder_name" VARCHAR(150) NOT NULL,
    "last_four" VARCHAR(4) NOT NULL,
    "card_type" VARCHAR(30) NOT NULL,
    "bank" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_cards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quotations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "category_id" INTEGER,
    "supplier_name" VARCHAR(200) NOT NULL,
    "supplier_rnc" VARCHAR(11),
    "quotation_number" VARCHAR(50),
    "quotation_date" DATE NOT NULL,
    "valid_until" DATE,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'DOP',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "itbis_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "description" TEXT NOT NULL,
    "payment_terms" TEXT,
    "advance_pct" DECIMAL(5,2),
    "delivery_days" INTEGER,
    "observations" TEXT,
    "status" "quotation_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quotation_payments" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "expense_id" UUID,
    "sequence" INTEGER NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "paymentMethod" "payment_method" NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quotation_expense_links" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "expense_id" UUID NOT NULL,
    "linkType" "quotation_link_type" NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_expense_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "beneficiaries" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "bank" VARCHAR(100) NOT NULL,
    "account_type" VARCHAR(30) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "cedula" VARCHAR(20),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payment_orders" (
    "id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "order_type" VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
    "paying_company" VARCHAR(200) NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'RD$',
    "concept" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "generated_text" TEXT,
    "notes" VARCHAR(500),
    "paid_at" TIMESTAMP(3),
    "paid_by_id" UUID,
    "payroll_id" UUID,
    "expense_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "office_expenses" (
    "id" UUID NOT NULL,
    "category" "office_expense_category" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "payment_method" "payment_method" NOT NULL,
    "company_card_id" INTEGER,
    "has_fiscal_doc" BOOLEAN NOT NULL DEFAULT false,
    "fiscal_doc_num" VARCHAR(50),
    "notes" TEXT,
    "receipt_url" VARCHAR(500),
    "status" "office_expense_status" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "office_expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "quotation_attachments" (
    "id" UUID NOT NULL,
    "quotation_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_attachments_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "quotations_project_id_idx" ON "quotations"("project_id");
CREATE INDEX IF NOT EXISTS "quotations_status_idx" ON "quotations"("status");
CREATE INDEX IF NOT EXISTS "quotations_supplier_name_idx" ON "quotations"("supplier_name");
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_project_id_number_key" ON "quotations"("project_id", "number");

CREATE UNIQUE INDEX IF NOT EXISTS "quotation_payments_expense_id_key" ON "quotation_payments"("expense_id");
CREATE INDEX IF NOT EXISTS "quotation_payments_quotation_id_idx" ON "quotation_payments"("quotation_id");
CREATE INDEX IF NOT EXISTS "quotation_payments_expense_id_idx" ON "quotation_payments"("expense_id");
CREATE UNIQUE INDEX IF NOT EXISTS "quotation_payments_quotation_id_sequence_key" ON "quotation_payments"("quotation_id", "sequence");

CREATE UNIQUE INDEX IF NOT EXISTS "quotation_expense_links_expense_id_key" ON "quotation_expense_links"("expense_id");
CREATE INDEX IF NOT EXISTS "quotation_expense_links_quotation_id_idx" ON "quotation_expense_links"("quotation_id");

CREATE INDEX IF NOT EXISTS "beneficiaries_name_idx" ON "beneficiaries"("name");
CREATE INDEX IF NOT EXISTS "beneficiaries_is_active_idx" ON "beneficiaries"("is_active");

CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_payroll_id_key" ON "payment_orders"("payroll_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_expense_id_key" ON "payment_orders"("expense_id");
CREATE INDEX IF NOT EXISTS "payment_orders_status_idx" ON "payment_orders"("status");
CREATE INDEX IF NOT EXISTS "payment_orders_project_id_idx" ON "payment_orders"("project_id");
CREATE INDEX IF NOT EXISTS "payment_orders_beneficiary_id_idx" ON "payment_orders"("beneficiary_id");
CREATE INDEX IF NOT EXISTS "payment_orders_created_at_idx" ON "payment_orders"("created_at");

CREATE INDEX IF NOT EXISTS "office_expenses_category_idx" ON "office_expenses"("category");
CREATE INDEX IF NOT EXISTS "office_expenses_expense_date_idx" ON "office_expenses"("expense_date");
CREATE INDEX IF NOT EXISTS "office_expenses_created_at_idx" ON "office_expenses"("created_at");

CREATE INDEX IF NOT EXISTS "quotation_attachments_quotation_id_idx" ON "quotation_attachments"("quotation_id");

-- Foreign keys (wrapped in DO blocks to be idempotent)
DO $$ BEGIN
  ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_card_id_fkey" FOREIGN KEY ("company_card_id") REFERENCES "company_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotations" ADD CONSTRAINT "quotations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotations" ADD CONSTRAINT "quotations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_payments" ADD CONSTRAINT "quotation_payments_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_payments" ADD CONSTRAINT "quotation_payments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_payments" ADD CONSTRAINT "quotation_payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_expense_links" ADD CONSTRAINT "quotation_expense_links_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_expense_links" ADD CONSTRAINT "quotation_expense_links_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_expense_links" ADD CONSTRAINT "quotation_expense_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "beneficiaries" ADD CONSTRAINT "beneficiaries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_paid_by_id_fkey" FOREIGN KEY ("paid_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payroll_id_fkey" FOREIGN KEY ("payroll_id") REFERENCES "payrolls"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "office_expenses" ADD CONSTRAINT "office_expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "office_expenses" ADD CONSTRAINT "office_expenses_company_card_id_fkey" FOREIGN KEY ("company_card_id") REFERENCES "company_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "quotation_attachments" ADD CONSTRAINT "quotation_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

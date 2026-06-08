-- Cuentas bancarias múltiples por suplidor
CREATE TABLE "supplier_bank_accounts" (
    "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
    "supplier_id"    UUID        NOT NULL,
    "bank"           VARCHAR(100) NOT NULL,
    "account_type"   VARCHAR(30)  NOT NULL DEFAULT 'Cuenta de Ahorros',
    "account_number" VARCHAR(50)  NOT NULL,
    "is_default"     BOOLEAN     NOT NULL DEFAULT false,
    "notes"          VARCHAR(200),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_bank_accounts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "supplier_bank_accounts"
  ADD CONSTRAINT "supplier_bank_accounts_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE;

CREATE INDEX "supplier_bank_accounts_supplier_id_idx" ON "supplier_bank_accounts"("supplier_id");

-- Migrar datos bancarios existentes de suppliers
INSERT INTO "supplier_bank_accounts" ("supplier_id", "bank", "account_type", "account_number", "is_default")
SELECT "id",
       "bank",
       COALESCE("account_type", 'Cuenta de Ahorros'),
       "account_number",
       true
FROM "suppliers"
WHERE "bank" IS NOT NULL
  AND "account_number" IS NOT NULL
  AND "bank" <> ''
  AND "account_number" <> '';

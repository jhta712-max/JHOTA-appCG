CREATE TABLE "service_subscriptions" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "name"           TEXT NOT NULL,
  "provider"       TEXT NOT NULL,
  "description"    TEXT,
  "monthly_cost"   DECIMAL(10,2) NOT NULL,
  "currency"       TEXT NOT NULL DEFAULT 'USD',
  "billing_day"    INTEGER NOT NULL,
  "payment_method" TEXT,
  "url"            TEXT,
  "is_active"      BOOLEAN NOT NULL DEFAULT true,
  "notes"          TEXT,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_subscriptions_pkey" PRIMARY KEY ("id")
);

-- Add SERVICE_PAYMENT to NotificationType if it exists as an enum
-- (in this schema notifications use a plain VARCHAR type column, so no enum change needed)

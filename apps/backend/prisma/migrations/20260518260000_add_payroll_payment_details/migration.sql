-- Add payment detail fields to payrolls
ALTER TABLE "payrolls"
  ADD COLUMN "payment_method"    VARCHAR(20),
  ADD COLUMN "payment_bank"      VARCHAR(100),
  ADD COLUMN "payment_reference" VARCHAR(100),
  ADD COLUMN "payment_date"      DATE;

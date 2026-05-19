-- Migration: add receipt_number and received_by to payrolls
ALTER TABLE "payrolls"
  ADD COLUMN "receipt_number" VARCHAR(50),
  ADD COLUMN "received_by"    VARCHAR(100);

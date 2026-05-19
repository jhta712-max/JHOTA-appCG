-- Add supplier_name and bank_account to payroll_lines
ALTER TABLE "payroll_lines"
  ADD COLUMN "supplier_name" VARCHAR(200),
  ADD COLUMN "bank_account"  VARCHAR(100);

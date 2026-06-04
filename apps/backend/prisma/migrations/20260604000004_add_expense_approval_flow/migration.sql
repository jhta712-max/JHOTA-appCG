-- AlterEnum: add PENDING_APPROVAL and REJECTED to expense_status
ALTER TYPE "expense_status" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "expense_status" ADD VALUE 'REJECTED';

-- AlterTable: add approval/rejection audit fields
ALTER TABLE "expenses" ADD COLUMN "rejection_reason" TEXT;
ALTER TABLE "expenses" ADD COLUMN "approved_by_id"   UUID;
ALTER TABLE "expenses" ADD COLUMN "approved_at"      TIMESTAMP(3);
ALTER TABLE "expenses" ADD COLUMN "rejected_by_id"   UUID;
ALTER TABLE "expenses" ADD COLUMN "rejected_at"      TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_id_fkey"
  FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_rejected_by_id_fkey"
  FOREIGN KEY ("rejected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

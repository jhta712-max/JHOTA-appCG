-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "payment_method" "payment_method",
ADD COLUMN     "exchange_rate" DECIMAL(10,4),
ADD COLUMN     "exchange_rate_validated_by" UUID,
ADD COLUMN     "exchange_rate_validated_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_exchange_rate_validated_by_fkey" FOREIGN KEY ("exchange_rate_validated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

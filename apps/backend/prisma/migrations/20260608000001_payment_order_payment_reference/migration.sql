-- Agregar campos de comprobante de transferencia a payment_orders
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS payment_bank      VARCHAR(100),
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100);

COMMENT ON COLUMN payment_orders.payment_bank      IS 'Banco emisor de la transferencia';
COMMENT ON COLUMN payment_orders.payment_reference IS 'No. de transacción / comprobante de transferencia';

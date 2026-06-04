-- ========================================================
-- MIGRAR TIPOS DE ÓRDENES DE PAGO: GENERAL → SERVICIO
-- ========================================================

-- Cambiar todos los 'GENERAL' a 'SERVICIO' en las órdenes de pago
UPDATE payment_orders
SET order_type = 'SERVICIO'
WHERE order_type = 'GENERAL';

-- Verificar el resultado
SELECT order_type, COUNT(*) as count
FROM payment_orders
GROUP BY order_type
ORDER BY count DESC;

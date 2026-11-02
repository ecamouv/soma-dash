-- Elimina client_payments (fechas de pago sueltas), reemplazada por client_billing y client_payment_months.
-- Sin CASCADE a propósito: si algo en la base aún depende de la tabla, el drop falla en vez de borrar ese objeto.
drop table if exists public.client_payments;

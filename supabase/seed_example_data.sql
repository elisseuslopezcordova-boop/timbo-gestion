-- Datos de ejemplo mínimos para probar que las tablas y las políticas
-- funcionan. Correr DESPUÉS de 20260709120000_init_schema.sql.
-- Los precios son reales (catálogo público de timbo9.mitiendanube.com);
-- el costo de producción es un valor de ejemplo para probar el cálculo
-- de márgenes, no el costo real.

insert into productos (nombre, categoria, sku, precio_venta, costo_produccion, umbral_stock_bajo, origen)
values
  ('Matera Timbó Chocolate, Solapa', 'Materas', 'MAT-CHO-SOL', 187500, 96000, 3, 'manual'),
  ('Cartera de Cuero Timbó', 'Carteras', 'CAR-01', 163000, 84000, 6, 'manual'),
  ('Yerbero de Gamuza 500 gr', 'Yerberos', 'YER-500', 21600, 9500, 8, 'manual');

insert into movimientos_stock (producto_id, tipo, cantidad, fecha, motivo)
select id, 'entrada', 8, current_date - interval '10 days', 'Producción'
from productos where sku = 'MAT-CHO-SOL';

insert into movimientos_stock (producto_id, tipo, cantidad, fecha, motivo)
select id, 'salida', 2, current_date - interval '3 days', 'Venta'
from productos where sku = 'MAT-CHO-SOL';

insert into transacciones (fecha, tipo, monto, categoria, descripcion, origen)
values
  (current_date - interval '3 days', 'ingreso', 375000, 'Venta minorista', '2 Materas Chocolate Solapa', 'manual'),
  (current_date - interval '10 days', 'egreso', 130000, 'Gastos fijos', 'Alquiler taller', 'manual');

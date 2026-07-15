export type Origen = "tn" | "manual";

export interface Producto {
  id: string;
  tn_product_id: string | null;
  nombre: string;
  categoria: string;
  sku: string | null;
  precio_venta: number;
  costo_produccion: number;
  umbral_stock_bajo: number;
  origen: Origen;
  created_at: string;
}

export type TipoMovimiento = "entrada" | "salida";

export interface MovimientoStock {
  id: string;
  producto_id: string;
  tipo: TipoMovimiento;
  cantidad: number;
  fecha: string;
  motivo: string | null;
  nota: string | null;
  tn_order_id: string | null;
  created_at: string;
}

export type TipoTransaccion = "ingreso" | "egreso";

export interface Transaccion {
  id: string;
  fecha: string;
  tipo: TipoTransaccion;
  monto: number;
  categoria: string;
  descripcion: string | null;
  tn_order_id: string | null;
  origen: Origen;
  created_at: string;
}

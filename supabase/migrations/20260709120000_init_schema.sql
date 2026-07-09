-- Timbó Gestión — esquema inicial (Fase 1)
-- Tablas + Row Level Security. Pensado para un solo usuario dueño (Trini)
-- autenticado con Supabase Auth: cualquier usuario logueado puede
-- leer/escribir productos, stock y transacciones. tn_connection y
-- webhook_events quedan bloqueadas para el frontend (solo service_role,
-- usado desde Edge Functions, puede tocarlas).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- tn_connection: guarda el token de Tienda Nube. Nunca se lee desde el
-- frontend (RLS habilitado sin policies = acceso bloqueado para
-- anon/authenticated; service_role bypassa RLS).
-- ---------------------------------------------------------------------
create table tn_connection (
  id uuid primary key default gen_random_uuid(),
  store_id text not null,
  access_token text not null,
  scope text,
  connected_at timestamptz not null default now()
);
alter table tn_connection enable row level security;

-- ---------------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------------
create table productos (
  id uuid primary key default gen_random_uuid(),
  tn_product_id text,
  nombre text not null,
  categoria text,
  sku text,
  precio_venta numeric(12,2) not null default 0,
  costo_produccion numeric(12,2) not null default 0,
  umbral_stock_bajo integer not null default 0,
  origen text not null default 'manual' check (origen in ('tn', 'manual')),
  created_at timestamptz not null default now()
);
alter table productos enable row level security;

create policy "authenticated puede leer productos"
  on productos for select
  to authenticated
  using (true);

create policy "authenticated puede escribir productos"
  on productos for insert
  to authenticated
  with check (true);

create policy "authenticated puede actualizar productos"
  on productos for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated puede borrar productos"
  on productos for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- movimientos_stock
-- ---------------------------------------------------------------------
create table movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references productos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida')),
  cantidad integer not null check (cantidad > 0),
  fecha date not null default current_date,
  motivo text,
  nota text,
  tn_order_id text,
  created_at timestamptz not null default now()
);
alter table movimientos_stock enable row level security;

create policy "authenticated puede leer movimientos"
  on movimientos_stock for select
  to authenticated
  using (true);

create policy "authenticated puede escribir movimientos"
  on movimientos_stock for insert
  to authenticated
  with check (true);

create policy "authenticated puede actualizar movimientos"
  on movimientos_stock for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated puede borrar movimientos"
  on movimientos_stock for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- transacciones
-- ---------------------------------------------------------------------
create table transacciones (
  id uuid primary key default gen_random_uuid(),
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso', 'egreso')),
  monto numeric(12,2) not null check (monto > 0),
  categoria text,
  descripcion text,
  tn_order_id text,
  origen text not null default 'manual' check (origen in ('tn', 'manual')),
  created_at timestamptz not null default now()
);
alter table transacciones enable row level security;

create policy "authenticated puede leer transacciones"
  on transacciones for select
  to authenticated
  using (true);

create policy "authenticated puede escribir transacciones"
  on transacciones for insert
  to authenticated
  with check (true);

create policy "authenticated puede actualizar transacciones"
  on transacciones for update
  to authenticated
  using (true)
  with check (true);

create policy "authenticated puede borrar transacciones"
  on transacciones for delete
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- webhook_events: idempotencia de webhooks de Tienda Nube. Bloqueada
-- para el frontend, solo la tocan las Edge Functions (service_role).
-- ---------------------------------------------------------------------
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  tn_event text not null,
  tn_resource_id text not null,
  payload jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tn_event, tn_resource_id)
);
alter table webhook_events enable row level security;

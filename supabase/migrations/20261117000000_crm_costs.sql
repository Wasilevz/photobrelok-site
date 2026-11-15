-- Себестоимость и чистая прибыль: коробки и прочие расходы по заказу + настройки CRM.
-- Только добавление: существующие строки и данные не меняются (новые поля пустые = «по правилу»).
alter table public.crm_orders
  add column if not exists boxes_single integer check (boxes_single between 0 and 40),
  add column if not exists boxes_double integer check (boxes_double between 0 and 40),
  add column if not exists extra_cost integer check (extra_cost between 0 and 100000);

create table if not exists public.crm_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.crm_settings enable row level security;
revoke all on public.crm_settings from anon, authenticated;

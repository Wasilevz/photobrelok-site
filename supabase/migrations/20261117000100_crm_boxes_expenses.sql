-- Одна подарочная коробка вместо двух типов + расходы бизнеса (реклама и т. п.) для чистой прибыли.
-- Только добавление. boxes_single / boxes_double из прошлой миграции не используются (пустые).
alter table public.crm_orders
  add column if not exists boxes integer check (boxes between 0 and 40);

create table if not exists public.crm_expenses (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  amount integer not null check (amount between 0 and 10000000),
  note text not null default '' check (char_length(note) <= 200),
  created_by text,
  created_at timestamptz not null default now(),
  updated_by text,
  updated_at timestamptz not null default now()
);
create index if not exists crm_expenses_day on public.crm_expenses (day);
alter table public.crm_expenses enable row level security;
revoke all on public.crm_expenses from anon, authenticated;

-- CRM заказов брелков. Только создание: ни drop, ни delete, ни truncate.
-- Старая таблица public.orders не трогается.

create table if not exists public.crm_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  stage text not null default 'new' check (stage in ('new', 'production', 'ready', 'done')),
  stage_changed_at timestamptz not null default now(),
  name text not null,
  phone text not null,
  wanted_date date,
  urgent boolean not null default false,
  method text not null default 'pickup' check (method in ('pickup', 'posta', 'novapost', 'taxi', 'later')),
  postal_code text,
  city text,
  district text,
  street text,
  branch text,
  address text,
  qty int not null default 1 check (qty between 1 and 20),
  price int check (price is null or price >= 0),
  lang text not null default 'ru' check (lang in ('ru', 'ro')),
  source text,
  pdf_path text,
  tg_chat_id bigint,
  tg_message_id int,
  tg_caption text,
  flags text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists crm_orders_stage_idx on public.crm_orders (stage);
create index if not exists crm_orders_created_idx on public.crm_orders (created_at desc);

create table if not exists public.crm_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.crm_orders (id),
  author_id bigint,
  author_name text not null,
  text text not null check (char_length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists crm_comments_order_idx on public.crm_comments (order_id, created_at);

create table if not exists public.crm_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.crm_orders (id),
  actor_id bigint,
  actor_name text not null,
  action text not null check (action in ('created', 'imported', 'stage', 'field', 'comment')),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists crm_history_order_idx on public.crm_history (order_id, created_at);

create or replace function public.crm_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace trigger crm_orders_touch before update on public.crm_orders
  for each row execute function public.crm_touch_updated_at();

-- Доступ только с сервера (сервисный ключ). Без политик анонимный ключ ничего не видит.
alter table public.crm_orders enable row level security;
alter table public.crm_comments enable row level security;
alter table public.crm_history enable row level security;

-- Приватный бакет для PDF-макетов.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-pdfs', 'order-pdfs', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

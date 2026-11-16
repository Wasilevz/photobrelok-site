-- «Удалить» в CRM = убрать из CRM: строка, PDF в хранилище и сообщение в чате остаются (запрет владельца на удаления).
alter table public.crm_orders
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by text;
create index if not exists crm_orders_active on public.crm_orders (created_at) where deleted_at is null;

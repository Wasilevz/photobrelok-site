-- Деньги по заказу: когда реально получены (предоплата / выдача / деньги с почты) и возвраты (посылку не забрали).
-- В выручку и прибыль идут только заказы с money_at. Только добавление полей + разовая отметка старых
-- завершённых заказов как оплаченных в день завершения (иначе отчёт за ноябрь обнулится).
alter table public.crm_orders
  add column if not exists money_at timestamptz,
  add column if not exists returned_at timestamptz;
update public.crm_orders set money_at = stage_changed_at where stage = 'done' and money_at is null and returned_at is null;
update public.crm_orders set money_at = coalesce(money_at, created_at) where paid and money_at is null;

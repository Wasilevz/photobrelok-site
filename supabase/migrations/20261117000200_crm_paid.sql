-- Заказ оплачен заранее на карту (при выдаче/отправке деньги не брать). Только добавление.
alter table public.crm_orders
  add column if not exists paid boolean not null default false;

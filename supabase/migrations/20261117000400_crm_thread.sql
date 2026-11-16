-- В какой теме группы лежит сообщение заказа (для переноса между темами-стадиями). null — тема стадии по умолчанию.
alter table public.crm_orders add column if not exists tg_thread_id integer;

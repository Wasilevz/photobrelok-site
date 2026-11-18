-- Трек-код посылки (Poșta Moldovei / Nova Poshta): SMS почты об оплате приходит только с трек-кодом,
-- по нему находим заказ и отмечаем «деньги получены». Только добавление поля.
alter table public.crm_orders add column if not exists track text;
create index if not exists crm_orders_track on public.crm_orders (track) where track is not null;

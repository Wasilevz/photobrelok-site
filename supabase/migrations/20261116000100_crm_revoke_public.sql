-- Таблицы CRM не видны публичному и пользовательскому ключу (доступ только с сервера).
revoke all on public.crm_orders, public.crm_comments, public.crm_history from anon, authenticated;

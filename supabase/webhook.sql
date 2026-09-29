-- Notify on new ad_reports: DB trigger → pg_net POST → Edge Function notify-ad-report → Resend email.
-- Run AFTER schema.sql. Replace the two placeholders first:
--   __FUNCTION_URL__   e.g. https://abcdefghijklmnop.supabase.co/functions/v1/notify-ad-report
--   __NOTIFY_SECRET__  the same value you set as the NOTIFY_SECRET edge-function secret

create extension if not exists pg_net with schema extensions;

-- Settings live in a tiny table so the trigger has no hard-coded values.
create table if not exists app_settings (key text primary key, value text not null);
alter table app_settings enable row level security;   -- no policies → not readable via the API
insert into app_settings (key, value) values
  ('notify_url',    '__FUNCTION_URL__'),
  ('notify_secret', '__NOTIFY_SECRET__')
on conflict (key) do update set value = excluded.value;

create or replace function notify_ad_report()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url    text;
  v_secret text;
  v_body   jsonb;
  v_measure record;
begin
  select value into v_url    from app_settings where key = 'notify_url';
  select value into v_secret from app_settings where key = 'notify_secret';
  if v_url is null or v_secret is null then return new; end if;

  select number, short_title into v_measure from measures where id = new.measure_id;

  v_body := jsonb_build_object(
    'type', 'INSERT', 'table', 'ad_reports',
    'record', to_jsonb(new)
      || jsonb_build_object('measure_number', v_measure.number, 'measure_title', v_measure.short_title)
  );

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body    := v_body
  );
  return new;
end;
$$;

drop trigger if exists ad_reports_notify on ad_reports;
create trigger ad_reports_notify
  after insert on ad_reports
  for each row execute function notify_ad_report();

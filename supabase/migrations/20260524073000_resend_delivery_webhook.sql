alter table public.delivery_records
  add column if not exists provider_message_id text,
  add column if not exists provider_event_type text,
  add column if not exists provider_event_at timestamptz;

alter table public.delivery_records
  drop constraint if exists delivery_records_status_check;

alter table public.delivery_records
  add constraint delivery_records_status_check
  check (status in (
    'queued',
    'sent',
    'delivered',
    'delivery_delayed',
    'bounced',
    'complained',
    'failed',
    'cancelled'
  ));

create unique index if not exists delivery_records_provider_message_id_idx
  on public.delivery_records(provider_message_id)
  where provider_message_id is not null;

comment on column public.delivery_records.provider_message_id is '邮件服务商返回的消息 ID，用于 webhook 回写真实投递状态。';
comment on column public.delivery_records.provider_event_type is '最近一次服务商事件类型，例如 email.delivered。';
comment on column public.delivery_records.provider_event_at is '最近一次服务商事件发生时间。';
comment on column public.delivery_records.status is '投递状态：排队、已提交服务商、已送达、投递延迟、退信、投诉、失败或取消。';

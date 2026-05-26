create table if not exists public.mcp_token_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_id uuid references public.mcp_tokens(id) on delete set null,
  token_prefix text,
  tool_name text not null,
  status text not null,
  error_code text,
  error_message text,
  duration_ms integer not null default 0,
  created_at timestamptz not null default now(),
  constraint mcp_token_events_status_check check (status in ('success', 'failure')),
  constraint mcp_token_events_duration_ms_check check (duration_ms >= 0)
);

create index if not exists mcp_token_events_user_created_at_idx
  on public.mcp_token_events(user_id, created_at desc);

create index if not exists mcp_token_events_token_created_at_idx
  on public.mcp_token_events(token_id, created_at desc);

alter table public.mcp_token_events enable row level security;

drop policy if exists "Users can read own MCP token events"
on public.mcp_token_events;

create policy "Users can read own MCP token events"
on public.mcp_token_events
for select
using (user_id = auth.uid());

create or replace function public.get_mcp_token_event_counts(
  p_user_id uuid,
  p_token_ids uuid[]
)
returns table (
  token_id uuid,
  status text,
  count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    event.token_id,
    event.status,
    count(*) as count
  from public.mcp_token_events as event
  where
    event.user_id = p_user_id
    and (auth.uid() = p_user_id or auth.role() = 'service_role')
    and event.token_id = any(p_token_ids)
  group by event.token_id, event.status;
$$;

comment on table public.mcp_token_events is 'MCP token 调用审计事件，用于排查 agent 调用状态。';
comment on column public.mcp_token_events.user_id is '调用所属用户，决定事件可见边界。';
comment on column public.mcp_token_events.token_id is '关联的 MCP token ID。';
comment on column public.mcp_token_events.token_prefix is '调用发生时的 token 展示前缀，便于 token 被删除后排查。';
comment on column public.mcp_token_events.tool_name is '被调用的 MCP tool 名称。';
comment on column public.mcp_token_events.status is '调用结果：success 或 failure。';
comment on column public.mcp_token_events.error_code is '调用失败时的结构化错误码。';
comment on column public.mcp_token_events.error_message is '调用失败时的可读错误说明。';
comment on column public.mcp_token_events.duration_ms is '调用耗时，单位毫秒。';
comment on column public.mcp_token_events.created_at is '调用事件创建时间。';
comment on function public.get_mcp_token_event_counts(uuid, uuid[]) is '按 token 和状态统计 MCP 调用次数，用于设置页展示。';

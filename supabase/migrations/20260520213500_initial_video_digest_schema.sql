create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_plan_check check (plan in ('free', 'pro', 'admin'))
);

create table public.video_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  normalized_url text not null,
  platform text not null,
  title text,
  author text,
  duration_seconds integer,
  thumbnail_url text,
  status text not null default 'queued',
  transcript_source text,
  output_mode text not null default 'summary',
  fallback_to_audio boolean not null default false,
  send_email boolean not null default false,
  created_by_type text not null default 'web',
  created_by_id uuid,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  constraint video_records_platform_check check (platform in ('youtube', 'bilibili')),
  constraint video_records_duration_seconds_check check (duration_seconds is null or duration_seconds >= 0),
  constraint video_records_status_check check (
    status in (
      'queued',
      'fetching_metadata',
      'extracting_transcript',
      'extracting_audio',
      'transcribing_audio',
      'summarizing',
      'delivering',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  constraint video_records_transcript_source_check check (
    transcript_source is null
    or transcript_source in ('manual_subtitle', 'auto_subtitle', 'asr')
  ),
  constraint video_records_output_mode_check check (
    output_mode in ('transcript', 'summary', 'summary_and_email')
  ),
  constraint video_records_created_by_type_check check (
    created_by_type in ('web', 'mcp_agent', 'system', 'scheduled')
  )
);

create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.video_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  language text,
  source text not null,
  plain_text text,
  storage_key text,
  segment_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint transcripts_source_check check (source in ('manual_subtitle', 'auto_subtitle', 'asr')),
  constraint transcripts_segment_count_check check (segment_count >= 0)
);

create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  transcript_id uuid not null references public.transcripts(id) on delete cascade,
  record_id uuid not null references public.video_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  start_seconds numeric,
  end_seconds numeric,
  text text not null,
  sort_order integer not null,
  constraint transcript_segments_start_seconds_check check (start_seconds is null or start_seconds >= 0),
  constraint transcript_segments_end_seconds_check check (end_seconds is null or end_seconds >= 0),
  constraint transcript_segments_time_range_check check (
    start_seconds is null
    or end_seconds is null
    or end_seconds >= start_seconds
  ),
  constraint transcript_segments_sort_order_check check (sort_order >= 0)
);

create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.video_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null default 'zh-CN',
  format text not null default 'brief',
  title text,
  short_summary text,
  key_points jsonb not null default '[]'::jsonb,
  timeline jsonb not null default '[]'::jsonb,
  takeaways jsonb not null default '[]'::jsonb,
  markdown text,
  model text,
  prompt_version text,
  created_at timestamptz not null default now(),
  constraint summaries_format_check check (format in ('brief', 'detailed', 'email_digest')),
  constraint summaries_key_points_array_check check (jsonb_typeof(key_points) = 'array'),
  constraint summaries_timeline_array_check check (jsonb_typeof(timeline) = 'array'),
  constraint summaries_takeaways_array_check check (jsonb_typeof(takeaways) = 'array')
);

create table public.email_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'pending',
  is_default boolean not null default false,
  verification_token_hash text,
  verification_sent_at timestamptz,
  verified_at timestamptz,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint email_addresses_status_check check (status in ('pending', 'verified', 'revoked'))
);

create table public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.video_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_id uuid references public.summaries(id) on delete set null,
  type text not null default 'email',
  target_id uuid not null,
  status text not null default 'queued',
  subject text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint delivery_records_type_check check (type in ('email', 'webhook')),
  constraint delivery_records_status_check check (status in ('queued', 'sent', 'failed', 'cancelled'))
);

create table public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.video_records(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint job_events_status_check check (
    status in (
      'queued',
      'fetching_metadata',
      'extracting_transcript',
      'extracting_audio',
      'transcribing_audio',
      'summarizing',
      'delivering',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  constraint job_events_metadata_object_check check (jsonb_typeof(metadata) = 'object')
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  record_id uuid references public.video_records(id) on delete set null,
  event_type text not null,
  quantity numeric not null default 1,
  unit text not null default 'count',
  created_at timestamptz not null default now(),
  constraint usage_events_event_type_check check (
    event_type in (
      'job_created',
      'transcript_extracted',
      'audio_transcribed',
      'email_sent',
      'job_failed'
    )
  ),
  constraint usage_events_quantity_check check (quantity >= 0),
  constraint usage_events_unit_check check (unit in ('count', 'minute'))
);

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_updated_at();

create trigger set_video_records_updated_at
before update on public.video_records
for each row
execute function public.set_updated_at();

create index video_records_user_created_at_idx
  on public.video_records(user_id, created_at desc);

create index video_records_user_status_idx
  on public.video_records(user_id, status);

create index video_records_user_platform_idx
  on public.video_records(user_id, platform);

create index video_records_user_normalized_url_idx
  on public.video_records(user_id, normalized_url);

create index transcripts_record_id_idx
  on public.transcripts(record_id);

create index transcripts_user_record_id_idx
  on public.transcripts(user_id, record_id);

create index transcript_segments_transcript_sort_idx
  on public.transcript_segments(transcript_id, sort_order);

create index transcript_segments_record_sort_idx
  on public.transcript_segments(record_id, sort_order);

create index summaries_record_created_at_idx
  on public.summaries(record_id, created_at desc);

create index summaries_user_record_id_idx
  on public.summaries(user_id, record_id);

create unique index email_addresses_user_email_unique
  on public.email_addresses(user_id, lower(email));

create unique index email_addresses_one_default_per_user
  on public.email_addresses(user_id)
  where is_default = true and status = 'verified';

create index email_addresses_user_status_idx
  on public.email_addresses(user_id, status);

create index delivery_records_record_created_at_idx
  on public.delivery_records(record_id, created_at desc);

create index delivery_records_user_status_idx
  on public.delivery_records(user_id, status);

create unique index mcp_tokens_token_hash_unique
  on public.mcp_tokens(token_hash);

create index mcp_tokens_user_revoked_at_idx
  on public.mcp_tokens(user_id, revoked_at);

create index job_events_record_created_at_idx
  on public.job_events(record_id, created_at);

create index usage_events_user_created_at_idx
  on public.usage_events(user_id, created_at);

alter table public.user_profiles enable row level security;
alter table public.video_records enable row level security;
alter table public.transcripts enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.summaries enable row level security;
alter table public.email_addresses enable row level security;
alter table public.delivery_records enable row level security;
alter table public.mcp_tokens enable row level security;
alter table public.job_events enable row level security;
alter table public.usage_events enable row level security;

create policy "Users can read own profile"
on public.user_profiles
for select
using (id = auth.uid());

create policy "Users can insert own profile"
on public.user_profiles
for insert
with check (id = auth.uid() and plan = 'free');

create policy "Users can read own video records"
on public.video_records
for select
using (user_id = auth.uid());

create policy "Users can insert own video records"
on public.video_records
for insert
with check (
  user_id = auth.uid()
  and status = 'queued'
  and transcript_source is null
  and created_by_type = 'web'
  and error_code is null
  and error_message is null
  and completed_at is null
  and deleted_at is null
);

create policy "Users can read own transcripts"
on public.transcripts
for select
using (user_id = auth.uid());

create policy "Users can read own transcript segments"
on public.transcript_segments
for select
using (user_id = auth.uid());

create policy "Users can read own summaries"
on public.summaries
for select
using (user_id = auth.uid());

create policy "Users can read own email addresses"
on public.email_addresses
for select
using (user_id = auth.uid());

create policy "Users can insert own email addresses"
on public.email_addresses
for insert
with check (
  user_id = auth.uid()
  and status = 'pending'
  and is_default = false
  and verified_at is null
  and last_sent_at is null
);

create policy "Users can delete own email addresses"
on public.email_addresses
for delete
using (user_id = auth.uid());

create policy "Users can read own delivery records"
on public.delivery_records
for select
using (user_id = auth.uid());

create policy "Users can read own job events"
on public.job_events
for select
using (user_id = auth.uid());

create policy "Users can read own usage events"
on public.usage_events
for select
using (user_id = auth.uid());

comment on function public.set_updated_at() is '更新 updated_at 字段的通用触发器函数。';

comment on table public.user_profiles is '用户资料和套餐信息，补充 Supabase Auth 用户数据。';
comment on column public.user_profiles.id is '用户资料主键，与 auth.users.id 保持一致。';
comment on column public.user_profiles.email is '展示用邮箱，真实登录仍以 Supabase Auth 为准。';
comment on column public.user_profiles.plan is '套餐标识，例如 free、pro、admin。';
comment on column public.user_profiles.created_at is '资料记录创建时间。';
comment on column public.user_profiles.updated_at is '资料记录最后更新时间。';

comment on table public.video_records is '视频处理记录主表，承载任务状态、视频元数据和错误信息。';
comment on column public.video_records.id is '视频处理记录主键，也是页面详情页和 job payload 使用的 recordId。';
comment on column public.video_records.user_id is '记录所属用户，关联 auth.users.id，用于 RLS 和资源归属校验。';
comment on column public.video_records.source_url is '用户或 agent 原始提交的视频链接。';
comment on column public.video_records.normalized_url is '归一化后的视频链接，用于重复任务检测和搜索。';
comment on column public.video_records.platform is '视频平台，当前支持 youtube 和 bilibili。';
comment on column public.video_records.title is '视频标题，由 worker 获取元数据后写入。';
comment on column public.video_records.author is '视频作者、频道或 UP 主名称。';
comment on column public.video_records.duration_seconds is '视频时长，单位秒。';
comment on column public.video_records.thumbnail_url is '视频封面图地址。';
comment on column public.video_records.status is '当前处理状态，用于列表、详情页和 agent 查询进度。';
comment on column public.video_records.transcript_source is '最终采用的字幕来源，可能是人工字幕、自动字幕或 ASR。';
comment on column public.video_records.output_mode is '用户期望输出类型：只要字幕、生成摘要或摘要并邮件投递。';
comment on column public.video_records.fallback_to_audio is '没有可用字幕时是否允许提取音频并转写。';
comment on column public.video_records.send_email is '创建任务时是否请求自动发送到默认已验证邮箱。';
comment on column public.video_records.created_by_type is '创建来源，用于区分网站、MCP agent、系统或定时任务。';
comment on column public.video_records.created_by_id is '创建者标识。网站用户可存 userId，MCP agent 可存 tokenId，系统任务可为空或存系统 actorId。';
comment on column public.video_records.error_code is '结构化失败码，用于失败恢复和前端操作建议。';
comment on column public.video_records.error_message is '面向用户或运维排查的失败说明。';
comment on column public.video_records.created_at is '任务记录创建时间。';
comment on column public.video_records.updated_at is '任务记录最后更新时间。';
comment on column public.video_records.completed_at is '任务完成、失败或取消的时间。';
comment on column public.video_records.deleted_at is '软删除时间；为空表示记录仍可见。';

comment on table public.transcripts is '一条视频记录的字幕或音频转写结果。';
comment on column public.transcripts.id is '字幕结果主键。';
comment on column public.transcripts.record_id is '所属视频记录，关联 video_records.id。';
comment on column public.transcripts.user_id is '字幕所属用户，冗余保存便于 RLS 和查询过滤。';
comment on column public.transcripts.language is '字幕语言，例如 zh-CN、en，未知时可为空。';
comment on column public.transcripts.source is '字幕来源：人工字幕、自动字幕或 ASR。';
comment on column public.transcripts.plain_text is '字幕全文，MVP 阶段可直接存储在数据库中。';
comment on column public.transcripts.storage_key is '对象存储 key，用于后续大文本或文件化字幕存储。';
comment on column public.transcripts.segment_count is '字幕分段数量，对应 transcript_segments 行数。';
comment on column public.transcripts.created_at is '字幕结果创建时间。';

comment on table public.transcript_segments is '字幕分段表，用于详情页分段查看和后续按时间线引用来源。';
comment on column public.transcript_segments.id is '字幕分段主键。';
comment on column public.transcript_segments.transcript_id is '所属字幕结果，关联 transcripts.id。';
comment on column public.transcript_segments.record_id is '所属视频记录，冗余保存便于详情页查询和权限过滤。';
comment on column public.transcript_segments.user_id is '分段所属用户，冗余保存便于 RLS 和查询过滤。';
comment on column public.transcript_segments.start_seconds is '分段开始时间，单位秒，可包含小数。';
comment on column public.transcript_segments.end_seconds is '分段结束时间，单位秒，可包含小数。';
comment on column public.transcript_segments.text is '当前时间段内的字幕文本。';
comment on column public.transcript_segments.sort_order is '分段排序序号，保证展示顺序稳定。';

comment on table public.summaries is '摘要结果表，允许同一条记录未来有多个摘要版本或格式。';
comment on column public.summaries.id is '摘要结果主键。';
comment on column public.summaries.record_id is '所属视频记录，关联 video_records.id。';
comment on column public.summaries.user_id is '摘要所属用户，冗余保存便于 RLS 和查询过滤。';
comment on column public.summaries.language is '摘要语言，默认 zh-CN。';
comment on column public.summaries.format is '摘要格式，例如简版、详细版或邮件摘要版。';
comment on column public.summaries.title is '摘要标题，可由模型生成或沿用视频标题。';
comment on column public.summaries.short_summary is '摘要的短概览，供列表和详情页首屏展示。';
comment on column public.summaries.key_points is '关键要点数组，使用 JSONB 存储结构化结果。';
comment on column public.summaries.timeline is '时间线摘要数组，通常包含时间点、主题和说明。';
comment on column public.summaries.takeaways is '结论、行动建议或可复用要点数组。';
comment on column public.summaries.markdown is '完整 Markdown 摘要内容，用于复制、邮件和导出。';
comment on column public.summaries.model is '生成摘要使用的模型名称。';
comment on column public.summaries.prompt_version is '摘要 prompt 版本，便于后续重生成和效果追踪。';
comment on column public.summaries.created_at is '摘要创建时间。';

comment on table public.email_addresses is '用户已验证收件邮箱。邮件 tool 只能投递到 verified 地址。';
comment on column public.email_addresses.id is '邮箱记录主键，也是邮件投递 tool 使用的 toEmailId。';
comment on column public.email_addresses.user_id is '邮箱所属用户，关联 auth.users.id。';
comment on column public.email_addresses.email is '收件邮箱地址。';
comment on column public.email_addresses.status is '邮箱验证状态：待验证、已验证或已撤销。';
comment on column public.email_addresses.is_default is '是否为用户默认收件邮箱。';
comment on column public.email_addresses.verification_token_hash is '邮箱验证 token 的 hash，不保存明文 token。';
comment on column public.email_addresses.verification_sent_at is '最近一次验证邮件发送时间。';
comment on column public.email_addresses.verified_at is '邮箱完成验证的时间。';
comment on column public.email_addresses.last_sent_at is '最近一次成功投递摘要邮件的时间。';
comment on column public.email_addresses.created_at is '邮箱记录创建时间。';

comment on table public.delivery_records is '投递记录表，记录每次邮件或 webhook 的发送状态。';
comment on column public.delivery_records.id is '投递记录主键。';
comment on column public.delivery_records.record_id is '所属视频记录，关联 video_records.id。';
comment on column public.delivery_records.user_id is '投递所属用户，冗余保存便于 RLS 和查询过滤。';
comment on column public.delivery_records.summary_id is '本次投递使用的摘要版本，摘要被删除时置空。';
comment on column public.delivery_records.type is '投递类型，当前主要为 email，后续可扩展 webhook。';
comment on column public.delivery_records.target_id is '投递目标 ID。邮件投递时指向 email_addresses.id。';
comment on column public.delivery_records.status is '投递状态：排队、已发送、失败或取消。';
comment on column public.delivery_records.subject is '邮件主题或 webhook 事件标题。';
comment on column public.delivery_records.error_message is '投递失败原因。';
comment on column public.delivery_records.created_at is '投递记录创建时间。';
comment on column public.delivery_records.sent_at is '成功发送时间。';

comment on table public.mcp_tokens is '外部 agent 使用的 MCP token，只保存 hash，不保存明文 token。';
comment on column public.mcp_tokens.id is 'MCP token 记录主键，可作为 agent actor id 使用。';
comment on column public.mcp_tokens.user_id is 'token 所属用户，决定 agent 能访问的数据边界。';
comment on column public.mcp_tokens.name is 'token 名称，用于设置页展示，例如 Cursor 智能体。';
comment on column public.mcp_tokens.token_prefix is 'token 展示前缀，只用于用户识别，不可用于鉴权。';
comment on column public.mcp_tokens.token_hash is 'token hash，用于服务端鉴权，不保存明文 token。';
comment on column public.mcp_tokens.scopes is 'token 权限范围数组，决定 agent 可调用的 tool。';
comment on column public.mcp_tokens.expires_at is 'token 过期时间，为空表示长期有效。';
comment on column public.mcp_tokens.last_used_at is 'token 最近一次成功使用时间。';
comment on column public.mcp_tokens.revoked_at is 'token 撤销时间；为空表示未撤销。';
comment on column public.mcp_tokens.created_at is 'token 创建时间。';

comment on table public.job_events is '任务状态流水，供详情页处理时间线、失败诊断和 worker 调试读取。';
comment on column public.job_events.id is '任务事件主键。';
comment on column public.job_events.record_id is '所属视频记录，关联 video_records.id。';
comment on column public.job_events.user_id is '事件所属用户，冗余保存便于 RLS 和查询过滤。';
comment on column public.job_events.status is '事件对应的任务状态或阶段。';
comment on column public.job_events.message is '状态说明、失败提示或 worker 日志摘要。';
comment on column public.job_events.metadata is '结构化事件元数据，例如 provider、耗时、重试次数。';
comment on column public.job_events.created_at is '事件发生时间。';

comment on table public.usage_events is '用量事件流水，用于 settings usage 的月度统计。';
comment on column public.usage_events.id is '用量事件主键。';
comment on column public.usage_events.user_id is '用量所属用户，关联 auth.users.id。';
comment on column public.usage_events.record_id is '关联的视频记录；非任务型用量可为空。';
comment on column public.usage_events.event_type is '用量事件类型，例如创建任务、字幕提取、邮件发送。';
comment on column public.usage_events.quantity is '本次事件计量值，例如 1 次或转写分钟数。';
comment on column public.usage_events.unit is '计量单位，例如 count 或 minute。';
comment on column public.usage_events.created_at is '用量事件发生时间。';

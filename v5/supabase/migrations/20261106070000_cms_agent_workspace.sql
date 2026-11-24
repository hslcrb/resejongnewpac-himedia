-- [CMS · WYSIWYG · 대화형 코딩 · PR 전용 발행 스키마 / CMS, WYSIWYG, conversational coding, and PR-only release schema]
begin;

create table if not exists public.sejong_cms_memberships (
    user_id uuid primary key references auth.users(id) on delete cascade,
    provider text not null default 'google' check (provider = 'google'),
    google_subject text not null check (char_length(trim(google_subject)) between 1 and 255),
    account_handle text not null check (account_handle = 'admin'),
    verified_email text not null check (verified_email ~* '^admin@(gmail|googlemail)\.com$'),
    role text not null default 'super_admin' check (role in ('super_admin', 'editor', 'reviewer', 'operator')),
    capabilities text[] not null default array['cms:read', 'cms:write_draft', 'cms:run_agent', 'cms:create_pr', 'cms:reconcile_release'],
    active boolean not null default true,
    revoked_at timestamptz,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    unique (provider, google_subject)
);

create table if not exists public.sejong_cms_drafts (
    id uuid primary key default gen_random_uuid(),
    target_type text not null check (target_type in ('page', 'program', 'notice', 'venue', 'company', 'home_feature', 'navigation')),
    target_id text not null check (char_length(trim(target_id)) between 1 and 240),
    title text not null check (char_length(trim(title)) between 1 and 300),
    description text not null default '' check (char_length(description) <= 2000),
    ast_schema_version integer not null default 1 check (ast_schema_version = 1),
    document_ast jsonb not null check (jsonb_typeof(document_ast) = 'object'),
    blocks_snapshot jsonb not null check (jsonb_typeof(blocks_snapshot) = 'array'),
    base_revision integer not null default 1 check (base_revision >= 1),
    draft_revision integer not null default 1 check (draft_revision >= 1),
    content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
    status text not null default 'draft' check (status in ('draft', 'staged_for_pr', 'pr_open', 'merged_published', 'conflict', 'archived')),
    author_id uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    unique (target_type, target_id, draft_revision)
);
create index if not exists sejong_cms_drafts_target_updated_idx on public.sejong_cms_drafts (target_type, target_id, updated_at desc);

create table if not exists public.sejong_cms_media_assets (
    id uuid primary key default gen_random_uuid(),
    file_name text not null check (char_length(trim(file_name)) between 1 and 255),
    mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf')),
    byte_size integer not null check (byte_size between 1 and 26214400),
    sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
    alt_text text not null check (char_length(trim(alt_text)) between 1 and 500),
    source_url text not null default '',
    storage_bucket text not null default 'sejong-cms-staging',
    storage_path text not null check (char_length(trim(storage_path)) between 1 and 500),
    status text not null default 'staged' check (status in ('staged', 'approved', 'published', 'rejected')),
    created_by uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default clock_timestamp()
);

create table if not exists public.sejong_cms_change_sets (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(trim(title)) between 1 and 300),
    summary text not null default '' check (char_length(summary) <= 4000),
    base_main_sha text not null check (base_main_sha ~ '^[0-9a-f]{7,40}$'),
    branch_name text not null check (branch_name ~ '^(cms|feat|fix|docs|refactor)/[a-z0-9._-]+$'),
    payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
    immutable_payload jsonb not null check (jsonb_typeof(immutable_payload) = 'object'),
    code_patches jsonb not null default '[]'::jsonb check (jsonb_typeof(code_patches) = 'array'),
    pr_number integer check (pr_number is null or pr_number > 0),
    pr_url text not null default '',
    pr_state text not null default 'draft_bundle' check (pr_state in ('draft_bundle', 'pr_open', 'pr_merged', 'pr_closed', 'published')),
    merged_main_sha text check (merged_main_sha is null or merged_main_sha ~ '^[0-9a-f]{7,40}$'),
    cloudflare_deployment_id text not null default '',
    cloudflare_status text not null default 'pending' check (cloudflare_status in ('pending', 'building', 'deployed', 'failed')),
    author_id uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp()
);
create index if not exists sejong_cms_change_sets_state_updated_idx on public.sejong_cms_change_sets (pr_state, updated_at desc);

create table if not exists public.sejong_cms_agent_threads (
    id uuid primary key default gen_random_uuid(),
    title text not null check (char_length(trim(title)) between 1 and 240),
    target_path text not null default '/visit',
    base_main_sha text not null check (base_main_sha ~ '^[0-9a-f]{7,40}$'),
    branch_name text not null check (branch_name ~ '^(cms|feat|fix|docs|refactor)/[a-z0-9._-]+$'),
    messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
    status text not null default 'idle' check (status in ('idle', 'planning', 'awaiting_approval', 'running', 'completed', 'cancelled', 'failed')),
    author_id uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.sejong_cms_agent_runs (
    id uuid primary key default gen_random_uuid(),
    thread_id uuid not null references public.sejong_cms_agent_threads(id) on delete cascade,
    request_id uuid not null unique,
    prompt text not null check (char_length(trim(prompt)) between 1 and 8000),
    plan_steps jsonb not null default '[]'::jsonb check (jsonb_typeof(plan_steps) = 'array'),
    tool_calls jsonb not null default '[]'::jsonb check (jsonb_typeof(tool_calls) = 'array'),
    proposed_patches jsonb not null default '[]'::jsonb check (jsonb_typeof(proposed_patches) = 'array'),
    check_results jsonb not null default '{}'::jsonb check (jsonb_typeof(check_results) = 'object'),
    token_budget integer not null default 16000 check (token_budget between 512 and 128000),
    tokens_used integer not null default 0 check (tokens_used >= 0),
    log_cursor integer not null default 0 check (log_cursor >= 0),
    status text not null default 'completed' check (status in ('planning', 'running', 'completed', 'cancelled', 'failed', 'blocked_policy')),
    change_set_id uuid references public.sejong_cms_change_sets(id) on delete set null,
    author_id uuid not null references auth.users(id) on delete restrict,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.sejong_cms_audit_outbox (
    id bigint generated always as identity primary key,
    actor_id uuid references auth.users(id) on delete set null,
    action text not null check (char_length(trim(action)) between 1 and 120),
    entity_type text not null check (char_length(trim(entity_type)) between 1 and 80),
    entity_id text not null check (char_length(trim(entity_id)) between 1 and 240),
    request_id uuid not null default gen_random_uuid(),
    before_revision integer,
    after_revision integer,
    pr_number integer,
    deployment_id text not null default '',
    payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
    delivery_state text not null default 'recorded' check (delivery_state in ('recorded', 'dispatched', 'confirmed', 'failed')),
    created_at timestamptz not null default clock_timestamp()
);

alter table public.sejong_cms_memberships enable row level security;
alter table public.sejong_cms_drafts enable row level security;
alter table public.sejong_cms_media_assets enable row level security;
alter table public.sejong_cms_change_sets enable row level security;
alter table public.sejong_cms_agent_threads enable row level security;
alter table public.sejong_cms_agent_runs enable row level security;
alter table public.sejong_cms_audit_outbox enable row level security;

revoke all on public.sejong_cms_memberships, public.sejong_cms_drafts, public.sejong_cms_media_assets,
    public.sejong_cms_change_sets, public.sejong_cms_agent_threads, public.sejong_cms_agent_runs,
    public.sejong_cms_audit_outbox from public, anon, authenticated;

-- [검증된 Google 관리자 관리자 세션 판정 / Verified Google 관리자 admin session check]
create or replace function public.sejong_cms_is_active_admin(p_user_id uuid default auth.uid())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
    v_has_membership boolean := false;
begin
    if p_user_id is null then
        return false;
    end if;
    select exists (
        select 1
        from public.sejong_cms_memberships m
        join auth.identities i
            on i.user_id = m.user_id
           and i.provider = 'google'
           and i.provider_id = m.google_subject
        where m.user_id = p_user_id
          and m.active = true
          and m.revoked_at is null
          and m.account_handle = 'admin'
          and coalesce((i.identity_data ->> 'email_verified')::boolean, false) = true
          and lower(coalesce(i.identity_data ->> 'email', '')) = lower(m.verified_email)
    ) into v_has_membership;
    return v_has_membership;
end $$;

revoke all on function public.sejong_cms_is_active_admin(uuid) from public, anon;
grant execute on function public.sejong_cms_is_active_admin(uuid) to authenticated;

grant select on public.sejong_cms_memberships to authenticated;
grant select, insert, update on public.sejong_cms_drafts, public.sejong_cms_media_assets,
    public.sejong_cms_change_sets, public.sejong_cms_agent_threads, public.sejong_cms_agent_runs to authenticated;
grant select on public.sejong_cms_audit_outbox to authenticated;

create policy cms_memberships_self_select on public.sejong_cms_memberships
    for select to authenticated using ((select auth.uid()) = user_id and active = true and revoked_at is null);

create policy cms_drafts_admin_all on public.sejong_cms_drafts
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())) and author_id = (select auth.uid()));

create policy cms_media_admin_all on public.sejong_cms_media_assets
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())) and created_by = (select auth.uid()));

create policy cms_change_sets_admin_all on public.sejong_cms_change_sets
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())) and author_id = (select auth.uid()));

create policy cms_agent_threads_admin_all on public.sejong_cms_agent_threads
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())) and author_id = (select auth.uid()));

create policy cms_agent_runs_admin_all on public.sejong_cms_agent_runs
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())) and author_id = (select auth.uid()));

create policy cms_audit_outbox_admin_select on public.sejong_cms_audit_outbox
    for select to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())));

commit;

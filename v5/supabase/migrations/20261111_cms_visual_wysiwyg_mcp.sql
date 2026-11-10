-- [피그마형 WYSIWYG CMS · 시각 초안 · 발행 리비전 · 페이지 트리 · 콘텐츠 스키마]
-- Figma-like WYSIWYG CMS: visual drafts, published revisions, captured page trees, content entries.
-- 선행 마이그레이션: 20261106070000_cms_agent_workspace.sql (sejong_cms_memberships, sejong_cms_is_active_admin)
begin;

-- 1) 페이지별 비주얼 초안(현재 작업본). target_path는 공개 콘텐츠 경로만 허용합니다.
create table if not exists public.sejong_cms_visual_documents (
    target_path text primary key check (target_path ~ '^/[a-z0-9/_-]*$' and char_length(target_path) <= 220),
    document jsonb not null default '{"schemaVersion": 2, "patches": [], "additions": []}'::jsonb
        check (jsonb_typeof(document) = 'object'),
    revision integer not null default 0 check (revision between 0 and 1000000),
    status text not null default 'draft' check (status in ('draft', 'published')),
    checksum text not null default '' check (checksum = '' or checksum ~ '^[0-9a-f]{64}$'),
    published_revision integer not null default 0 check (published_revision >= 0),
    published_at timestamptz,
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    updated_by text not null default '' check (char_length(updated_by) <= 200)
);

-- 2) 발행 이력(불변 스냅샷). 발행 리비전은 페이지별로 증가합니다.
create table if not exists public.sejong_cms_visual_revisions (
    id bigserial primary key,
    target_path text not null check (target_path ~ '^/[a-z0-9/_-]*$'),
    revision integer not null check (revision >= 1),
    published_revision integer not null check (published_revision >= 1),
    document jsonb not null check (jsonb_typeof(document) = 'object'),
    checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
    published_at timestamptz not null default clock_timestamp(),
    published_by text not null default '' check (char_length(published_by) <= 200),
    note text not null default '' check (char_length(note) <= 500),
    unique (target_path, published_revision)
);
create index if not exists sejong_cms_visual_revisions_path_idx
    on public.sejong_cms_visual_revisions (target_path, published_at desc);

-- 3) 캔버스가 캡처한 페이지 DOM 트리(에이전트가 브라우저 없이 구조를 읽는 기준).
create table if not exists public.sejong_cms_page_snapshots (
    target_path text primary key check (target_path ~ '^/[a-z0-9/_-]*$'),
    tree jsonb not null check (jsonb_typeof(tree) = 'array'),
    checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
    viewport text not null default 'desktop' check (viewport in ('desktop', 'tablet', 'mobile')),
    url text not null default '' check (char_length(url) <= 500),
    captured_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    updated_by text not null default '' check (char_length(updated_by) <= 200)
);

-- 4) 구조화 콘텐츠(공지·프로그램·페이지·FAQ·배너·미디어).
create table if not exists public.sejong_cms_content_entries (
    id uuid primary key default gen_random_uuid(),
    collection text not null check (collection in ('notices', 'programs', 'pages', 'faq', 'banners', 'media')),
    slug text not null check (slug ~ '^[a-z0-9][a-z0-9._-]{0,80}$'),
    data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
    status text not null default 'draft' check (status in ('draft', 'published')),
    created_at timestamptz not null default clock_timestamp(),
    updated_at timestamptz not null default clock_timestamp(),
    updated_by text not null default '' check (char_length(updated_by) <= 200),
    unique (collection, slug)
);
create index if not exists sejong_cms_content_entries_collection_idx
    on public.sejong_cms_content_entries (collection, status, updated_at desc);

-- 5) 발행 RPC: 낙관적 리비전 잠금 + 발행 이력 기록을 한 트랜잭션으로 수행합니다.
create or replace function public.sejong_cms_publish_visual_draft(
    p_path text,
    p_expected_revision integer,
    p_note text default '',
    p_actor uuid default auth.uid()
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    current_row public.sejong_cms_visual_documents;
    capabilities text[];
    next_published integer;
    published_at_value timestamptz := clock_timestamp();
    result jsonb;
begin
    if p_path is null or p_path !~ '^/[a-z0-9/_-]*$' then
        raise exception 'invalid target path' using errcode = '22023';
    end if;

    select m.capabilities into capabilities
      from public.sejong_cms_memberships m
     where m.user_id = auth.uid() and m.active = true and m.revoked_at is null;
    if not public.sejong_cms_is_active_admin(auth.uid()) then
        raise exception 'not an active cms admin' using errcode = '42501';
    end if;
    if capabilities is null or not ('cms:reconcile_release' = any (capabilities)) then
        raise exception 'missing capability cms:reconcile_release' using errcode = '42501';
    end if;

    select * into current_row
      from public.sejong_cms_visual_documents
     where target_path = p_path
       for update;
    if not found then
        raise exception 'draft not found' using errcode = 'P0002';
    end if;
    if current_row.revision <> p_expected_revision then
        raise exception 'revision conflict: server %, requested %', current_row.revision, p_expected_revision
            using errcode = '40001';
    end if;

    next_published := current_row.published_revision + 1;

    update public.sejong_cms_visual_documents
       set status = 'published',
           published_revision = next_published,
           published_at = published_at_value,
           updated_at = published_at_value,
           updated_by = coalesce(p_actor::text, '')
     where target_path = p_path;

    insert into public.sejong_cms_visual_revisions (
        target_path, revision, published_revision, document, checksum,
        published_at, published_by, note
    ) values (
        p_path, current_row.revision, next_published, current_row.document, current_row.checksum,
        published_at_value, coalesce(p_actor::text, ''), left(coalesce(p_note, ''), 500)
    );

    select jsonb_build_object(
        'target_path', p_path,
        'revision', current_row.revision,
        'published_revision', next_published,
        'document', current_row.document,
        'checksum', current_row.checksum,
        'published_at', published_at_value,
        'published_by', coalesce(p_actor::text, ''),
        'note', left(coalesce(p_note, ''), 500)
    ) into result;

    return result;
end;
$$;

revoke all on function public.sejong_cms_publish_visual_draft(text, integer, text, uuid) from public, anon;
grant execute on function public.sejong_cms_publish_visual_draft(text, integer, text, uuid) to authenticated;

-- 6) RLS: 활성 CMS 관리자만 접근합니다. 공개 사용자(anon)에게는 어떤 초안도 노출하지 않습니다.
alter table public.sejong_cms_visual_documents enable row level security;
alter table public.sejong_cms_visual_revisions enable row level security;
alter table public.sejong_cms_page_snapshots enable row level security;
alter table public.sejong_cms_content_entries enable row level security;

grant select, insert, update on public.sejong_cms_visual_documents,
    public.sejong_cms_page_snapshots, public.sejong_cms_content_entries to authenticated;
grant select, insert on public.sejong_cms_visual_revisions to authenticated;
grant usage, select on sequence public.sejong_cms_visual_revisions_id_seq to authenticated;

drop policy if exists cms_visual_documents_admin_all on public.sejong_cms_visual_documents;
create policy cms_visual_documents_admin_all on public.sejong_cms_visual_documents
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())));

drop policy if exists cms_visual_revisions_admin_select on public.sejong_cms_visual_revisions;
create policy cms_visual_revisions_admin_select on public.sejong_cms_visual_revisions
    for select to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())));

drop policy if exists cms_page_snapshots_admin_all on public.sejong_cms_page_snapshots;
create policy cms_page_snapshots_admin_all on public.sejong_cms_page_snapshots
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())));

drop policy if exists cms_content_entries_admin_all on public.sejong_cms_content_entries;
create policy cms_content_entries_admin_all on public.sejong_cms_content_entries
    for all to authenticated
    using (public.sejong_cms_is_active_admin((select auth.uid())))
    with check (public.sejong_cms_is_active_admin((select auth.uid())));

commit;

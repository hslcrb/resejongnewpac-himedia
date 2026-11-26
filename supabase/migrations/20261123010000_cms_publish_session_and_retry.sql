-- Keep the existing RPC signature for old clients while binding the audit actor
-- to Supabase Auth and admitting safe retries of the same published draft.
begin;

create or replace function public.sejong_cms_publish_visual_draft(
    p_path text,
    p_expected_revision integer,
    p_note text default '',
    p_actor uuid default auth.uid()
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor uuid := auth.uid();
    current_row public.sejong_cms_visual_documents;
    published_row public.sejong_cms_visual_revisions;
begin
    if p_path is null or p_path !~ '^/[a-z0-9/_-]*$' or char_length(p_path) > 220
        or p_expected_revision is null or p_expected_revision < 1 then
        raise exception 'invalid publication target' using errcode = '22023';
    end if;
    if actor is null or (p_actor is not null and p_actor <> actor)
        or not public.sejong_cms_is_active_admin(actor)
        or not exists (
            select 1 from public.sejong_cms_memberships m
             where m.user_id = actor and m.active and m.revoked_at is null
               and 'cms:reconcile_release' = any (m.capabilities)
        ) then
        raise exception 'CMS publication is not permitted' using errcode = '42501';
    end if;

    select * into current_row
      from public.sejong_cms_visual_documents d
     where d.target_path = p_path
       for update;
    if not found then
        raise exception 'draft not found' using errcode = 'P0002';
    end if;
    if current_row.revision <> p_expected_revision then
        raise exception 'revision conflict: server %, requested %', current_row.revision, p_expected_revision
            using errcode = '40001';
    end if;

    -- Only the exact same published draft may be acknowledged again. The first
    -- note, actor and timestamp are preserved; there is no new history row.
    if current_row.status = 'published' then
        select * into published_row
          from public.sejong_cms_visual_revisions r
         where r.target_path = p_path and r.published_revision = current_row.published_revision
           and r.revision = current_row.revision and r.checksum = current_row.checksum
           and r.document = current_row.document;
        if not found then
            raise exception 'publication history missing or inconsistent' using errcode = '55000';
        end if;
        return to_jsonb(published_row) - 'id';
    end if;

    insert into public.sejong_cms_visual_revisions (
        target_path, revision, published_revision, document, checksum, published_by, note
    ) values (
        p_path, current_row.revision, current_row.published_revision + 1, current_row.document,
        current_row.checksum, actor::text, left(coalesce(p_note, ''), 500)
    ) returning * into published_row;

    update public.sejong_cms_visual_documents
       set status = 'published', published_revision = published_row.published_revision,
           published_at = published_row.published_at, updated_at = published_row.published_at, updated_by = actor::text
     where target_path = p_path;
    return to_jsonb(published_row) - 'id';
end;
$$;

revoke all on function public.sejong_cms_publish_visual_draft(text, integer, text, uuid) from public, anon;
grant execute on function public.sejong_cms_publish_visual_draft(text, integer, text, uuid) to authenticated;
commit;

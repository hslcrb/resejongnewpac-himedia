-- Public projection of immutable publication history; never expose a draft or audit metadata.
begin;
create or replace function public.sejong_cms_read_public_visual(p_path text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_build_object(
        'path', r.target_path,
        'publishedRevision', r.published_revision,
        'checksum', r.checksum,
        'document', jsonb_build_object(
            'schemaVersion', r.document -> 'schemaVersion',
            'path', r.target_path,
            'patches', r.document -> 'patches',
            'additions', r.document -> 'additions'
        )
    )
    from public.sejong_cms_visual_revisions r
    where r.target_path = p_path
      and char_length(p_path) <= 220
      and p_path ~ '^/(?:[a-z0-9_-]+(?:/[a-z0-9_-]+)*)?$'
      and p_path !~ '^/(admin|account|booking|login|design-rules|api)(/|$)'
    order by r.published_revision desc
    limit 1;
$$;
revoke all on function public.sejong_cms_read_public_visual(text) from public;
grant execute on function public.sejong_cms_read_public_visual(text) to anon, authenticated;
commit;

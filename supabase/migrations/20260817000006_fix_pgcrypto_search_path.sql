-- =============================================================================
-- Zefinoro :: 0006 :: Reach pgcrypto from pinned-search_path functions
--
-- `gen_random_bytes` comes from pgcrypto, and Supabase installs extensions into
-- the `extensions` schema rather than `public`. Functions that pin
-- `search_path = public` (as every SECURITY DEFINER function here must, to stop
-- a caller shadowing our objects) therefore cannot resolve it, and invite code
-- generation failed with:
--
--   42883: function gen_random_bytes(integer) does not exist
--
-- `gen_random_uuid()` kept working throughout because it is core Postgres, not
-- pgcrypto - which is why workspace creation succeeded and only invitations
-- broke. The fix is to include `extensions` on the search path of the functions
-- that need it, while still pinning it.
-- =============================================================================

create extension if not exists "pgcrypto" with schema extensions;

-- ---------------------------------------------------------------------------
-- generate_invite_code :: now able to see pgcrypto
-- ---------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public, extensions
as $fn$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes    bytea;
  code     text := '';
  i        int;
begin
  bytes := gen_random_bytes(8);
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- slugify_workspace_name :: its collision fallback uses gen_random_bytes too
-- ---------------------------------------------------------------------------
create or replace function public.slugify_workspace_name(p_name text)
returns text
language plpgsql
volatile
set search_path = public, extensions
as $fn$
declare
  base      text;
  candidate text;
  suffix    int := 0;
begin
  base := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  base := substr(base, 1, 40);
  if base = '' then
    base := 'workspace';
  end if;

  candidate := base;
  while exists (select 1 from public.workspaces w where w.slug = candidate) loop
    suffix := suffix + 1;
    candidate := base || '-' || suffix::text;
    if suffix > 200 then
      candidate := base || '-' || encode(gen_random_bytes(4), 'hex');
      exit;
    end if;
  end loop;

  return candidate;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- create_invitation :: the pinned search_path propagates to nested calls, so it
-- has to include `extensions` as well.
-- ---------------------------------------------------------------------------
create or replace function public.create_invitation(
  p_workspace_id   uuid,
  p_role           public.workspace_role default 'member',
  p_expires_in_days int default 7,
  p_max_uses       int default 1,
  p_email          text default null
)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_code   text;
  v_invite public.workspace_invitations;
  v_try    int := 0;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if not public.is_workspace_manager(p_workspace_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_role = 'owner' then
    raise exception 'CANNOT_INVITE_AS_OWNER';
  end if;

  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 90 then
    raise exception 'INVALID_EXPIRY';
  end if;

  loop
    v_try := v_try + 1;
    v_code := public.generate_invite_code();
    begin
      insert into public.workspace_invitations
        (workspace_id, invite_code, email, invited_by, role, max_uses, expires_at)
      values (
        p_workspace_id,
        v_code,
        nullif(trim(coalesce(p_email, '')), ''),
        v_uid,
        p_role,
        greatest(1, least(coalesce(p_max_uses, 1), 100)),
        now() + make_interval(days => p_expires_in_days)
      )
      returning * into v_invite;
      exit;
    exception when unique_violation then
      if v_try >= 5 then
        raise exception 'INVITE_CODE_GENERATION_FAILED';
      end if;
    end;
  end loop;

  return v_invite;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- create_workspace calls slugify_workspace_name, so it needs the same path.
-- ---------------------------------------------------------------------------
create or replace function public.create_workspace(
  p_name        text,
  p_description text default null,
  p_avatar_url  text default null,
  p_currency    text default 'INR'
)
returns public.workspaces
language plpgsql
security definer
set search_path = public, extensions
as $fn$
declare
  v_uid uuid := auth.uid();
  v_ws  public.workspaces;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'WORKSPACE_NAME_REQUIRED';
  end if;

  if char_length(trim(p_name)) > 80 then
    raise exception 'WORKSPACE_NAME_TOO_LONG';
  end if;

  insert into public.workspaces (name, slug, description, avatar_url, created_by)
  values (
    trim(p_name),
    public.slugify_workspace_name(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    v_uid
  )
  returning * into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (v_ws.id, v_uid, 'owner', 'active');

  insert into public.workspace_settings (workspace_id, default_currency)
  values (v_ws.id, coalesce(upper(nullif(p_currency, '')), 'INR'))
  on conflict (workspace_id) do nothing;

  perform public.seed_workspace_categories(v_ws.id);

  return v_ws;
end;
$fn$;

grant execute on function public.create_invitation(uuid, public.workspace_role, int, int, text) to authenticated;
grant execute on function public.create_workspace(text, text, text, text)                      to authenticated;
revoke execute on function public.generate_invite_code() from public, anon;

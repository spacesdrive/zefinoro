-- =============================================================================
-- Zefinoro :: 0004 :: RPCs
--
-- Anything that must be atomic, or that must read rows the caller cannot yet
-- see (invitation redemption), lives here as SECURITY DEFINER. Each function
-- re-checks authorization itself - never trust a workspace id from the client.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Cryptographically secure invite codes :: format ABCD-2345
-- Alphabet excludes I, O, 0, 1 to stay unambiguous when read aloud/typed.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
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
-- Slugify a workspace name into a unique slug.
-- ---------------------------------------------------------------------------
create or replace function public.slugify_workspace_name(p_name text)
returns text
language plpgsql
volatile
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
-- Seed the default category set for a workspace.
-- ---------------------------------------------------------------------------
create or replace function public.seed_workspace_categories(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.categories (workspace_id, name, type, color, icon, is_system)
  values
    (p_workspace_id, 'Salary',        'received', '#22c55e', 'wallet',        true),
    (p_workspace_id, 'Freelance',     'received', '#14b8a6', 'laptop',        true),
    (p_workspace_id, 'Business',      'received', '#0ea5e9', 'briefcase',     true),
    (p_workspace_id, 'Investment',    'received', '#8b5cf6', 'trending-up',   true),
    (p_workspace_id, 'Gift',          'received', '#ec4899', 'gift',          true),
    (p_workspace_id, 'Other',         'received', '#64748b', 'circle-dashed', true),
    (p_workspace_id, 'Food',          'spent',    '#f97316', 'utensils',      true),
    (p_workspace_id, 'Transport',     'spent',    '#0ea5e9', 'car',           true),
    (p_workspace_id, 'Shopping',      'spent',    '#ec4899', 'shopping-bag',  true),
    (p_workspace_id, 'Bills',         'spent',    '#ef4444', 'receipt',       true),
    (p_workspace_id, 'Entertainment', 'spent',    '#a855f7', 'clapperboard',  true),
    (p_workspace_id, 'Education',     'spent',    '#3b82f6', 'graduation-cap',true),
    (p_workspace_id, 'Health',        'spent',    '#10b981', 'heart-pulse',   true),
    (p_workspace_id, 'Rent',          'spent',    '#f59e0b', 'house',         true),
    (p_workspace_id, 'Utilities',     'spent',    '#06b6d4', 'plug',          true),
    (p_workspace_id, 'Other',         'spent',    '#64748b', 'circle-dashed', true)
  on conflict (workspace_id, name, type) do nothing;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- create_workspace :: atomic workspace + owner membership + settings + seeds
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
set search_path = public
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

-- ---------------------------------------------------------------------------
-- create_invitation :: manager-only, cryptographically secure code
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
set search_path = public
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

  -- Retry on the astronomically unlikely code collision.
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
-- join_workspace :: redeem an invite code
--
-- Runs as definer because the joining user is not yet a member and therefore
-- cannot see the invitation row under RLS. Row is locked FOR UPDATE so two
-- concurrent redemptions of a single-use code cannot both succeed.
-- ---------------------------------------------------------------------------
create or replace function public.join_workspace(p_invite_code text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid    uuid := auth.uid();
  v_code   text;
  v_invite public.workspace_invitations;
  v_ws     public.workspaces;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_code := upper(trim(coalesce(p_invite_code, '')));
  -- Accept the code with or without its separating dash.
  v_code := replace(v_code, '-', '');
  if char_length(v_code) <> 8 then
    raise exception 'INVITE_INVALID';
  end if;
  v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);

  select * into v_invite
    from public.workspace_invitations
   where invite_code = v_code
   for update;

  if not found then
    raise exception 'INVITE_INVALID';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'INVITE_REVOKED';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'INVITE_EXPIRED';
  end if;

  if v_invite.use_count >= v_invite.max_uses then
    raise exception 'INVITE_EXHAUSTED';
  end if;

  if exists (
    select 1 from public.workspace_members
     where workspace_id = v_invite.workspace_id and user_id = v_uid
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status, invited_by)
  values (v_invite.workspace_id, v_uid, v_invite.role, 'active', v_invite.invited_by);

  update public.workspace_invitations
     set use_count   = use_count + 1,
         accepted_at = coalesce(accepted_at, now())
   where id = v_invite.id;

  select * into v_ws from public.workspaces where id = v_invite.workspace_id;
  return v_ws;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- preview_invitation :: validate a code without redeeming it
-- ---------------------------------------------------------------------------
create or replace function public.preview_invitation(p_invite_code text)
returns table (
  workspace_id   uuid,
  workspace_name text,
  workspace_avatar_url text,
  role           public.workspace_role,
  valid          boolean,
  reason         text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_code   text;
  v_invite public.workspace_invitations;
  v_ws     public.workspaces;
  v_uid    uuid := auth.uid();
begin
  v_code := upper(trim(coalesce(p_invite_code, '')));
  v_code := replace(v_code, '-', '');
  if char_length(v_code) <> 8 then
    return query select null::uuid, null::text, null::text, null::public.workspace_role, false, 'INVITE_INVALID';
    return;
  end if;
  v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);

  select * into v_invite from public.workspace_invitations where invite_code = v_code;
  if not found then
    return query select null::uuid, null::text, null::text, null::public.workspace_role, false, 'INVITE_INVALID';
    return;
  end if;

  select * into v_ws from public.workspaces where id = v_invite.workspace_id;

  if v_invite.revoked_at is not null then
    return query select v_ws.id, v_ws.name, v_ws.avatar_url, v_invite.role, false, 'INVITE_REVOKED'; return;
  end if;
  if v_invite.expires_at <= now() then
    return query select v_ws.id, v_ws.name, v_ws.avatar_url, v_invite.role, false, 'INVITE_EXPIRED'; return;
  end if;
  if v_invite.use_count >= v_invite.max_uses then
    return query select v_ws.id, v_ws.name, v_ws.avatar_url, v_invite.role, false, 'INVITE_EXHAUSTED'; return;
  end if;
  if v_uid is not null and exists (
    select 1 from public.workspace_members where workspace_id = v_ws.id and user_id = v_uid
  ) then
    return query select v_ws.id, v_ws.name, v_ws.avatar_url, v_invite.role, false, 'ALREADY_MEMBER'; return;
  end if;

  return query select v_ws.id, v_ws.name, v_ws.avatar_url, v_invite.role, true, null::text;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- dashboard_stats :: authoritative server-side totals for a period, plus the
-- immediately preceding period of equal length for percentage deltas.
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats(
  p_workspace_id uuid,
  p_from         date,
  p_to           date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_span     int;
  v_prev_to  date;
  v_prev_from date;
  v_cur      record;
  v_prev     record;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  v_span      := (p_to - p_from) + 1;
  v_prev_to   := p_from - 1;
  v_prev_from := v_prev_to - (v_span - 1);

  select
    coalesce(sum(amount) filter (where type = 'received'), 0) as received,
    coalesce(sum(amount) filter (where type = 'spent'), 0)    as spent,
    count(*) filter (where type = 'received')                 as received_count,
    count(*) filter (where type = 'spent')                    as spent_count
  into v_cur
  from public.transactions
  where workspace_id = p_workspace_id
    and transaction_date between p_from and p_to;

  select
    coalesce(sum(amount) filter (where type = 'received'), 0) as received,
    coalesce(sum(amount) filter (where type = 'spent'), 0)    as spent
  into v_prev
  from public.transactions
  where workspace_id = p_workspace_id
    and transaction_date between v_prev_from and v_prev_to;

  return jsonb_build_object(
    'period',        jsonb_build_object('from', p_from, 'to', p_to),
    'previousPeriod',jsonb_build_object('from', v_prev_from, 'to', v_prev_to),
    'received',      v_cur.received,
    'spent',         v_cur.spent,
    'balance',       v_cur.received - v_cur.spent,
    'receivedCount', v_cur.received_count,
    'spentCount',    v_cur.spent_count,
    'previous',      jsonb_build_object(
      'received', v_prev.received,
      'spent',    v_prev.spent,
      'balance',  v_prev.received - v_prev.spent
    )
  );
end;
$fn$;

-- ---------------------------------------------------------------------------
-- transaction_series :: gap-filled time series for the dashboard charts.
-- p_bucket: 'day' | 'week' | 'month'
-- ---------------------------------------------------------------------------
create or replace function public.transaction_series(
  p_workspace_id uuid,
  p_from         date,
  p_to           date,
  p_bucket       text default 'day'
)
returns table (
  bucket   date,
  received numeric,
  spent    numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_step interval;
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'FORBIDDEN';
  end if;

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'INVALID_DATE_RANGE';
  end if;

  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'INVALID_BUCKET';
  end if;

  v_step := ('1 ' || p_bucket)::interval;

  return query
  with grid as (
    select generate_series(
      date_trunc(p_bucket, p_from::timestamp),
      date_trunc(p_bucket, p_to::timestamp),
      v_step
    )::date as bucket
  ),
  agg as (
    select
      date_trunc(p_bucket, t.transaction_date::timestamp)::date as bucket,
      coalesce(sum(t.amount) filter (where t.type = 'received'), 0) as received,
      coalesce(sum(t.amount) filter (where t.type = 'spent'), 0)    as spent
    from public.transactions t
    where t.workspace_id = p_workspace_id
      and t.transaction_date between p_from and p_to
    group by 1
  )
  select g.bucket,
         coalesce(a.received, 0)::numeric,
         coalesce(a.spent, 0)::numeric
    from grid g
    left join agg a on a.bucket = g.bucket
   order by g.bucket;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- category_breakdown :: spend/receive split by category for a period
-- ---------------------------------------------------------------------------
create or replace function public.category_breakdown(
  p_workspace_id uuid,
  p_from         date,
  p_to           date,
  p_type         public.transaction_type default 'spent'
)
returns table (
  category_id   uuid,
  category_name text,
  color         text,
  total         numeric,
  tx_count      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.is_workspace_member(p_workspace_id) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    c.id,
    coalesce(c.name, 'Uncategorized'),
    c.color,
    sum(t.amount)::numeric,
    count(*)::bigint
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace_id
    and t.type = p_type
    and t.transaction_date between p_from and p_to
  group by c.id, c.name, c.color
  order by 4 desc;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- my_workspaces :: workspaces for the caller, with role and member counts
-- ---------------------------------------------------------------------------
create or replace function public.my_workspaces()
returns table (
  id           uuid,
  name         text,
  slug         text,
  description  text,
  avatar_url   text,
  role         public.workspace_role,
  member_count bigint,
  joined_at    timestamptz,
  created_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    w.id, w.name, w.slug, w.description, w.avatar_url,
    m.role,
    (select count(*) from public.workspace_members mm
      where mm.workspace_id = w.id and mm.status = 'active'),
    m.joined_at,
    w.created_at
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by m.joined_at asc;
$fn$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.create_workspace(text, text, text, text)                              to authenticated;
grant execute on function public.create_invitation(uuid, public.workspace_role, int, int, text)         to authenticated;
grant execute on function public.join_workspace(text)                                                   to authenticated;
grant execute on function public.preview_invitation(text)                                               to authenticated;
grant execute on function public.dashboard_stats(uuid, date, date)                                      to authenticated;
grant execute on function public.transaction_series(uuid, date, date, text)                             to authenticated;
grant execute on function public.category_breakdown(uuid, date, date, public.transaction_type)          to authenticated;
grant execute on function public.my_workspaces()                                                        to authenticated;

revoke execute on function public.seed_workspace_categories(uuid) from public, anon, authenticated;
revoke execute on function public.generate_invite_code()          from public, anon;

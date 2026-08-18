-- =============================================================================
-- Zefinoro :: 0003 :: Row Level Security
--
-- Design note: membership lookups used *inside* policies must not themselves be
-- filtered by RLS, or `workspace_members` policies recurse infinitely. All
-- membership predicates therefore go through SECURITY DEFINER helpers that read
-- the table with RLS bypassed. The helpers are STABLE so Postgres can cache them
-- per statement.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from public.workspace_members m
     where m.workspace_id = ws
       and m.user_id = auth.uid()
       and m.status = 'active'
  );
$fn$;

create or replace function public.workspace_role_of(ws uuid)
returns public.workspace_role
language sql
stable
security definer
set search_path = public
as $fn$
  select m.role from public.workspace_members m
   where m.workspace_id = ws
     and m.user_id = auth.uid()
     and m.status = 'active'
   limit 1;
$fn$;

-- Owner or admin: the "can manage" tier.
create or replace function public.is_workspace_manager(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.workspace_role_of(ws) in ('owner', 'admin');
$fn$;

create or replace function public.is_workspace_owner(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.workspace_role_of(ws) = 'owner';
$fn$;

grant execute on function public.is_workspace_member(uuid)  to authenticated;
grant execute on function public.workspace_role_of(uuid)    to authenticated;
grant execute on function public.is_workspace_manager(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid)   to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles               enable row level security;
alter table public.workspaces             enable row level security;
alter table public.workspace_members      enable row level security;
alter table public.workspace_invitations  enable row level security;
alter table public.categories             enable row level security;
alter table public.transactions           enable row level security;
alter table public.transaction_attachments enable row level security;
alter table public.workspace_settings     enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
--   Readable by yourself, and by people who share a workspace with you
--   (needed to render "Created By" and the members table).
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
        from public.workspace_members me
        join public.workspace_members them
          on them.workspace_id = me.workspace_id
       where me.user_id = auth.uid()
         and me.status = 'active'
         and them.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select to authenticated
  using (public.is_workspace_member(id));

-- Creation goes through create_workspace() RPC, but a direct insert is allowed
-- provided the caller claims authorship of their own row.
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists workspaces_update on public.workspaces;
create policy workspaces_update on public.workspaces
  for update to authenticated
  using (public.is_workspace_manager(id))
  with check (public.is_workspace_manager(id));

drop policy if exists workspaces_delete on public.workspaces;
create policy workspaces_delete on public.workspaces
  for delete to authenticated
  using (public.is_workspace_owner(id));

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
drop policy if exists workspace_members_select on public.workspace_members;
create policy workspace_members_select on public.workspace_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

-- Joining is done via join_workspace() RPC (SECURITY DEFINER). Managers may
-- also add members directly.
drop policy if exists workspace_members_insert on public.workspace_members;
create policy workspace_members_insert on public.workspace_members
  for insert to authenticated
  with check (public.is_workspace_manager(workspace_id));

drop policy if exists workspace_members_update on public.workspace_members;
create policy workspace_members_update on public.workspace_members
  for update to authenticated
  using (public.is_workspace_manager(workspace_id))
  with check (public.is_workspace_manager(workspace_id));

-- Managers can remove members; anyone can remove themselves (leave workspace).
-- The last-owner trigger still blocks orphaning a workspace.
drop policy if exists workspace_members_delete on public.workspace_members;
create policy workspace_members_delete on public.workspace_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_workspace_manager(workspace_id));

-- ---------------------------------------------------------------------------
-- workspace_invitations
--   Only managers see invitations. Redemption happens through the
--   join_workspace() RPC, which reads the row with RLS bypassed - a joining
--   user is not yet a member and so cannot select the invitation directly.
-- ---------------------------------------------------------------------------
drop policy if exists invitations_select on public.workspace_invitations;
create policy invitations_select on public.workspace_invitations
  for select to authenticated
  using (public.is_workspace_manager(workspace_id));

drop policy if exists invitations_insert on public.workspace_invitations;
create policy invitations_insert on public.workspace_invitations
  for insert to authenticated
  with check (public.is_workspace_manager(workspace_id) and invited_by = auth.uid());

drop policy if exists invitations_update on public.workspace_invitations;
create policy invitations_update on public.workspace_invitations
  for update to authenticated
  using (public.is_workspace_manager(workspace_id))
  with check (public.is_workspace_manager(workspace_id));

drop policy if exists invitations_delete on public.workspace_invitations;
create policy invitations_delete on public.workspace_invitations
  for delete to authenticated
  using (public.is_workspace_manager(workspace_id));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using (public.is_workspace_manager(workspace_id) and not is_system)
  with check (public.is_workspace_manager(workspace_id));

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated
  using (public.is_workspace_manager(workspace_id) and not is_system);

-- ---------------------------------------------------------------------------
-- transactions
--   Every member reads all workspace transactions (it is a shared ledger).
--   Members may edit/delete their own; managers may edit/delete any.
-- ---------------------------------------------------------------------------
drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (created_by = auth.uid() or public.is_workspace_manager(workspace_id))
  )
  with check (public.is_workspace_member(workspace_id));

drop policy if exists transactions_delete on public.transactions;
create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (created_by = auth.uid() or public.is_workspace_manager(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- transaction_attachments
-- ---------------------------------------------------------------------------
drop policy if exists attachments_select on public.transaction_attachments;
create policy attachments_select on public.transaction_attachments
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists attachments_insert on public.transaction_attachments;
create policy attachments_insert on public.transaction_attachments
  for insert to authenticated
  with check (public.is_workspace_member(workspace_id) and uploaded_by = auth.uid());

drop policy if exists attachments_delete on public.transaction_attachments;
create policy attachments_delete on public.transaction_attachments
  for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (uploaded_by = auth.uid() or public.is_workspace_manager(workspace_id))
  );

-- ---------------------------------------------------------------------------
-- workspace_settings
-- ---------------------------------------------------------------------------
drop policy if exists workspace_settings_select on public.workspace_settings;
create policy workspace_settings_select on public.workspace_settings
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists workspace_settings_upsert on public.workspace_settings;
create policy workspace_settings_upsert on public.workspace_settings
  for insert to authenticated
  with check (public.is_workspace_manager(workspace_id));

drop policy if exists workspace_settings_update on public.workspace_settings;
create policy workspace_settings_update on public.workspace_settings
  for update to authenticated
  using (public.is_workspace_manager(workspace_id))
  with check (public.is_workspace_manager(workspace_id));

-- ---------------------------------------------------------------------------
-- Lock down the anon role - nothing in this schema is public.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;

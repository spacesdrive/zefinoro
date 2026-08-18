-- =============================================================================
-- Zefinoro :: 0007 :: Let a workspace actually be deleted
--
-- `guard_last_owner` exists to stop a workspace being orphaned - you may not
-- demote or remove its final owner. But it fires on every DELETE of a
-- workspace_members row, including the rows removed by the ON DELETE CASCADE
-- when the *workspace itself* is deleted. The owner's membership goes, the
-- trigger sees no remaining owner, and raises.
--
-- The effect was that "Delete workspace" always failed with
-- WORKSPACE_LAST_OWNER - for the owner, who is the only role permitted to do
-- it. The guard was protecting the workspace from being deleted on purpose.
--
-- The fix: if the parent workspace no longer exists, there is nothing left to
-- protect. Postgres deletes the parent row before cascading to children, so
-- this check is false exactly when the delete is a cascade from `workspaces`.
-- =============================================================================

create or replace function public.guard_last_owner()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  remaining int;
  target_ws uuid;
begin
  target_ws := coalesce(old.workspace_id, new.workspace_id);

  -- The workspace is being deleted outright: let its memberships go with it.
  if not exists (select 1 from public.workspaces w where w.id = target_ws) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner' then
    select count(*) into remaining
      from public.workspace_members
     where workspace_id = target_ws and role = 'owner' and id <> old.id;
    if remaining = 0 then
      raise exception 'WORKSPACE_LAST_OWNER' using hint = 'A workspace must keep at least one owner.';
    end if;
  end if;

  if tg_op = 'DELETE' and old.role = 'owner' then
    select count(*) into remaining
      from public.workspace_members
     where workspace_id = target_ws and role = 'owner' and id <> old.id;
    if remaining = 0 then
      raise exception 'WORKSPACE_LAST_OWNER' using hint = 'A workspace must keep at least one owner.';
    end if;
  end if;

  return coalesce(new, old);
end;
$fn$;

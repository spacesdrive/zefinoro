-- =============================================================================
-- Zefinoro :: 0001 :: Core schema (identity, workspaces, membership)
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.workspace_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_type as enum ('received', 'spent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_status as enum ('active', 'invited', 'suspended');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles :: 1-1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       citext not null,
  full_name   text,
  avatar_url  text,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_full_name_len check (full_name is null or char_length(full_name) <= 120),
  constraint profiles_bio_len       check (bio is null or char_length(bio) <= 500)
);

create index if not exists profiles_email_idx on public.profiles (email);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile whenever an auth user is created (email or OAuth).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ), ''),
    nullif(coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      ''
    ), '')
  )
  on conflict (id) do update
    set email      = excluded.email,
        avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
        full_name  = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  avatar_url  text,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint workspaces_name_len check (char_length(name) between 1 and 80),
  constraint workspaces_desc_len check (description is null or char_length(description) <= 500)
);

create index if not exists workspaces_created_by_idx on public.workspaces (created_by);

drop trigger if exists workspaces_set_updated_at on public.workspaces;
create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workspace_members
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.workspace_role not null default 'member',
  status       public.member_status  not null default 'active',
  invited_by   uuid references public.profiles(id) on delete set null,
  joined_at    timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_workspace_idx on public.workspace_members (workspace_id);
create index if not exists workspace_members_user_idx      on public.workspace_members (user_id);
create index if not exists workspace_members_role_idx      on public.workspace_members (workspace_id, role);

drop trigger if exists workspace_members_set_updated_at on public.workspace_members;
create trigger workspace_members_set_updated_at
  before update on public.workspace_members
  for each row execute function public.set_updated_at();

-- A workspace must always retain at least one owner.
create or replace function public.guard_last_owner()
returns trigger
language plpgsql
as $$
declare
  remaining int;
  target_ws uuid;
begin
  target_ws := coalesce(old.workspace_id, new.workspace_id);

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
$$;

drop trigger if exists workspace_members_guard_last_owner on public.workspace_members;
create trigger workspace_members_guard_last_owner
  before update or delete on public.workspace_members
  for each row execute function public.guard_last_owner();

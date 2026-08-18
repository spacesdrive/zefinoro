-- =============================================================================
-- Zefinoro :: 0002 :: Finance domain (categories, transactions, attachments)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- categories :: workspace-scoped, seeded per workspace on creation
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  type         public.transaction_type not null,
  color        text,
  icon         text,
  is_system    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, name, type),
  constraint categories_name_len check (char_length(name) between 1 and 60)
);

create index if not exists categories_workspace_idx      on public.categories (workspace_id);
create index if not exists categories_workspace_type_idx on public.categories (workspace_id, type);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  created_by       uuid not null references public.profiles(id) on delete restrict,
  type             public.transaction_type not null,
  amount           numeric(18, 2) not null,
  currency         char(3) not null default 'INR',
  title            text not null,
  description      text,
  category_id      uuid references public.categories(id) on delete set null,
  transaction_date date not null default current_date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint transactions_amount_positive check (amount > 0),
  constraint transactions_title_len       check (char_length(title) between 1 and 160),
  constraint transactions_desc_len        check (description is null or char_length(description) <= 2000),
  constraint transactions_currency_fmt    check (currency ~ '^[A-Z]{3}$')
);

create index if not exists transactions_workspace_idx    on public.transactions (workspace_id);
create index if not exists transactions_created_by_idx   on public.transactions (created_by);
create index if not exists transactions_type_idx         on public.transactions (workspace_id, type);
create index if not exists transactions_date_idx         on public.transactions (workspace_id, transaction_date desc);
create index if not exists transactions_category_idx     on public.transactions (category_id);
create index if not exists transactions_ws_type_date_idx on public.transactions (workspace_id, type, transaction_date desc);
create index if not exists transactions_title_idx        on public.transactions (workspace_id, lower(title));

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- A category must belong to the same workspace and match the transaction type.
create or replace function public.validate_transaction_category()
returns trigger
language plpgsql
as $fn$
declare
  cat record;
begin
  if new.category_id is null then
    return new;
  end if;

  select workspace_id, type into cat
    from public.categories
   where id = new.category_id;

  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  if cat.workspace_id <> new.workspace_id then
    raise exception 'CATEGORY_WORKSPACE_MISMATCH';
  end if;

  if cat.type <> new.type then
    raise exception 'CATEGORY_TYPE_MISMATCH';
  end if;

  return new;
end;
$fn$;

drop trigger if exists transactions_validate_category on public.transactions;
create trigger transactions_validate_category
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_category();

-- ---------------------------------------------------------------------------
-- transaction_attachments
-- ---------------------------------------------------------------------------
create table if not exists public.transaction_attachments (
  id                   uuid primary key default gen_random_uuid(),
  transaction_id       uuid not null references public.transactions(id) on delete cascade,
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by          uuid not null references public.profiles(id) on delete restrict,
  original_filename    text not null,
  mime_type            text not null,
  file_size            bigint not null,
  cloudinary_public_id text not null,
  secure_url           text not null,
  resource_type        text not null default 'auto',
  created_at           timestamptz not null default now(),
  constraint attachments_size_positive check (file_size > 0),
  constraint attachments_size_limit    check (file_size <= 26214400),
  constraint attachments_url_https     check (secure_url like 'https://%'),
  constraint attachments_resource_type check (resource_type in ('image', 'video', 'raw', 'auto'))
);

create index if not exists attachments_transaction_idx on public.transaction_attachments (transaction_id);
create index if not exists attachments_workspace_idx   on public.transaction_attachments (workspace_id);
create index if not exists attachments_uploader_idx    on public.transaction_attachments (uploaded_by);

-- The attachment's workspace must match its parent transaction's workspace.
create or replace function public.validate_attachment_workspace()
returns trigger
language plpgsql
as $fn$
declare
  tx_ws uuid;
begin
  select workspace_id into tx_ws from public.transactions where id = new.transaction_id;
  if not found then
    raise exception 'TRANSACTION_NOT_FOUND';
  end if;
  if tx_ws <> new.workspace_id then
    raise exception 'ATTACHMENT_WORKSPACE_MISMATCH';
  end if;
  return new;
end;
$fn$;

drop trigger if exists attachments_validate_workspace on public.transaction_attachments;
create trigger attachments_validate_workspace
  before insert or update on public.transaction_attachments
  for each row execute function public.validate_attachment_workspace();

-- ---------------------------------------------------------------------------
-- workspace_invitations
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_invitations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invite_code  text not null unique,
  email        citext,
  invited_by   uuid not null references public.profiles(id) on delete cascade,
  role         public.workspace_role not null default 'member',
  max_uses     int not null default 1,
  use_count    int not null default 0,
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  constraint invitations_role_not_owner check (role <> 'owner'),
  constraint invitations_max_uses       check (max_uses between 1 and 100),
  constraint invitations_use_count      check (use_count >= 0)
);

create index if not exists invitations_workspace_idx on public.workspace_invitations (workspace_id);
create index if not exists invitations_code_idx      on public.workspace_invitations (invite_code);
create index if not exists invitations_inviter_idx   on public.workspace_invitations (invited_by);

-- ---------------------------------------------------------------------------
-- workspace_settings
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_settings (
  workspace_id      uuid primary key references public.workspaces(id) on delete cascade,
  default_currency  char(3) not null default 'INR',
  timezone          text not null default 'Asia/Kolkata',
  date_format       text not null default 'dd MMM yyyy',
  fiscal_year_start smallint not null default 4,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint settings_currency_fmt check (default_currency ~ '^[A-Z]{3}$'),
  constraint settings_fiscal_month check (fiscal_year_start between 1 and 12)
);

drop trigger if exists workspace_settings_set_updated_at on public.workspace_settings;
create trigger workspace_settings_set_updated_at
  before update on public.workspace_settings
  for each row execute function public.set_updated_at();

# Zefinoro

A multi-workspace financial dashboard. Track what comes in, what goes out, and
what is left - with categories, attachments, members and role-based access,
across as many workspaces as you belong to.

**Live:** https://zefinoro.spacesdrive.cc

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Strict types, fast builds, route-level code splitting |
| UI | shadcn/ui + Tailwind CSS v4 | Radix primitives, tokens measured from the reference design |
| Server state | TanStack Query | Workspace-scoped cache keys, no cross-tenant bleed |
| Forms | React Hook Form + Zod | Same schemas the API validates against |
| Charts | Recharts | Theme-aware, accessible, colourblind-validated palette |
| API | Hono on Cloudflare Workers | One Worker serves the API *and* the SPA - same origin, no CORS |
| Database | Supabase (PostgreSQL) | Row Level Security is the real authorization boundary |
| Cache | Upstash Redis | Analytics cache only; Postgres stays the source of truth |
| Files | Cloudinary | Direct browser uploads, never proxied through the Worker |

---

## Architecture

```
zefinoro/
├── backend/                  Hono API on Cloudflare Workers
│   ├── src/
│   │   ├── index.ts          Worker entry: API under /api, SPA everywhere else
│   │   ├── routes/           Route table + middleware composition
│   │   ├── controllers/      One module per resource
│   │   ├── middleware/       auth, workspace authorization, validation, rate limit
│   │   ├── lib/              supabase, redis, cloudinary, files, dates, errors
│   │   ├── schemas/          Zod request contracts
│   │   └── types/            Bindings + database row types
│   ├── test/                 Unit tests (dates, files, schemas, delivery URLs)
│   └── wrangler.jsonc
├── frontend/                 React SPA
│   └── src/
│       ├── app/              App shell, router, query client
│       ├── routes/           Page components
│       ├── components/       ui (shadcn), layout, dashboard, billing, files, ...
│       ├── features/         Per-domain API clients and query hooks
│       ├── contexts/         auth, workspace, theme
│       ├── lib/              api client, formatting, file registry, uploads
│       └── schemas/          Zod form contracts
└── supabase/migrations/      Schema, RLS policies, RPCs
```

### Request path

```
Browser ──JWT──> Worker ──JWT──> Supabase (RLS enforced as the signed-in user)
   │                │
   │                └──> Upstash (analytics cache, fail-open)
   └──────────────────> Cloudinary (direct upload, never via the Worker)
```

The Worker holds **no service-role key**. Every database call runs as the
calling user, so Row Level Security - not application code - is the last line
of defence. A bug in a controller cannot leak another workspace's ledger.

---

## Security model

- **RLS on every table.** Membership predicates go through `SECURITY DEFINER`
  helpers (`is_workspace_member`, `is_workspace_manager`) so `workspace_members`
  policies do not recurse infinitely.
- **The workspace id in a URL is never trusted.** `requireWorkspace` resolves it
  to a verified membership first, and returns *404* rather than 403 to a
  non-member - confirming a workspace exists is itself a leak.
- **Invite codes are generated in the database** (`gen_random_bytes`), from an
  alphabet with no ambiguous characters, and redeemed inside a locked
  transaction so a single-use code cannot be redeemed twice concurrently.
- **A workspace can never lose its last owner** - enforced by trigger, not by
  hopeful UI.
- **Uploads are validated twice.** The browser checks for fast feedback; the
  Worker re-checks extension, MIME *and* size, rejects mismatches, and refuses
  any attachment URL that does not belong to our Cloudinary account.
- **Rate limits** on invite creation, invite preview (the one endpoint that
  reveals whether a code exists), workspace creation and upload signing.
- **No secrets in the bundle.** Only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` reach the browser, both safe to expose publicly. No
  Cloudinary credential is bundled at all - the browser receives a signed,
  short-lived upload policy per file.

---

## Setup

### 1. Install

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2. Configure

```bash
cp .env.example frontend/.env      # fill in the VITE_* values
cp .env.example backend/.dev.vars  # fill in the server-side values
```

See `.env.example` for what each variable is and where to find it.

### 3. Apply the database schema

```bash
export SUPABASE_ACCESS_TOKEN=<your token>
export SUPABASE_DB_PASSWORD=<your database password>

npx supabase link --project-ref <project-ref>
npx supabase db push
```

This creates the tables, indexes, RLS policies, RPCs and the per-workspace
default category seeds.

### 4. Run

```bash
# terminal 1 - API on :8787
cd backend && npm run dev

# terminal 2 - SPA on :5173, proxying /api to the Worker
cd frontend && npm run dev
```

---

## Continuous integration and deployment

Two GitHub Actions workflows live in `.github/workflows`:

- **`ci.yml`** runs on every push and pull request: typecheck, unit tests and a
  production build for both packages, plus a scan that fails the build if a
  credential pattern ever lands in a tracked file.
- **`deploy.yml`** runs on a push to `main` that touches `backend/**` or
  `frontend/**`. It re-runs the checks, builds the SPA, deploys the Worker, and
  finishes with a smoke test against the live domain (health, auth guard, API
  404, SPA shell). A README-only commit does not trigger a release.

Set these four repository secrets under **Settings -> Secrets and variables ->
Actions**:

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Deploy the Worker |
| `CLOUDFLARE_ACCOUNT_ID` | Target account |
| `VITE_SUPABASE_URL` | Inlined into the bundle at build time |
| `VITE_SUPABASE_ANON_KEY` | Inlined into the bundle at build time |

Server-side secrets (Supabase, Upstash, Cloudinary) are deliberately **not**
passed through CI. They are set once with `wrangler secret bulk` and persist
across deployments, so CI never needs to see them.

## Deploying manually

The SPA is built first, then the Worker is deployed with the built assets
bound to it:

```bash
cd frontend && npm run build
cd ../backend && npx wrangler deploy
```

Secrets are uploaded once per environment:

```bash
npx wrangler secret bulk secrets.json
```

`wrangler.jsonc` declares the custom domain, so DNS and routing are provisioned
automatically. `run_worker_first: ["/api/*"]` keeps API routes from being
swallowed by the static asset handler, and `not_found_handling:
"single-page-application"` makes deep links like `/billing/received` reload
correctly.

### Supabase Auth configuration

Set the site URL and allowed redirects to your deployed origin:

- **Site URL:** `https://zefinoro.spacesdrive.cc`
- **Redirect allow list:** `https://zefinoro.spacesdrive.cc/**`,
  `http://localhost:5173/**`

Email confirmation is disabled (`mailer_autoconfirm: true`), so the app requires
no outbound email to run.

For Google sign-in, enable the Google provider in Supabase Auth and add the
Supabase callback URL to your Google OAuth client.

---

## Notable implementation decisions

**Deleting cleans up storage.** Postgres cascades rows when a transaction or a
whole workspace is deleted, but Cloudinary knows nothing about that. Both paths
collect the affected assets first and purge them in `waitUntil()` after the
response, so files are not orphaned and the user never waits on a third-party
API.

**Money is never optimistic.** Toggles and preferences update optimistically;
transaction creation and deletion wait for the server. A row that appears in a
ledger and then vanishes is worse than a brief spinner.

**Totals are computed in Postgres.** The client sends a *period*, never a
figure. `dashboard_stats` returns the current window and the preceding window of
equal length, so percentage deltas are also server-derived.

**"Today" belongs to the user, not to UTC.** Relative presets are anchored to
the caller's local date. Without that, someone in IST recording a transaction
just after midnight would find it excluded from "last 30 days" - their day had
rolled over while the server's had not.

**Cache invalidation by version bump.** Upstash has no cheap wildcard delete, so
every analytics key embeds a per-workspace counter. A mutation increments it,
orphaning that whole generation at once; the orphans expire on their own TTL.
Redis failures are swallowed everywhere - a cache outage must not take the
ledger down.

**Chart colours were validated, not chosen by eye.** Received/Spent is a
two-slot categorical encoding. The obvious green/red pair *failed* colourblind
separation (deuteranopia ΔE 5.8, below the floor of 8) - precisely the pair 8%
of men cannot resolve, on a chart whose entire job is "in versus out". Teal
`#0d9488` / orange `#ea580c` clears every check against both the light and dark
surfaces, and identity never rests on colour alone: both charts carry a legend
and a naming tooltip.

**Uploads are always signed.** An unsigned preset is a bearer token sitting in
the JS bundle - anyone can read it and upload to the cloud from a script. The
browser instead asks the Worker for a short-lived signature per file, so only an
authenticated member can upload and the destination folder is pinned
server-side. The same credentials let the Worker delete the remote asset when an
attachment is removed.

**Attachment URLs depend on one Cloudinary setting.** With *Strict
Transformations* enabled, Cloudinary 401s any transformation in a delivery path
-- including a plain resize and the `fl_attachment` download flag - while the
untransformed URL serves fine, so every thumbnail renders as a broken icon.
`CLOUDINARY_ENABLE_TRANSFORMS` selects between derived URLs and plain ones.

One sharp edge worth knowing: `fl_attachment:<name>` must not contain the file
extension. `fl_attachment:receipt.png` returns 400, because the dot terminates
the transformation segment; Cloudinary appends the extension itself. There is a
regression test for this in `backend/test/cloudinary.test.ts`.

---

## Tests

```bash
cd backend  && npm test    # 60 tests - period maths, file validation, schemas, delivery URLs
cd frontend && npm test    # 42 tests - formatting, schemas, file checks
```

Coverage focuses on the logic that is easy to get quietly wrong: inclusive date
windows, leap years, the timezone anchor, two-decimal money handling, the
extension/MIME cross-check that stops a renamed executable, and the Cloudinary
URL construction that has already broken downloads once.

```bash
npm run typecheck   # both packages, strict, zero errors
npm run build
```

---

## Known gaps

- **Google OAuth is not enabled.** The client-side flow is complete, but the
  Supabase project has no Google provider credentials
  (`external_google_enabled: false`). Create an OAuth 2.0 Web client in Google
  Cloud Console with redirect URI
  `https://<project-ref>.supabase.co/auth/v1/callback`, then enable the provider
  in Supabase Auth. Until then, "Continue with Google" will fail.
- **Thumbnails are full-size images on the current cloud.** `di7nn8znb` has
  Cloudinary's **Strict Transformations** enabled, so every transformed URL
  returns 401 and `CLOUDINARY_ENABLE_TRANSFORMS` is set to `false`. Everything
  works, but the attachment list downloads full-size images and scales them in
  CSS, PDFs show a typed icon rather than a page preview, and downloads are
  fetched as a blob to preserve the filename (`fl_attachment` is a
  transformation). Disabling Strict Transformations at **Settings -> Security**
  and flipping the flag to `true` restores cheap 96px thumbnails, PDF page
  previews and streamed downloads.

  The two clouds available differ, and each needs exactly one toggle:

  | | `di7nn8znb` (in use) | `dbh4azua9` |
  |---|---|---|
  | transformations | blocked | allowed |
  | PDF/ZIP delivery | allowed | blocked |
  | one toggle to fix | disable Strict Transformations | allow PDF/ZIP delivery |

- **There is no password-reset flow.** It was removed deliberately: it is the
  only feature that depends on outbound email, and Supabase's built-in mailer
  only delivers to your own org's team members. A signed-in user can still
  change their password from Settings -> Accounts, which needs no email at all.
  If you add custom SMTP later, the flow can be reinstated.
- **Email confirmation is off** (`mailer_autoconfirm: true`), so signups get a
  session immediately and the app needs no outbound email to function.

## Operational notes

- **Redis is live.** Analytics keys look like
  `ws:<id>:stats:<from>:<to>:v<n>`, where `<n>` is the workspace's cache
  generation. A mutation increments `ws:<id>:v`, which orphans the previous
  generation immediately; orphans expire on their own 120s TTL. Every Redis
  failure is swallowed, so the app keeps working if the cache is unreachable --
  which also means a misconfiguration is silent. If you suspect the cache is
  not being used, check that keys appear in the Upstash console rather than
  waiting for an error.

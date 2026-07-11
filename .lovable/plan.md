# Short-Slug Routing Refactor

Simplify customer-facing URLs from `/banks/bank-of-america/portal` to `/boa` + `/portal`, without touching banking logic, GBOC, blueprints, dashboard designer, or auth mechanics.

## 1. Database (single migration)

Add `short_slug` to `bb_bank_drafts` alongside existing `slug`:

- `short_slug text` — nullable, `UNIQUE`, indexed
- Backfill: for each row, derive from bank name (acronym if ≥2 words, else sanitized name, max 12 chars, `-2/-3` on collisions). Existing long `slug` remains untouched, so all storage keys, published manifests, and custom-domain records keep working.
- No RLS/grant changes (column added to existing table).

Add reserved-slug list in code (not SQL): `portal, accounts, cards, transactions, support, profile, security, statements, beneficiaries, notifications, transfer, admin, gboc, launch, auth, banks, bank-builder, products, manage, api, assets`. Bank Builder validates against it and auto-suffixes.

## 2. New route tree

Public (bank landing + auth):
```text
src/routes/$bankSlug.tsx           layout — resolves bank by short_slug OR slug
src/routes/$bankSlug.index.tsx     /:slug         (gateway/home)
src/routes/$bankSlug.login.tsx     /:slug/login
src/routes/$bankSlug.register.tsx  /:slug/register
src/routes/$bankSlug.forgot.tsx    /:slug/forgot
src/routes/$bankSlug.$page.tsx     /:slug/:cms-page
```

Authenticated portal (pathless layout, flat URLs):
```text
src/routes/_portal.tsx                  layout — reads session, resolves bank server-side
src/routes/_portal.portal.tsx           /portal
src/routes/_portal.accounts.tsx         /accounts
src/routes/_portal.cards.tsx            /cards
src/routes/_portal.transactions.tsx     /transactions
src/routes/_portal.transactions.$id.tsx /transactions/:id
src/routes/_portal.transfer.tsx         /transfer
src/routes/_portal.beneficiaries.tsx    /beneficiaries
src/routes/_portal.statements.tsx       /statements
src/routes/_portal.support.tsx          /support
src/routes/_portal.profile.tsx          /profile
src/routes/_portal.security.tsx         /security
src/routes/_portal.notifications.tsx    /notifications
```

Each `_portal.*` route body is moved verbatim from its `banks.$slug.portal.*` counterpart; the only change is how the bank/session are obtained (see §3).

## 3. Session-based bank resolution

Today portal server functions take `{ slug }` as input and cross-check against the session. Change:

- `customer/session.server.ts` — session cookie already stores `customer_id`; add `bank_id` (already there via customer row). Loader helper `requireCustomerSession()` returns `{ session, bank }` with no slug argument.
- All `_portal.*` routes call server fns without a slug; server fns derive the bank from the session row.
- Customer-facing server fns (`accounts.functions.ts`, `cards.functions.ts`, `transactions.functions.ts`, `transfers.functions.ts`, `beneficiaries.functions.ts`, `support.functions.ts`, `security.functions.ts`, `customer.functions.ts` portal reads, `activity.functions.ts`) gain a `slug`-less overload; the slug param stays accepted for back-compat but is ignored in favor of the session.
- Login/register/forgot still take `slug` (pre-session).

## 4. Back-compat redirects

Keep the `banks.$slug.*` route files but replace each component with a redirect:

- `/banks/:slug` → `/:short_slug`
- `/banks/:slug/login|register|forgot` → `/:short_slug/login|register|forgot`
- `/banks/:slug/portal` and any `/banks/:slug/portal/*` → `/portal`, `/accounts`, etc. (mapped in one table)
- Redirect resolves the bank's `short_slug` from `slug` (loader) and issues `throw redirect({ to, params, statusCode: 301 })`.

## 5. Bank Builder

Add "URL slug" field to the builder form (existing UI in `bank-builder.tsx` / `bank-builder.functions.ts`):

- Text input beneath Display Name, prefilled from generator.
- Live validation: lowercase, `[a-z0-9-]`, 2–20 chars, not reserved, unique (server check on save).
- Server: on save, sanitize + collision-suffix; store in `short_slug`.

## 6. Internal links to update

Every `<Link to="/banks/$slug/...">` and every `navigate({ to: "/banks/$slug/..." })` in customer-facing UI:

- Public pages (login/register/forgot, gateway, CMS pages): keep `$bankSlug` param but link via new routes.
- Post-login navigations: link to flat `/portal`, `/accounts`, etc. — no params.
- Portal sidebar, header, breadcrumbs, notification bell, chat widget, product-gating "unavailable" links, back links.
- Login success handler: redirect to `/portal` instead of `/banks/:slug/portal`.
- Any email templates / notification copy referring to `/banks/:slug/...` — updated to platform absolute URL + new path.
- Manifest builder / tenant-site anchor generation.

GBOC, admin, launch, manage, bank-builder pages: unchanged (they don't use customer routes).

## 7. Custom-domain router

`custom-domain-router.server.ts` currently maps a hostname → bank slug → `/banks/:slug`. Update its rewrite target to the new short-slug path (or flat portal path if session cookie present on that origin). Behavior on custom domains: root of the domain serves the bank's `/:short_slug` view; `/login`, `/register`, `/portal`, etc. work without the slug (single-tenant on that host).

## 8. Verification

- `bun run typecheck` (via harness) — zero errors.
- Manual: log in on preview, confirm redirect to `/portal`, navigate through portal pages, confirm old `/banks/:slug/*` URLs 301 to new ones, confirm Bank Builder saves a short slug and shows collision suffix.

## Out of scope (explicit)

Banking logic, branding, auth mechanics, customer session storage, GBOC, blueprint generation, dashboard designer, platform management, admin routes.

## Risk notes

- Any bank whose current long `slug` collides with a reserved word after backfill (unlikely — all current slugs are hyphenated bank names) is auto-suffixed.
- Customers with parallel sessions across banks (rare in this app) will see only their most recent bank after this change — the answer chosen for §3 accepts this.
- One-time DB migration is destructive-free (column add + backfill only); rollback = drop column.

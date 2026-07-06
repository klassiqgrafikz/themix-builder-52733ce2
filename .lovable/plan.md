# Phase 2 — Blueprint Library, Launch New Bank, Global Admin

Refactor the Bank Builder into a three-level Blueprint Library and an 8-step Launch New Bank wizard, plus a global platform admin shell. Preserves existing auth, tenant tables, DB relationships, and the underlying draft persistence.

## Scope guardrails
- No changes to `auth`, tenant routing, or existing non-`bb_` tables.
- Reuse `bb_bank_drafts` (identity/branding/features/simulation/admin_controls jsonb) — no schema break.
- Add new tables only: `bb_blueprint_categories`, `bb_modules`. Extend `bb_templates` with `blueprint_*` metadata (kept name for continuity; treated as "Blueprint" in UI).

## Data model changes (one migration)
- `bb_blueprint_categories(slug pk, name, description, icon, sort_order)` — seeded with 13 categories (Retail, Commercial, Corporate, Investment, Private, Digital, Credit Union, Cooperative, Islamic, Neo, Wealth Mgmt, Microfinance, International).
- `bb_modules(key pk, group_name, label, description, default_pages jsonb, sort_order)` — seeded with the full module list (Core Banking, Customer Services, Communication, Digital Services groups).
- `ALTER TABLE bb_templates ADD` columns: `blueprint_category` (fk slug), `version text`, `popularity int`, `recommended bool`, `desktop_preview jsonb`, `mobile_preview jsonb`, `supported_modules text[]`. Backfill `blueprint_category` from existing `category`.
- Reseed templates so every (category × country) combo listed in the spec has 2–3 blueprints with country-inspired naming.
- RLS unchanged (owner-only drafts; read-only catalog to authenticated). GRANTs on all new tables.

## Route architecture
```
/launch                              → Level 1: Blueprint categories grid
/launch/$categorySlug                → Level 2: Country grid
/launch/$categorySlug/$countryCode   → Level 3: Blueprints for cat+country
/launch/wizard/$draftId              → Steps 4–8 (identity → generate)
/admin                               → Global admin shell (index: overview)
/admin/customers, /admin/balances, /admin/transactions,
/admin/simulation, /admin/restrictions, /admin/freeze,
/admin/notifications, /admin/chat, /admin/support,
/admin/audit, /admin/activity, /admin/analytics,
/admin/roles, /admin/settings, /admin/banks
```
`/bank-builder` → 301-style client redirect to `/launch` for continuity.

## UI components (`src/components/launch/`, `src/components/admin/`)
- `BlueprintCategoryGrid`, `CountryPicker`, `BlueprintGrid`, `BlueprintCard` (preview, badges: Recommended / Premium / version / popularity), `BlueprintCompareDrawer`, `BlueprintPreviewModal` (device toggle + page tabs: Home, Login, Register, Dashboard, Accounts, Cards, Transfers, Settings, Support).
- `LaunchWizardShell` (steps 4–8 stepper), `ModuleSelector` (grouped toggles from `bb_modules`), `ReviewSummary`, `GenerateBankPanel`.
- `AdminShell` (sidebar with the 15 sections, top bank switcher, `<Outlet/>`), placeholder page bodies that read from the current tenant selection (data wired later — pages render with empty-state UI, not fake rows).

## Server functions (extend `src/lib/bank-builder.functions.ts`)
- `listBlueprintCategories()`, `listCountriesForCategory(categorySlug)`, `listBlueprints({ category, country })`.
- `listModules()`, `useBlueprint({ blueprintId })` → creates draft, clones blueprint into `identity/branding/features` + `template_id`, returns `{ draftId }`.
- Keep existing `createDraft/getDraft/updateDraft/finalizeDraft/listDrafts`.
- All authenticated via `requireSupabaseAuth`.

## Launch New Bank flow
1. Category (Level 1 route)
2. Country (Level 2 route)
3. Blueprint (Level 3 route) → `useBlueprint` clones and routes to wizard
4. Identity (bank name, country, currency, language, timezone, region, subdomain w/ slugify + uniqueness check on `identity->>subdomain`)
5. Branding (logo/favicon/hero upload to existing `bank-builder-assets` bucket, colors, typography)
6. Bank Modules (grouped selector from `bb_modules`; enabled modules stored in `features` jsonb keyed by module key)
7. Review
8. Generate → `finalizeDraft` sets `status='saved'` (no real DNS/tenant provisioning; that stays out of scope per prior phases)

## Global Admin
- New `/admin` shell with sidebar nav for all 15 tools. Each page renders a titled empty-state ("Select a bank to manage its <domain>") and a bank switcher fed by `listDrafts()`. No fake data, no changes to existing dashboard. Sim/admin toggles from the wizard remain the source of which tools are exposed per bank.

## Mobile responsive
- Category & country grids collapse to 1-col; blueprint cards to single column; wizard stepper condenses to "Step X / 8 — Title"; admin sidebar becomes a Sheet drawer under `sm`.

## Out of scope (explicit)
- Real tenant provisioning / DNS / custom domains.
- Live customer/transaction data wiring for admin pages (UI shells only).
- Changes to existing auth, dashboard, tenant tables.

## Technical notes
- One Supabase migration: new tables, ALTER + backfill, reseed blueprints, GRANTs, RLS.
- New TS types added to `src/lib/bank-builder.types.ts` (`BlueprintCategory`, `BankModule`, extended `BankTemplate`).
- `/bank-builder` route kept as a thin redirect to `/launch` so old links don't 404.

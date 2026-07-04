# Bank Builder Wizard

A 10-step wizard at `/bank-builder` that persists progress to Lovable Cloud (Supabase) after each step and ends with a saved (unpublished) bank configuration.

## Scope guardrails
- No changes to existing auth, tenant routing, dashboard, or existing DB tables.
- New tables only, all prefixed `bb_` (bank builder) to avoid collisions.
- Wizard is self-contained under `src/routes/bank-builder/` and `src/components/bank-builder/`.

## Routes (TanStack Router, file-based)
```
src/routes/bank-builder/
  route.tsx                 // layout: stepper header + <Outlet/>
  index.tsx                 // Step 1: start (Template vs Custom)
  $draftId.country.tsx      // Step 2
  $draftId.template.tsx     // Step 3
  $draftId.identity.tsx     // Step 5
  $draftId.branding.tsx     // Step 6
  $draftId.features.tsx     // Step 7
  $draftId.simulation.tsx   // Step 8
  $draftId.admin.tsx        // Step 9
  $draftId.review.tsx       // Step 10
```
Step 4 (template preview) is a modal opened from Step 3, not a route.

A draft row is created on Step 1 continue; `draftId` threads through the URL so refresh/back works and every step navigation writes to Supabase.

## Data model (new tables, RLS on, owner = auth.uid())
- `bb_bank_drafts` — one row per draft: `id, owner_id, mode ('template'|'custom'), country_code, template_id, identity jsonb, branding jsonb, features jsonb, simulation jsonb, admin_controls jsonb, current_step int, status ('draft'|'saved'), created_at, updated_at`.
- `bb_templates` — catalog: `id, name, country_code, category, thumbnail_url, pages jsonb, preview jsonb (desktop/tablet/mobile config), created_at`.
- `bb_countries` — reference list: `code, name, currency, timezone, default_language, flag_emoji`.

Templates and countries seeded via migration (real rows, not static JSON in code). Thumbnails/previews rendered from live component + branding tokens — no placeholder image files.

RLS:
- `bb_bank_drafts`: owner-only select/insert/update/delete via `auth.uid() = owner_id`.
- `bb_countries`, `bb_templates`: `SELECT` to `authenticated` (read-only catalog).

Grants added per public-schema rules.

## Components
- `WizardShell` — sticky top progress bar (Step X of 10), Back / Continue.
- `StepCard`, `OptionCard`, `ToggleCard`, `ColorField`, `FileDrop` (logo/favicon/hero — Supabase Storage bucket `bank-builder-assets`, private, owner-scoped RLS).
- `CountryGrid` (searchable), `TemplateGrid` (filter by country + category chips).
- `TemplatePreviewModal` — device toggle (Desktop/Tablet/Mobile) + page tabs (Home/Login/Register/Dashboard/Transfer/Cards/Transactions/Profile/Notifications/Statements) rendering a live React preview themed by branding tokens.
- `ReviewSummary` — grouped read-only view of every selection.

## Persistence flow
- On every Continue: `updateDraft` server function writes the step's slice + bumps `current_step`, then navigates.
- Subdomain auto-generated from bank name (slugified, uniqueness check against `bb_bank_drafts.identity->>subdomain`), shown as `<slug>.themixweb.app`.
- Step 10 "Generate Bank" sets `status='saved'` — does NOT publish, does NOT touch tenant tables.

## Server functions (`src/lib/bank-builder.functions.ts`)
All use `requireSupabaseAuth`:
- `createDraft`, `getDraft`, `updateDraft`, `listCountries`, `listTemplates(countryCode?)`, `checkSubdomain`, `finalizeDraft`.

## Mobile responsive
Grid layouts collapse to single column < sm; stepper condenses to "Step X / 10 — Title"; modal previews use device-frame scaling.

## Out of scope (explicit)
- Actual tenant provisioning / DNS / publish.
- Editing existing auth or tenant routing files.
- Any changes to existing tables.

## Technical notes
- Enable Lovable Cloud first (required for Supabase). One migration adds the 3 tables + seed data + storage bucket + RLS + grants.
- TypeScript types generated from Supabase; wizard-specific types in `src/lib/bank-builder.types.ts`.
- No fake APIs — all reads/writes go through server functions to Supabase.

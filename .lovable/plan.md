# Multi Dashboard Layout System

## Goal
Let each generated bank pick one of four full customer-portal visual themes — Classic, Modern, Minimal, Premium — without touching CBE, transfers, cards engine, sessions, receipts, statements, routes, or DB schema.

## Architecture

### 1. Layout token
- Extend `DashboardStyle` in `src/lib/bank-builder.types.ts` from `"classic" | "premium_card"` to `"classic" | "modern" | "minimal" | "premium"`.
- Keep the value on `branding.dashboard_style` inside `bb_bank_drafts` + `manifest.brand` (already wired). Existing `premium_card` values are migrated at read-time to `"premium"`; unknown values fall back to `"classic"`.
- No SQL migration required.

### 2. Layout resolver
- New folder `src/lib/customer/layouts/`
  - `resolver.tsx` — reads `manifest.brand.dashboard_style`, exports:
    - `useActiveLayout()` hook (from portal context)
    - `<LayoutSlot name="..." />` component
  - `classic/` `modern/` `minimal/` `premium/` — each folder exports slot components:
    - `Shell` (sidebar + header chrome)
    - `DashboardPage` (balance card, quick actions, recent tx)
    - `CardsPage`
    - `TransactionsList`, `TransactionRow`, `TransactionDetail`
    - `TransferPage`, `TransferSuccess`
    - `BeneficiariesPage`, `StatementsPage`, `NotificationsPage`, `SupportPage`, `ProfilePage`, `SettingsPage`
  - Classic re-exports the existing implementations verbatim (zero visual change).
- `src/lib/customer/portal-ui.tsx` (`PortalShell`) delegates chrome to `layout.Shell`.
- Portal route components (`$slug.portal.*.tsx`) render `<LayoutSlot name="dashboard" />` etc., passing the same data props they already fetch. All server-fn calls, loaders, and mutations stay put.

### 3. Admin selector
- In `src/routes/manage.banks.$id.tsx`, replace the current two-option `DashboardStylePanel` with a 4-tile picker (Classic / Modern / Minimal / Premium) showing a thumbnail + one-line description.
- Save path unchanged — writes `branding.dashboard_style` into draft + manifest via the existing save handler so it takes effect instantly with no rebuild.

### 4. Visual direction per layout
- **Classic** — current UI unchanged; default for existing banks.
- **Modern** — rounded 2xl cards, soft shadows, gradient balance card with copy-account + hide-balance, 3-col quick actions, floating rounded-icon sidebar, framer-motion fade/slide transitions.
- **Minimal** — white surface, thin `border-b` separators, oversized balance typography, generous whitespace, bordered transaction list, slim sidebar with small icons.
- **Premium** — dark `bg-neutral-950` base, gold (`oklch` warm) accents, animated gradient balance card, glassmorphism panels (`backdrop-blur`), luxury serif display font pair, dark glass sidebar with gold active state, card reveal/flip polished.

Colors continue to derive from `--tenant-primary`; gold/dark are semantic tokens scoped inside the premium layout only.

### 5. Receipts / PDFs
- `receipt-pdf.ts` untouched. Only the on-screen success/detail components differ by layout.

### 6. Files touched
- edit: `src/lib/bank-builder.types.ts`, `src/lib/rendering/types.ts`, `src/lib/rendering/manifest-builder.ts`, `src/lib/customer/portal-ui.tsx`, `src/routes/manage.banks.$id.tsx`, and each `src/routes/$slug.portal.*.tsx` (swap inline JSX for `<LayoutSlot>` — logic untouched).
- create: `src/lib/customer/layouts/{resolver.tsx, classic/*, modern/*, minimal/*, premium/*}`.

### 7. Guardrails
- No changes to: `cbe/*`, `customer/*.functions.ts`, `customer/session.server.ts`, `customer/receipt-pdf.ts`, `website/*`, `rendering/engine.ts`, router tree, DB schema.
- Typecheck must pass; classic layout output must be byte-equivalent to today.

## Acceptance
Admin can pick any of 4 layouts on any bank; customer sees the chosen theme across dashboard, cards, transactions, transfer, transfer-success, beneficiaries, statements, notifications, support, profile, settings; all transfers/receipts/restrictions still work; existing banks default to Classic.

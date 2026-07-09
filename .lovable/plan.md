
# Phase 6B – Banking Experience & Platform Enhancement

Scope: presentation + narrow supporting server-fn/schema changes only. Core Banking Engine, Financial Event Bus, Ledger, Auth, Website Generator, and tenant isolation stay untouched.

## 1. Professional PDF Bank Statements

- Replace CSV download on `banks.$slug.portal.statements.tsx` with **PDF-only** generation.
- Add `jspdf` + `jspdf-autotable` (client-side render, no server changes to CBE).
- Statement builder reads current manifest branding (logo, name, address, colors) + customer profile + accounts + ledger data (already returned by `generateStatementCsv` — reuse its data path; rename its return to include structured rows).
- Sections: header (logo, bank name/address), customer block (name, customer #, account #), period, currency, opening/closing balances, transactions table (date, description, reference, debit, credit, running balance), footer text with timestamp + page numbers.
- Remove "Print/Save PDF" HTML fallback and "Download CSV" button.

## 2. Global Live Chat Provider Manager

- Extend `gboc_platform_settings` table with columns for provider selection and per-provider config (JSON blob is fine).
- Update `platform-settings.functions.ts` schema (Zod) to include: `chat_provider` enum ('none'|'tawk'|'crisp'|'smartsupp'|'whatsapp'|'telegram'), `chat_config` JSONB with the provider-specific fields listed.
- Rewrite `gboc.communications.tsx` to expose provider selector + dynamic form for the chosen provider's fields, plus enable/disable toggle.
- Update tenant support surface (`banks.$slug.portal.support.tsx`) to read platform settings and render the active provider's widget/link (script injection for Tawk/Crisp/Smartsupp, deep-link buttons for WhatsApp/Telegram).
- Existing `live_chat_enabled` boolean stays as the master switch.

## 3. Transfer Module Refactor

`banks.$slug.portal.transfer.tsx`:

- Rename tabs: `own` → still "Own accounts"; `internal` → **Domestic Transfer**; `external` → **International Transfer**.
- Domestic: after account number entry (debounced), call a new lightweight server fn `lookupDomesticAccount` (adds nothing to CBE — only reads `bank_customer_accounts` + `bank_customers` scoped to current tenant) returning `{ account_name, account_type, customer_name }` or 404. Show green validation badge or red "Account number not found." Submit disabled until validated.
- International: expanded form fields (beneficiary name/address, bank name/address, IBAN, SWIFT/BIC, routing, sort code, transit, country, currency, amount, reason, reference). Submits through existing `submitTransfer` with `kind: 'external'`; extra fields packed into narration/beneficiary payload (no engine change).

## 4. Restriction Awareness

- Portal layout (`banks.$slug.portal.tsx`) already loads session; extend loader to also pull `bank_account_restrictions` for the customer's accounts.
- Add `RestrictionBanner` component rendered at top of every portal page when any restriction is active.
- Provide a `useRestrictions()` context helper. Transfer, Cards, Beneficiaries pages check it → disable submit button + tooltip + greyed styling when their feature is restricted. When GBOC lifts restriction, TanStack Query invalidation on next fetch removes the banner.

## 5. Branding Uploads

- Create Supabase storage bucket `bank-branding` (public) via migration.
- In `bank-builder.tsx` branding step: replace URL text inputs for logo/favicon/hero with file uploaders (`<input type="file">`), upload directly with `supabase.storage.from('bank-branding').upload(...)`, save returned public URL into draft's branding config.
- Show live preview thumbnail above each uploader.
- Keep the underlying URL fields in the config (upload just fills them) so downstream rendering keeps working unchanged.

## 6. Branding Preview

- Add "Preview" step/button in bank builder that opens a modal with tabbed previews:
  - Homepage (render `TenantSite` with draft manifest, first page)
  - Login/Registration (static mock using theme + logo)
  - Customer Dashboard (mock using `BrandedCard` + theme)
  - Sidebar (mock)
  - PDF header (render first page of statement PDF into an iframe blob)
  - Email header mock (HTML preview)
  - Favicon (image tag)
- Uses draft manifest built in-memory via existing `manifest-builder` helpers.

## 7. Validation

- After all edits: run `tsgo --noEmit`; fix errors.
- Manual click-through: statements → PDF opens; chat provider switch reflects on tenant portal; domestic transfer validates unknown/known accounts; international form accepts all fields; restriction toggled in GBOC shows banner on portal reload; uploads populate branding; preview modal renders each surface.

## Technical Notes

- New deps: `jspdf`, `jspdf-autotable`.
- New migration: add columns to `gboc_platform_settings` (`chat_provider text default 'none'`, `chat_config jsonb default '{}'::jsonb`); create storage bucket `bank-branding` + public-read policy + authenticated write policy.
- New server fn: `lookupDomesticAccount` in `src/lib/customer/transfers.functions.ts` (read-only, tenant-scoped).
- Extend portal loader (`portal.server.ts`) to include restrictions; expose via `useMatch` pattern already in use.
- No changes to CBE, Financial Event Bus, ledger writes, session logic, or website generator internals.

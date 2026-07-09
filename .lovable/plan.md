# Phase 6C – Enterprise Banking Platform Polish

Scope: usability, admin, realism, branding, and country banking standards. No changes to CBE, Financial Event Bus, Ledger, Website Rendering Engine internals, Auth, Multi-tenant architecture, or existing server-fn contracts (only additive).

## 1. Delete Bank
- Add `deleteBank` server fn (owner or GBOC admin). Removes: website registry row, published manifest, navigation, branding assets in `bank-branding` bucket, customer portal artefacts derived from the draft, rendering timeline entries for the bank. Keeps audit logs by default; accepts `purge_audit: boolean` flag for full purge (admin only).
- Add "Delete Bank" action with `AlertDialog` in `manage.banks.$id.tsx` and inside GBOC banks list.

## 2. Login Experience (all login/registration/security forms)
- After successful auth: show sonner toast "Welcome back" / "Login successful" then navigate.
- Add password-visibility eye toggle (`Eye`/`EyeOff`) on every password input: customer login, register, forgot/reset, platform PIN, security-center change-password, admin auth.
- Map errors from `supabase.auth` and customer-session server fns to friendly messages: bad password, unknown email, restricted, frozen, rate-limited, session expired, network/server. Wrap all `mutate` `onError` handlers.

## 3. Blueprint Library
- Replace coloured tiles in `bank-builder.tsx` blueprint step. Each card shows: mini homepage preview (rendered from blueprint theme+hero using existing `manifest-builder` helpers), flag emoji + country name, bank type badge, theme colour swatches, "Preview" (modal with full mock) and "Use Blueprint" buttons. Add search input and country/type filters.

## 4. Independent Branding
- Audit rendering pipeline: confirm every route/page consumes branding from the tenant's own manifest (`tenant-site.tsx`, `portal-ui.tsx`, statements PDF, emails). Remove any fallbacks that pull from a global default that could bleed across tenants; each tenant reads its own draft/manifest colours + logo + favicon + fonts and applies to browser title/icon via `head()` on tenant routes.

## 5. Platform PIN gate
- New `platform_pin` field in `gboc_platform_settings` (default `0499`, hashed). Server fns: `verifyPlatformPin`, `updatePlatformPin` (auth + admin, min 4 digits, returns success).
- Client: `PlatformPinGate` component wrapping admin surfaces (Blueprint Library, Bank Management, Products, GBOC root, Reports, Rendering, Platform Settings). PIN cached in sessionStorage after verify.
- Platform Settings → "Platform Security" card: reveal current PIN (admin-only server fn returning it), change/confirm/save with validation.

## 6. Rendering Timeline
- Add "Clear History" button + confirm dialog on rendering timeline page. Server fn deletes only rendering-timeline rows for tenant (or all, admin), never banks/customers/audit/manifests/ledger.

## 7. Branding Upload (already partly done in 6B)
- Ensure bank-builder branding step uses upload widgets for Logo, Favicon, Hero — with drag-drop, live preview thumbnail, and progress. Remove URL text inputs from primary flow (keep as "advanced" collapsible).

## 8. Professional PDF Statements
- Extend `statements` PDF generator: bank logo (fetched from branding URL), bank name+address, customer full name+number, account number (+ country identifier), statement period, opening/closing balances, per-row debit/credit/running balance/reference/timestamp, page numbers ("Page X of Y"), footer with bank name + generated timestamp + disclaimer. Branding inherited per tenant.

## 9. Global Live Chat (extend 6B)
- Extend chat_config schema to accept all listed fields per provider (Tawk direct link, Crisp chat link, Smartsupp chat link, WhatsApp business number/link/greeting, Telegram bot token/chat id/group link). Widget component already routes by provider — add fallback "Open Chat" link when script disabled.

## 10. Transfer Experience (extend 6B)
- Tabs already renamed. Ensure Domestic tab: enter account number → debounced `lookupDomesticAccount` → show "✓ Verified Customer: name / account type" badge, disable Submit until verified. International tab: full field set already exists; add Beneficiary Address, Bank Address, Transit Number if missing; pass through as narration metadata.

## 11. Restrictions UX
- `useRestrictions()` context (from 6B) is in place; extend to Cards, Statements, Withdrawals, Transfers pages: banner + disabled controls + tooltip explaining reason.

## 12. Country Banking Standards
- Extend `bank_customer_accounts` with nullable columns: `iban`, `swift_bic`, `routing_number`, `sort_code`, `bsb`, `transit_number`, `institution_number` (migration; existing `account_number` stays universal).
- Account-creation helper generates country-appropriate identifiers based on tenant country (NG 10-digit; US routing+acct; UK sort+acct; AU BSB+acct; CA institution+transit+acct; DE/FR/ES/IT IBAN+BIC).
- Portal account cards + International Transfer prefill display only fields relevant to the tenant's country. CBE keeps using `id`/`account_number` internally.

## 13. Validation
- `tsgo --noEmit` clean.
- Manual click-through: delete bank, login toasts+errors, password eye, blueprint previews, PIN gate + change, rendering clear, branding uploads, PDF, chat, transfers, restrictions, per-country identifiers.

## Technical Notes
- New server fns: `deleteBank`, `verifyPlatformPin`, `getPlatformPin` (admin), `updatePlatformPin`, `clearRenderingHistory`, country-account-format helpers.
- New migrations: add `platform_pin` (text, hashed with pgcrypto) to `gboc_platform_settings`; add country identifier columns to `bank_customer_accounts` with proper GRANTs preserved.
- No CBE / Ledger / Event Bus code touched. Auth flow untouched (only UX polish around inputs and toasts).

## Delivery
Given the breadth (12 functional parts + validation), I'll ship in one continuous implementation pass and report per-part status at the end.

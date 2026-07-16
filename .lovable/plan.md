# Bank Builder Integration & Branding Overhaul

Scope is large but presentation/config-only. No changes to CBE, transfer engine, sessions, ledger, receipts, balances, or security logic.

## 1. Dynamic Modules (sidebar, dashboard, routes)

- Add a single source of truth `src/lib/customer/module-registry.ts` mapping every module key → `{ label, icon, route, section, quickAction? }`. Keys align with existing `FEATURE_OPTIONS` and add: Loans, Investments, Fixed Deposits, Live Chat, Help Center, Mobile Banking, QR Payments, Bill Payments, Virtual Cards, Cheque Requests, Document Upload.
- Read enabled modules from `manifest.modules` (already resolved from `draft.features`) via existing tenant context.
- Rewrite `PortalShell` sidebar in `src/lib/customer/portal-ui.tsx` to render nav items from enabled modules only. Same for mobile bottom nav.
- Rewrite dashboard Quick Actions in `$slug.portal.index.tsx` to iterate over enabled modules that expose a `quickAction`; auto-reflow with `grid-cols-3`.
- Add a `<ModuleGate module="cards">` wrapper. Each existing `$slug.portal.<module>.tsx` route wraps its component with the gate. When disabled, render a friendly "Module Not Enabled" page (no redirect).

## 2. Sidebar Header

Replace "PREMIUM BANKING" with "ONLINE BANKING" everywhere in `portal-ui.tsx` and any layout variant that hardcodes it. Structure: logo, bank name, "ONLINE BANKING" caption.

## 3. Language System

- New file `src/lib/i18n/locales.ts`: array of ~40 supported locales (English default) with `{ code, label, nativeLabel }`.
- New file `src/lib/i18n/dictionaries/` with JSON dictionaries per locale. Ship full English + machine-authored translations for the fixed UI string set (dashboard, nav, buttons, forms, validation, cards, statements, transfers, profile, security, support, notifications, settings). Non-English dictionaries start as English fallbacks for any missing key, with real translations filled for the largest locales (fr, es, de, pt, it, nl, ja, zh-CN, ar, hi, ru, tr) — remaining locales get skeleton files that fall back per-key to English so nothing is machine-translated at runtime.
- New `useT()` hook + `<TenantI18nProvider>` reading `manifest.bank.language` (fallback "en").
- Bank Builder language step (`src/routes/bank-builder.tsx` step for identity): replace auto-set-from-country with a searchable `Combobox` (shadcn `Command` inside `Popover`) defaulting to English. Selecting a country no longer overwrites language.
- All customer portal routes and shared components swap hardcoded English strings for `t("key")`. Scope: strings currently rendered in `src/routes/$slug.portal.*.tsx`, `src/lib/customer/portal-ui.tsx`, `src/lib/customer/*.tsx` (chat widget, notification bell, transfer success, product gating).

## 4. Currency & Timezone

- New `src/lib/customer/tenant-format.ts` exporting `useTenantFormat()` returning `{ money(amount), date(ts), time(ts), datetime(ts) }` built from `manifest.bank.currency` + `manifest.bank.timezone` (Intl APIs).
- Replace ad-hoc `toLocaleString`, hardcoded currency, and `new Date().toLocaleString()` calls across portal routes and PDF receipt (`receipt-pdf.ts` accepts locale/currency/timezone args — data-only, engine unchanged).

## 5. De-Lovable Branding

Platform-wide:
- Generate a TheMixWeb wordmark via imagegen, upload via `lovable-assets`, write to `public/favicon.png` + `public/og-default.png` + `public/apple-touch-icon.png`.
- Delete `public/favicon.ico` (Lovable default).
- Update `src/routes/__root.tsx` head: title "TheMixWeb — Multi-Tenant Banking Platform", description "Create and manage professional digital banking experiences.", favicons, apple-touch, og:image absolute URL, twitter card.
- Update `public/site.webmanifest` (or create) with TheMixWeb name, icons, theme color.
- Grep-remove any remaining "Lovable" strings from user-visible source (keep in auto-generated files).

Tenant (customer-bank) pages:
- Existing per-tenant head is in `$slug.tsx` layout. Extend it to set title `<BankName>`, description `Secure online banking for <BankName> customers.`, favicon = branding logo (fallback platform), apple-touch = same, og:image = branding hero/logo.
- Login/register/forgot pages already served under `$slug.*` inherit tenant head automatically; verify `<link rel="icon">` is emitted per-tenant so Google Password Manager picks up the bank logo.

## 12. Files to touch

- Create: `src/lib/customer/module-registry.ts`, `src/lib/customer/module-gate.tsx`, `src/lib/i18n/{locales.ts,provider.tsx,use-t.ts,dictionaries/*.json}`, `src/lib/customer/tenant-format.ts`, `public/site.webmanifest`, `public/favicon.png`, `public/apple-touch-icon.png`, `public/og-default.png` (+ `.asset.json` pointers).
- Edit: `src/lib/customer/portal-ui.tsx`, `src/routes/__root.tsx`, `src/routes/$slug.tsx`, `src/routes/$slug.portal.index.tsx`, all `$slug.portal.*.tsx` route files (wrap with `ModuleGate`, swap strings/format), `src/routes/bank-builder.tsx` (language combobox, remove country→language coupling), `src/lib/customer/receipt-pdf.ts` (accept locale/currency/timezone, no engine change), `src/lib/rendering/manifest-builder.ts` (ensure language/currency/timezone flow through — already present).
- Delete: `public/favicon.ico`.

## 13. Guardrails

- No changes under `src/lib/cbe/`, `*.functions.ts` handlers, `session.server.ts`, `client.server.ts`, or DB migrations.
- Legacy drafts without language default to "en".
- Typecheck must pass; classic dashboards remain visually intact for existing banks.

## Realistic caveats

- Full professional translations for 40+ languages is not possible in one pass. Delivered: complete EN dictionary + hand-curated translations for the top ~12 locales; other locales ship as valid dictionaries that fall back per-key to English, so nothing renders as an untranslated key and no runtime machine translation is used. Additional locales can be filled in follow-up passes.
- OG image will be a clean TheMixWeb wordmark on brand background, not a photographic hero.

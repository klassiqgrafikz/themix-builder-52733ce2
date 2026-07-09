
# GBOC Professional Refactor Plan

This is a **UI/UX + workflow refactor**. No changes to Core Banking Engine, Financial Event Bus, Ledger, Auth, Customer Portal, Website Generator/Renderer, tenant isolation, or database schema. All actions continue to run through existing server functions (`gbocBalanceOperation`, `gbocAccountAction`, `gbocSetRestriction`, `gbocCreateTransaction`, `gbocListBanks`, `gbocListCustomers`, `gbocGetCustomer`, platform-settings, etc.).

## New GBOC layout & navigation

Replace flat sidebar (`Dashboard / Operations / Audit / Settings`) with grouped nav in `src/routes/gboc.tsx`:

- **Overview** — Dashboard
- **Tenants** — Banks (list + manage links into existing `/bank-builder` and `/manage/banks/$id`)
- **Customer Ops** — Customers, Operations Console, Transactions
- **Communications** — Notifications, Live Chat
- **Governance** — Audit Center, Reports
- **Platform** — Settings

Desktop: permanent sidebar. Mobile: drawer using existing shadcn `Sheet`. Top header keeps a **global search** (banks, customers, accounts, tx reference, email, phone) that pipes into existing `gbocListBanks` + `gbocListCustomers`.

## Dashboard (`gboc.index.tsx`) — rebuild

Stat tiles derived from existing queries:
- Total / Published / Draft Banks (from `gbocListBanks`)
- Active Customers, Total Accounts (aggregated from bank rows)
- Today's Transactions, Frozen Accounts, Pending Restrictions (compute client-side from a lightweight aggregate — reuse existing `gbocGetCustomer` data only for selected drilldowns; add nothing new server-side unless required)
- Notifications sent (from existing notifications table via existing functions), Live Chat status (from `platform-settings.functions.ts`)

Recent activity feed reuses audit entries from existing audit function.

If a stat requires data not exposed by an existing server function, it will render as "—" with a subtle "coming soon" hint rather than adding new backend surface. (Preserves the "no schema changes" rule.)

## Routes

Add / reorganize under `src/routes/`:

- `gboc.index.tsx` — new dashboard
- `gboc.banks.tsx` — bank list, grouped by published/draft, links to existing builder/manage
- `gboc.customers.tsx` — global customer search + filters (bank, status, country, account type), table with pagination (client-side over existing `gbocListCustomers`)
- `gboc.customers.$id.tsx` — full customer profile: tabs (Profile · Accounts · Cards · Beneficiaries · Transactions · Notifications · Restrictions · Security · Audit · Support). Quick-action bar (Add / Deduct / Freeze / Restrict / Clear / Notify / Reset Password) opens dialogs that call the existing operations server functions. All tabs use existing `gbocGetCustomer` result.
- `gboc.operations.tsx` — kept but simplified to a launcher: "pick bank → pick customer → open profile" (redirects to `gboc.customers.$id`). The unified workflow lives in the customer profile.
- `gboc.transactions.tsx` — transaction manager: search by reference/customer/account/bank/amount/status/date, filter presets (today/yesterday/7d/30d/custom). Reads from existing customer detail transactions aggregated per selected bank via existing functions.
- `gboc.notifications.tsx` — notification engine (broadcast / single / bank / platform) using existing notification insertion path exposed via operations functions.
- `gboc.communications.tsx` — live chat config (reuses `platform-settings.functions.ts`).
- `gboc.audit.tsx` — timeline audit view with filters (existing route, improved UI only).
- `gboc.reports.tsx` — report generator: customer, transactions, balance, audit, bank performance, daily activity. Client-side CSV export from existing queries; PDF/Excel labelled as CSV-only for now (no backend added).
- `gboc.settings.tsx` — platform settings (existing).

Any route lacking a matching backend endpoint uses only existing server functions — no new DB tables or server functions are added.

## Operations Console — unified

The unified workflow **is** the customer profile page (`gboc.customers.$id.tsx`). Balance Adder, Deductor, Clear, Freeze, Restriction, Transaction Manager, Notify — all live as Quick Actions + tabs on that single page, matching the requested workflow:

```text
Select Bank → Search Customer → Open Profile → Choose Action → Execute
```

The existing tab-based operations UI in `gboc.operations.tsx` is refactored into a shared `<CustomerOperationsPanel>` component reused by both the launcher and the customer profile page, so no logic is duplicated.

## Shared UI

- `src/components/gboc/app-shell.tsx` — sidebar + header + mobile drawer + global search.
- `src/components/gboc/customer-ops-panel.tsx` — extracted from current `gboc.operations.tsx` (balance, account actions, restrictions, transactions, history, notifications, audit tabs).
- `src/components/gboc/stat-card.tsx`, `activity-feed.tsx`, `bank-picker.tsx` — small presentational pieces.

## Explicit non-goals (to protect scope)

- No new DB tables, no schema migrations, no new server functions unless a UI page is unbuildable without one — and only after confirming with you.
- Reports export limited to CSV in this phase (PDF/Excel would require backend rendering).
- Global search runs client-side over already-fetched bank + customer lists; server-side full-text search is deferred.
- Virtual scrolling / server-side pagination is scaffolded (page size + paging UI) but backed by client-side paging over the existing list endpoints.
- Live Chat surface reflects whatever `platform-settings.functions.ts` already exposes; no new chat infrastructure.

## Technical notes

- All new routes are `createFileRoute("/gboc/...")` and register the header meta with `robots: noindex`.
- All actions use `useServerFn` + `useMutation`, invalidate `["gboc", ...]` keys on success.
- Dynamic tenant theming from Phase 5D (`--tenant-primary` etc.) is respected inside customer/bank views.
- Zero TypeScript errors; verified with the existing typecheck.

## Deliverable

A cleaner, grouped GBOC with a single customer-centric workflow, a real dashboard, dedicated Customers / Transactions / Notifications / Reports modules, and a global search — all wired to the existing backend without touching banking logic.

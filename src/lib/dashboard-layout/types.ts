// Shared shape for the Dashboard Layout Designer + Customer Portal renderer.
// Serialized to jsonb on `bb_bank_drafts.dashboard_layout` (published) and
// `bb_bank_drafts.dashboard_layout_draft` (in-progress).

export type DashboardComponentKind =
  | "header"
  | "account_summary"
  | "quick_actions"
  | "recent_transactions"
  | "balance_trend"
  | "exchange_rates"
  | "cards"
  | "beneficiaries"
  | "notifications"
  | "faq"
  | "support"
  // Layouts added later (Traditional / Multi-Account / Secure Tools / Rewards / Neo):
  | "account_carousel"
  | "promo_card"
  | "transfers_widget"
  | "account_accordions"
  | "search_bar"
  | "tabs";

export type WidthSize = "full" | "half" | "third";
export type ChartSize = "small" | "medium" | "large";

export type HeaderStyle = "welcome" | "photo" | "minimal" | "bar" | "rewards";
export type SummaryStyle = "minimal" | "modern" | "executive" | "compact" | "list" | "boxes" | "card_stack" | "solid" | "dropdown";
export type QuickActionsColumns = 2 | 3 | 4;
export type QuickActionsOrientation = "grid" | "horizontal" | "tiles" | "pills" | "squares" | "circle";

export type DashboardPropValue = string | number | boolean | null;

export type DashboardLayoutItem = {
  id: string;
  kind: DashboardComponentKind;
  width?: WidthSize;
  visible?: boolean;
  locked?: boolean;
  // Optional two-column placement. When any item carries a `column`, the
  // composer renders left/right stacks instead of the flat width grid.
  column?: "left" | "right";
  // Optional tab membership: items with a `tab` render inside the matching
  // pane of a `tabs` section instead of at top level.
  tab?: string;
  // Free-form per-component props. Renderer picks the ones it recognizes.
  props?: { [key: string]: DashboardPropValue | undefined };
};

export type DashboardLayout = {
  version: 1;
  items: DashboardLayoutItem[];
  updated_at: string;
};

// Portal layouts selectable in the Bank Builder. `sidebar` is the classic
// shell; the rest were added for the 2026 dashboard refresh.
export type PortalLayoutKey =
  | "sidebar"
  | "traditional"
  | "multi_account"
  | "secure_tools"
  | "rewards"
  | "neo";

const FULL_NAV: string[] = [
  "dashboard","accounts","transfer","beneficiaries","transactions",
  "cards","statements","support","security","profile",
];

export type LayoutDefinition = {
  shell_variant: PortalLayoutKey;
  nav_items: string[];
  dashboard_layout: DashboardLayout;
};

export function getLayoutDefinition(key: PortalLayoutKey): LayoutDefinition {
  switch (key) {
    case "traditional":
      return {
        shell_variant: "traditional",
        nav_items: FULL_NAV,
        dashboard_layout: {
          version: 1,
          updated_at: new Date().toISOString(),
          items: [
            { id: "accts", kind: "account_carousel", width: "full", visible: true },
            { id: "actions", kind: "quick_actions", width: "full", visible: true, props: { orientation: "squares", columns: 5 } },
            { id: "tx", kind: "recent_transactions", width: "full", visible: true, props: { style: "table", searchable: true }, column: "left" },
            { id: "promo", kind: "promo_card", width: "full", visible: true, column: "right" },
            { id: "transfers", kind: "transfers_widget", width: "full", visible: true, column: "right" },
          ],
        },
      };
    case "multi_account":
      return {
        shell_variant: "multi_account",
        nav_items: FULL_NAV,
        dashboard_layout: {
          version: 1,
          updated_at: new Date().toISOString(),
          items: [
            { id: "summary", kind: "account_summary", width: "full", visible: true, props: { style: "dropdown" } },
            { id: "tabs", kind: "tabs", width: "full", visible: true, props: { account_label: "Accounts", cards_label: "Cards" } },
            { id: "acc", kind: "account_accordions", width: "full", visible: true, props: { group: "accounts", show_routing: true }, tab: "accounts" },
            { id: "crd", kind: "account_accordions", width: "full", visible: true, props: { group: "cards" }, tab: "cards" },
          ],
        },
      };
    case "secure_tools":
      return {
        shell_variant: "secure_tools",
        nav_items: FULL_NAV,
        dashboard_layout: {
          version: 1,
          updated_at: new Date().toISOString(),
          items: [
            { id: "header", kind: "header", width: "full", visible: true, props: { style: "welcome" } },
            { id: "summary", kind: "account_summary", width: "full", visible: true, props: { style: "solid" } },
            { id: "actions", kind: "quick_actions", width: "full", visible: true, props: { orientation: "pills", columns: 3 } },
            { id: "tx", kind: "recent_transactions", width: "full", visible: true, props: { style: "table", variant: "compact" } },
          ],
        },
      };
    case "rewards":
      return {
        shell_variant: "rewards",
        nav_items: FULL_NAV,
        dashboard_layout: {
          version: 1,
          updated_at: new Date().toISOString(),
          items: [
            { id: "header", kind: "header", width: "full", visible: true, props: { style: "rewards" } },
            { id: "search", kind: "search_bar", width: "full", visible: true, props: { placeholder: "How can we help?" } },
            { id: "acc", kind: "account_accordions", width: "full", visible: true, props: { group: "accounts", show_routing: false } },
            { id: "crd", kind: "account_accordions", width: "full", visible: true, props: { group: "cards" } },
          ],
        },
      };
    case "neo":
      return {
        shell_variant: "neo",
        nav_items: FULL_NAV,
        dashboard_layout: {
          version: 1,
          updated_at: new Date().toISOString(),
          items: [
            { id: "summary", kind: "account_summary", width: "full", visible: true, props: { style: "modern" } },
            { id: "deck", kind: "account_summary", width: "full", visible: true, props: { style: "card_stack", card_variant: "wave" } },
            { id: "search", kind: "search_bar", width: "full", visible: true, props: { placeholder: "Search transactions" } },
            { id: "actions", kind: "quick_actions", width: "full", visible: true, props: { orientation: "circle", columns: 4 } },
            { id: "tx", kind: "recent_transactions", width: "full", visible: true, props: { relative_time: true } },
          ],
        },
      };
    case "sidebar":
    default:
      return {
        shell_variant: "sidebar",
        nav_items: FULL_NAV,
        dashboard_layout: defaultDashboardLayout(),
      };
  }
}

export function getDashboardLayoutForKey(key?: PortalLayoutKey | null): DashboardLayout {
  return getLayoutDefinition(key ?? "sidebar").dashboard_layout;
}

/** Map any stored key (including removed legacy keys) to a valid layout key. */
export function normalizePortalLayoutKey(v: unknown): PortalLayoutKey {
  const s = String(v ?? "").toLowerCase();
  switch (s) {
    case "sidebar": return "sidebar";
    case "traditional": return "traditional";
    case "multi_account": return "multi_account";
    case "secure_tools": return "secure_tools";
    case "rewards": return "rewards";
    case "neo": return "neo";
    // Removed legacy layouts → closest current design.
    case "topnav": return "traditional";
    case "ledger": return "multi_account";
    case "minimal": return "secure_tools";
    case "premium": return "rewards";
    case "card_deck": return "neo";
    case "floating": return "neo";
    case "console": return "sidebar";
    default: return "sidebar";
  }
}

export function defaultDashboardLayout(): DashboardLayout {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    items: [
      { id: "header", kind: "header", width: "full", visible: true, props: { style: "welcome", alignment: "left", typography: "lg" } },
      { id: "account_summary", kind: "account_summary", width: "full", visible: true, props: { style: "minimal" } },
      { id: "quick_actions", kind: "quick_actions", width: "full", visible: true, props: { columns: 3, orientation: "grid" } },
      { id: "balance_trend", kind: "balance_trend", width: "half", visible: true, props: { chart_size: "medium" } },
      { id: "exchange_rates", kind: "exchange_rates", width: "half", visible: true },
      { id: "recent_transactions", kind: "recent_transactions", width: "full", visible: true },
      { id: "cards", kind: "cards", width: "half", visible: true },
      { id: "beneficiaries", kind: "beneficiaries", width: "half", visible: true },
      { id: "notifications", kind: "notifications", width: "full", visible: false },
      { id: "faq", kind: "faq", width: "full", visible: true },
      { id: "support", kind: "support", width: "full", visible: false },
    ],
  };
}

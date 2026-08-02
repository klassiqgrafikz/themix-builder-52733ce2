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
  | "support";

export type WidthSize = "full" | "half" | "third";
export type ChartSize = "small" | "medium" | "large";

export type HeaderStyle = "welcome" | "photo" | "minimal" | "bar";
export type SummaryStyle = "minimal" | "modern" | "executive" | "compact" | "list" | "boxes" | "card_stack";
export type QuickActionsColumns = 2 | 3 | 4;
export type QuickActionsOrientation = "grid" | "horizontal" | "tiles";

export type DashboardPropValue = string | number | boolean | null;

export type DashboardLayoutItem = {
  id: string;
  kind: DashboardComponentKind;
  width?: WidthSize;
  visible?: boolean;
  locked?: boolean;
  // Free-form per-component props. Renderer picks the ones it recognizes.
  props?: { [key: string]: DashboardPropValue | undefined };
};

export type DashboardLayout = {
  version: 1;
  items: DashboardLayoutItem[];
  updated_at: string;
};

// Sidebar is the only portal layout. Older keys (topnav/premium/minimal/
// floating/console/ledger/card_deck) were removed; stored manifests that
// still carry them fall back to the sidebar shell.
export type PortalLayoutKey = "sidebar";

export type LayoutDefinition = {
  shell_variant: PortalLayoutKey;
  nav_items: string[];
  dashboard_layout: DashboardLayout;
};

export function getLayoutDefinition(_key: PortalLayoutKey): LayoutDefinition {
  const full: string[] = [
    "dashboard","accounts","transfer","beneficiaries","transactions",
    "cards","statements","support","security","profile",
  ];
  return {
    shell_variant: "sidebar",
    nav_items: full,
    dashboard_layout: defaultDashboardLayout(),
  };
}

export function getDashboardLayoutForKey(key?: PortalLayoutKey | null): DashboardLayout {
  return getLayoutDefinition(key ?? "sidebar").dashboard_layout;
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

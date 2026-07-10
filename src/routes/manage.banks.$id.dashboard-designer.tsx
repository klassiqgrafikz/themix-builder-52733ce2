import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getDraft } from "@/lib/bank-builder.functions";
import type { BankBranding, BankDraft, BankIdentity } from "@/lib/bank-builder.types";
import { PlatformPinGate } from "@/components/platform/pin-gate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, Save, Eye, RotateCcw,
  LayoutDashboard, Wallet, Zap, Receipt, TrendingUp, Globe2,
  CreditCard, Users, Bell, HelpCircle, LifeBuoy, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/manage/banks/$id/dashboard-designer")({
  head: () => ({
    meta: [
      { title: "Dashboard Layout Designer — TheMixWeb" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignerPage,
});

function DesignerPage() {
  return (
    <PlatformPinGate area="Dashboard Layout Designer">
      <Designer />
    </PlatformPinGate>
  );
}

/* --------------------------------- Types --------------------------------- */

type ComponentKind =
  | "header" | "account_summary" | "quick_actions" | "recent_transactions"
  | "balance_trend" | "exchange_rates" | "cards" | "beneficiaries"
  | "notifications" | "faq" | "support";

type BaseProps = { visible?: boolean };

type HeaderProps = BaseProps & { alignment?: "left" | "center" | "right"; typography?: "sm" | "md" | "lg" | "xl" };
type SummaryProps = BaseProps & {
  divider_thickness?: number; divider_color?: string; padding?: number;
  density?: "compact" | "standard"; copy_button?: boolean; hide_balance_button?: boolean;
};
type QuickActionProps = BaseProps & {
  columns?: 2 | 3 | 4; orientation?: "grid" | "horizontal";
  icon_size?: number; show_labels?: boolean;
};
type GenericProps = BaseProps & { padding?: number };

type PropsByKind = {
  header: HeaderProps;
  account_summary: SummaryProps;
  quick_actions: QuickActionProps;
  recent_transactions: GenericProps;
  balance_trend: GenericProps;
  exchange_rates: GenericProps;
  cards: GenericProps;
  beneficiaries: GenericProps;
  notifications: GenericProps;
  faq: GenericProps;
  support: GenericProps;
};

type CanvasItem<K extends ComponentKind = ComponentKind> = {
  id: string; kind: K; props: PropsByKind[K];
};

type LayoutDraft = { version: 1; items: CanvasItem[]; updated_at: string };

const COMPONENT_META: Record<ComponentKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  header:              { label: "Header",              icon: LayoutDashboard },
  account_summary:     { label: "Account Summary",    icon: Wallet },
  quick_actions:       { label: "Quick Actions",      icon: Zap },
  recent_transactions: { label: "Recent Transactions",icon: Receipt },
  balance_trend:       { label: "Balance Trend",      icon: TrendingUp },
  exchange_rates:      { label: "Exchange Rates",     icon: Globe2 },
  cards:               { label: "Cards",              icon: CreditCard },
  beneficiaries:       { label: "Beneficiaries",      icon: Users },
  notifications:       { label: "Notifications",      icon: Bell },
  faq:                 { label: "FAQ",                icon: HelpCircle },
  support:             { label: "Support",            icon: LifeBuoy },
};

const DEFAULTS: { [K in ComponentKind]: PropsByKind[K] } = {
  header: { visible: true, alignment: "left", typography: "lg" },
  account_summary: {
    visible: true, divider_thickness: 2, divider_color: "", padding: 16,
    density: "standard", copy_button: true, hide_balance_button: true,
  },
  quick_actions: { visible: true, columns: 3, orientation: "grid", icon_size: 20, show_labels: true },
  recent_transactions: { visible: true, padding: 16 },
  balance_trend:       { visible: true, padding: 16 },
  exchange_rates:      { visible: true, padding: 16 },
  cards:               { visible: true, padding: 16 },
  beneficiaries:       { visible: true, padding: 16 },
  notifications:       { visible: true, padding: 16 },
  faq:                 { visible: true, padding: 16 },
  support:             { visible: true, padding: 16 },
};

function defaultLayout(): LayoutDraft {
  const items: CanvasItem[] = [
    { id: uid(), kind: "header",              props: { ...DEFAULTS.header } },
    { id: uid(), kind: "account_summary",     props: { ...DEFAULTS.account_summary } },
    { id: uid(), kind: "quick_actions",       props: { ...DEFAULTS.quick_actions } },
    { id: uid(), kind: "recent_transactions", props: { ...DEFAULTS.recent_transactions } },
  ];
  return { version: 1, items, updated_at: new Date().toISOString() };
}

function uid() { return Math.random().toString(36).slice(2, 10); }
function storageKey(id: string) { return `themix.dashboard-designer.${id}`; }

function loadDraft(id: string): LayoutDraft {
  if (typeof window === "undefined") return defaultLayout();
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return defaultLayout();
    const parsed = JSON.parse(raw) as LayoutDraft;
    if (!parsed?.items) return defaultLayout();
    return parsed;
  } catch { return defaultLayout(); }
}

/* --------------------------------- Shell --------------------------------- */

function Designer() {
  const { id } = useParams({ from: "/manage/banks/$id/dashboard-designer" });
  const navigate = useNavigate();
  const getDraftFn = useServerFn(getDraft);
  const draftQ = useQuery({ queryKey: ["bb-draft", id], queryFn: () => getDraftFn({ data: { id } }) });
  const draft = draftQ.data as BankDraft | undefined;

  const [layout, setLayout] = useState<LayoutDraft>(() => loadDraft(id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);

  const selected = layout.items.find((i) => i.id === selectedId) ?? null;

  const identity = (draft?.identity ?? {}) as Partial<BankIdentity>;
  const branding = (draft?.branding ?? {}) as Partial<BankBranding>;
  const primary   = branding.primary_color   ?? "#0a2540";
  const secondary = branding.secondary_color ?? "#1e88e5";
  const accent    = branding.accent_color    ?? "#00c48c";
  const fontHeading = branding.font_heading ?? "Inter";
  const fontBody    = branding.font_body    ?? "Inter";

  function updateItem(idToUpdate: string, patch: Partial<CanvasItem["props"]>) {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idToUpdate ? ({ ...it, props: { ...it.props, ...patch } } as CanvasItem) : it,
      ),
    }));
  }
  function addComponent(kind: ComponentKind) {
    setLayout((l) => ({ ...l, items: [...l.items, { id: uid(), kind, props: { ...DEFAULTS[kind] } } as CanvasItem] }));
  }
  function removeItem(idToRemove: string) {
    setLayout((l) => ({ ...l, items: l.items.filter((i) => i.id !== idToRemove) }));
    if (selectedId === idToRemove) setSelectedId(null);
  }
  function move(idToMove: string, dir: -1 | 1) {
    setLayout((l) => {
      const idx = l.items.findIndex((i) => i.id === idToMove);
      if (idx < 0) return l;
      const j = idx + dir;
      if (j < 0 || j >= l.items.length) return l;
      const next = l.items.slice();
      const [it] = next.splice(idx, 1);
      next.splice(j, 0, it);
      return { ...l, items: next };
    });
  }

  function saveDraft() {
    const payload = { ...layout, updated_at: new Date().toISOString() };
    try {
      window.localStorage.setItem(storageKey(id), JSON.stringify(payload));
      setLayout(payload);
      toast.success("Layout draft saved");
    } catch {
      toast.error("Could not save draft");
    }
  }
  function resetLayout() {
    const d = defaultLayout();
    setLayout(d);
    setSelectedId(null);
    toast.message("Layout reset to defaults");
  }

  // Drag-and-drop from palette
  function onCanvasDrop(e: React.DragEvent) {
    e.preventDefault();
    const kind = e.dataTransfer.getData("text/x-component") as ComponentKind;
    if (kind && COMPONENT_META[kind]) addComponent(kind);
  }

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* Toolbar */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/manage/banks/$id", params: { id } })}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">Dashboard Layout Designer</div>
            <div className="truncate text-sm font-semibold">{identity.bank_name || "Untitled bank"} ⭐</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={resetLayout}><RotateCcw className="mr-1 h-4 w-4" /> Reset</Button>
            <Button variant="outline" size="sm" onClick={() => { setPreviewNonce((n) => n + 1); toast.success("Preview refreshed"); }}>
              <Eye className="mr-1 h-4 w-4" /> Preview
            </Button>
            <Button size="sm" onClick={saveDraft}><Save className="mr-1 h-4 w-4" /> Save Draft</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        {/* Left: Components */}
        <aside className="border-r bg-background overflow-y-auto">
          <div className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Components</div>
          <div className="space-y-1 px-2 pb-4">
            {(Object.keys(COMPONENT_META) as ComponentKind[]).map((kind) => {
              const Icon = COMPONENT_META[kind].icon;
              return (
                <div
                  key={kind}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/x-component", kind)}
                  onDoubleClick={() => addComponent(kind)}
                  className="flex cursor-grab items-center gap-2 rounded-md border bg-background px-2 py-2 text-sm hover:bg-muted active:cursor-grabbing"
                  title="Drag onto the canvas or double-click"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{COMPONENT_META[kind].label}</span>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Center: Canvas */}
        <section
          className="min-w-0 overflow-y-auto p-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onCanvasDrop}
          key={previewNonce}
        >
          <div
            className="mx-auto max-w-3xl rounded-xl border bg-background p-6 shadow-sm"
            style={{ fontFamily: fontBody }}
          >
            {layout.items.length === 0 && (
              <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                Drag components from the left to start designing.
              </div>
            )}
            {layout.items.map((it, idx) => (
              <div
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={cn(
                  "group relative rounded-lg p-1 transition",
                  selectedId === it.id ? "ring-2 ring-offset-2" : "hover:bg-muted/40",
                )}
                style={selectedId === it.id ? { boxShadow: `0 0 0 2px ${primary}` } : undefined}
              >
                <div className="pointer-events-none absolute -top-2 left-2 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground group-hover:block">
                  {COMPONENT_META[it.kind].label}
                </div>
                <div className="absolute right-2 top-2 z-10 hidden gap-1 group-hover:flex">
                  <button className="rounded border bg-background px-1 text-xs" onClick={(e) => { e.stopPropagation(); move(it.id, -1); }} disabled={idx === 0}>↑</button>
                  <button className="rounded border bg-background px-1 text-xs" onClick={(e) => { e.stopPropagation(); move(it.id, 1); }} disabled={idx === layout.items.length - 1}>↓</button>
                  <button className="rounded border bg-background px-1 text-xs text-destructive" onClick={(e) => { e.stopPropagation(); removeItem(it.id); }}>×</button>
                </div>
                <RenderPreview
                  item={it}
                  colors={{ primary, secondary, accent }}
                  fontHeading={fontHeading}
                  bankName={identity.bank_name || "Sample Bank"}
                  currency={identity.currency || "USD"}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Right: Properties */}
        <aside className="border-l bg-background overflow-y-auto">
          <div className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Properties</div>
          <div className="px-3 pb-6">
            {!selected ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                Select a component on the canvas to edit its properties.
              </div>
            ) : (
              <PropertiesPanel
                item={selected}
                onChange={(patch) => updateItem(selected.id, patch)}
                brandPrimary={primary}
              />
            )}
          </div>
          <div className="border-t p-3">
            <Link
              to="/manage/banks/$id"
              params={{ id }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ← Back to bank overview
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------- Properties ------------------------------ */

function PropertiesPanel({
  item, onChange, brandPrimary,
}: { item: CanvasItem; onChange: (patch: Partial<CanvasItem["props"]>) => void; brandPrimary: string }) {
  const meta = COMPONENT_META[item.kind];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <meta.icon className="h-4 w-4" />
        <div className="text-sm font-semibold">{meta.label}</div>
      </div>

      <Row label="Visible">
        <Switch
          checked={item.props.visible !== false}
          onCheckedChange={(v) => onChange({ visible: v } as Partial<CanvasItem["props"]>)}
        />
      </Row>

      {item.kind === "header" && (
        <HeaderProps item={item as CanvasItem<"header">} onChange={onChange as (p: Partial<HeaderProps>) => void} />
      )}
      {item.kind === "account_summary" && (
        <SummaryPropsPanel
          item={item as CanvasItem<"account_summary">}
          onChange={onChange as (p: Partial<SummaryProps>) => void}
          brandPrimary={brandPrimary}
        />
      )}
      {item.kind === "quick_actions" && (
        <QuickActionsProps item={item as CanvasItem<"quick_actions">} onChange={onChange as (p: Partial<QuickActionProps>) => void} />
      )}
      {["recent_transactions","balance_trend","exchange_rates","cards","beneficiaries","notifications","faq","support"].includes(item.kind) && (
        <GenericPropsPanel item={item as CanvasItem<"recent_transactions">} onChange={onChange as (p: Partial<GenericProps>) => void} />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div>{children}</div>
    </div>
  );
}

function HeaderProps({ item, onChange }: { item: CanvasItem<"header">; onChange: (p: Partial<HeaderProps>) => void }) {
  return (
    <>
      <Row label="Alignment">
        <Select value={item.props.alignment ?? "left"} onValueChange={(v) => onChange({ alignment: v as HeaderProps["alignment"] })}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Typography">
        <Select value={item.props.typography ?? "lg"} onValueChange={(v) => onChange({ typography: v as HeaderProps["typography"] })}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small</SelectItem>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
            <SelectItem value="xl">Extra large</SelectItem>
          </SelectContent>
        </Select>
      </Row>
    </>
  );
}

function SummaryPropsPanel({
  item, onChange, brandPrimary,
}: { item: CanvasItem<"account_summary">; onChange: (p: Partial<SummaryProps>) => void; brandPrimary: string }) {
  const p = item.props;
  return (
    <>
      <Row label="Density">
        <Select value={p.density ?? "standard"} onValueChange={(v) => onChange({ density: v as SummaryProps["density"] })}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="compact">Compact</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <div>
        <Label className="text-xs text-muted-foreground">Divider thickness ({p.divider_thickness ?? 2}px)</Label>
        <Slider className="mt-2" min={1} max={8} step={1}
          value={[p.divider_thickness ?? 2]}
          onValueChange={([v]) => onChange({ divider_thickness: v })}
        />
      </div>
      <Row label="Divider color">
        <Input type="color" className="h-8 w-14 p-0"
          value={p.divider_color || brandPrimary}
          onChange={(e) => onChange({ divider_color: e.target.value })}
        />
      </Row>
      <div>
        <Label className="text-xs text-muted-foreground">Padding ({p.padding ?? 16}px)</Label>
        <Slider className="mt-2" min={0} max={48} step={2}
          value={[p.padding ?? 16]}
          onValueChange={([v]) => onChange({ padding: v })}
        />
      </div>
      <Row label="Copy button">
        <Switch checked={p.copy_button !== false} onCheckedChange={(v) => onChange({ copy_button: v })} />
      </Row>
      <Row label="Hide-balance button">
        <Switch checked={p.hide_balance_button !== false} onCheckedChange={(v) => onChange({ hide_balance_button: v })} />
      </Row>
    </>
  );
}

function QuickActionsProps({ item, onChange }: { item: CanvasItem<"quick_actions">; onChange: (p: Partial<QuickActionProps>) => void }) {
  const p = item.props;
  return (
    <>
      <Row label="Columns">
        <Select value={String(p.columns ?? 3)} onValueChange={(v) => onChange({ columns: Number(v) as QuickActionProps["columns"] })}>
          <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="2">2</SelectItem>
            <SelectItem value="3">3</SelectItem>
            <SelectItem value="4">4</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <Row label="Orientation">
        <Select value={p.orientation ?? "grid"} onValueChange={(v) => onChange({ orientation: v as QuickActionProps["orientation"] })}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="grid">Grid</SelectItem>
            <SelectItem value="horizontal">Horizontal</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <div>
        <Label className="text-xs text-muted-foreground">Icon size ({p.icon_size ?? 20}px)</Label>
        <Slider className="mt-2" min={14} max={32} step={1}
          value={[p.icon_size ?? 20]}
          onValueChange={([v]) => onChange({ icon_size: v })}
        />
      </div>
      <Row label="Show labels">
        <Switch checked={p.show_labels !== false} onCheckedChange={(v) => onChange({ show_labels: v })} />
      </Row>
    </>
  );
}

function GenericPropsPanel({ item, onChange }: { item: CanvasItem<"recent_transactions">; onChange: (p: Partial<GenericProps>) => void }) {
  const p = item.props;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">Padding ({p.padding ?? 16}px)</Label>
      <Slider className="mt-2" min={0} max={48} step={2}
        value={[p.padding ?? 16]}
        onValueChange={([v]) => onChange({ padding: v })}
      />
    </div>
  );
}

/* -------------------------- Sample preview blocks ------------------------ */

const SAMPLE = {
  first_name: "Alex",
  last_name: "Morgan",
  customer_number: "CB-000-1042",
  balance: 12480.55,
  account_number: "0044 8813 5527 9910",
  txns: [
    { title: "Grocery Store",   amount: -54.20, when: "Today" },
    { title: "Salary — ACME",   amount: 3200.00, when: "Yesterday" },
    { title: "Electricity Bill", amount: -128.75, when: "Mon" },
  ],
  rates: [
    { pair: "EUR/USD", value: 1.084 },
    { pair: "GBP/USD", value: 1.271 },
    { pair: "USD/JPY", value: 156.12 },
  ],
};

function RenderPreview({
  item, colors, fontHeading, bankName, currency,
}: {
  item: CanvasItem;
  colors: { primary: string; secondary: string; accent: string };
  fontHeading: string;
  bankName: string;
  currency: string;
}) {
  if (item.props.visible === false) {
    return <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">{COMPONENT_META[item.kind].label} — hidden</div>;
  }
  switch (item.kind) {
    case "header": {
      const p = item.props as HeaderProps;
      const size = { sm: "text-base", md: "text-lg", lg: "text-2xl", xl: "text-3xl" }[p.typography ?? "lg"];
      const align = { left: "text-left", center: "text-center", right: "text-right" }[p.alignment ?? "left"];
      return (
        <div className={cn("py-3", align)} style={{ fontFamily: fontHeading, color: colors.primary }}>
          <div className={cn("font-bold", size)}>{bankName}</div>
          <div className="text-xs opacity-70">Online Banking</div>
        </div>
      );
    }
    case "account_summary": {
      const p = item.props as SummaryProps;
      const dividerColor = p.divider_color || colors.primary;
      const thick = p.divider_thickness ?? 2;
      return (
        <div style={{ padding: p.padding ?? 16 }}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs opacity-70">Good afternoon,</div>
              <div className="truncate text-lg font-semibold" style={{ color: colors.primary, fontFamily: fontHeading }}>
                {SAMPLE.first_name} {SAMPLE.last_name}
              </div>
              <div className="text-xs opacity-70">{SAMPLE.customer_number}</div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}>Active</span>
          </div>
          <div className="my-3" style={{ borderTop: `${thick}px solid ${dividerColor}` }} />
          <div className={cn("grid gap-3", p.density === "compact" ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
            <div>
              <div className="text-xs opacity-70">Available balance</div>
              <div className="text-2xl font-bold tabular-nums" style={{ color: colors.primary }}>
                {currency} {SAMPLE.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              {p.hide_balance_button && <button className="mt-1 text-xs underline opacity-70">Hide balance</button>}
            </div>
            <div>
              <div className="text-xs opacity-70">Account number</div>
              <div className="font-mono text-sm">{SAMPLE.account_number}</div>
              {p.copy_button && <button className="mt-1 text-xs underline opacity-70">Copy</button>}
            </div>
          </div>
          <div className="mt-3" style={{ borderTop: `${thick}px solid ${dividerColor}` }} />
        </div>
      );
    }
    case "quick_actions": {
      const p = item.props as QuickActionProps;
      const actions = ["Transfer", "Pay", "Cards", "Statements", "Beneficiaries", "Support"];
      const cols = p.orientation === "horizontal" ? "flex flex-wrap gap-2" : `grid gap-3 grid-cols-${p.columns ?? 3}`;
      return (
        <div className="py-3">
          <div className={cols}>
            {actions.map((a) => (
              <div key={a} className="flex flex-col items-center gap-1 rounded-md border p-3 text-center">
                <div className="grid place-items-center rounded-full" style={{
                  width: (p.icon_size ?? 20) + 16, height: (p.icon_size ?? 20) + 16,
                  backgroundColor: `${colors.primary}12`, color: colors.primary,
                }}>
                  <Zap style={{ width: p.icon_size ?? 20, height: p.icon_size ?? 20 }} />
                </div>
                {(p.show_labels !== false) && <div className="text-xs">{a}</div>}
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "recent_transactions":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Recent transactions</div>
          <ul className="divide-y">
            {SAMPLE.txns.map((t, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div>{t.title}</div>
                  <div className="text-xs opacity-60">{t.when}</div>
                </div>
                <div className={cn("tabular-nums", t.amount < 0 ? "text-red-600" : "text-emerald-600")}>
                  {t.amount < 0 ? "−" : "+"}{currency} {Math.abs(t.amount).toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      );
    case "balance_trend":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Balance trend</div>
          <svg viewBox="0 0 200 60" className="h-16 w-full">
            <polyline fill="none" strokeWidth="2" stroke={colors.primary}
              points="0,40 20,32 40,36 60,20 80,28 100,18 120,22 140,10 160,16 180,8 200,12" />
          </svg>
        </div>
      );
    case "exchange_rates":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Exchange rates</div>
          <ul className="grid grid-cols-3 gap-2 text-center text-xs">
            {SAMPLE.rates.map((r) => (
              <li key={r.pair} className="rounded border py-2">
                <div className="font-medium">{r.pair}</div>
                <div className="tabular-nums opacity-80">{r.value.toFixed(3)}</div>
              </li>
            ))}
          </ul>
        </div>
      );
    case "cards":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Cards</div>
          <div className="flex h-24 items-end justify-between rounded-xl p-3 text-white"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
            <div className="text-xs">•••• 4421</div>
            <div className="text-xs">{SAMPLE.first_name}</div>
          </div>
        </div>
      );
    case "beneficiaries":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Beneficiaries</div>
          <div className="flex gap-3 text-xs">
            {["JD","MP","AK"].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="grid h-10 w-10 place-items-center rounded-full text-white" style={{ backgroundColor: colors.secondary }}>{i}</div>
                <div className="mt-1 opacity-70">{i}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "notifications":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Notifications</div>
          <ul className="space-y-1 text-sm">
            <li>New card shipped</li>
            <li>Statement ready</li>
          </ul>
        </div>
      );
    case "faq":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>FAQ</div>
          <div className="text-xs opacity-80">Answers to common questions about your account.</div>
        </div>
      );
    case "support":
      return (
        <div style={{ padding: (item.props as GenericProps).padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Support</div>
          <div className="text-xs opacity-80">Chat with an agent or submit a ticket.</div>
        </div>
      );
    default:
      return null;
  }
}

// Silence unused var lints from initial defaults reference
void useMemo;

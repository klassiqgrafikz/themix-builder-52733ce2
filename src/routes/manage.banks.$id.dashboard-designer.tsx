import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ArrowLeft, Save, Eye, RotateCcw, Undo2, Redo2,
  LayoutDashboard, Wallet, Zap, Receipt, TrendingUp, Globe2,
  CreditCard, Users, Bell, HelpCircle, LifeBuoy, GripVertical,
  Monitor, Tablet, Smartphone, ChevronDown, ChevronRight,
  EyeOff, Lock, Unlock, Copy, Trash2,
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

type WidthSize = "full" | "half" | "third";
type ChartSize = "small" | "medium" | "large";

type BaseProps = { visible?: boolean; locked?: boolean; width?: WidthSize };

type HeaderProps = BaseProps & { alignment?: "left" | "center" | "right"; typography?: "sm" | "md" | "lg" | "xl" };
type SummaryProps = BaseProps & {
  divider_thickness?: number; divider_color?: string; padding?: number;
  density?: "compact" | "standard"; copy_button?: boolean; hide_balance_button?: boolean;
};
type QuickActionProps = BaseProps & {
  columns?: 2 | 3 | 4; orientation?: "grid" | "horizontal";
  icon_size?: number; show_labels?: boolean;
};
type ChartProps = BaseProps & { padding?: number; chart_size?: ChartSize };
type GenericProps = BaseProps & { padding?: number };

type PropsByKind = {
  header: HeaderProps;
  account_summary: SummaryProps;
  quick_actions: QuickActionProps;
  recent_transactions: GenericProps;
  balance_trend: ChartProps;
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
  header: { visible: true, alignment: "left", typography: "lg", width: "full" },
  account_summary: {
    visible: true, divider_thickness: 2, divider_color: "", padding: 16,
    density: "standard", copy_button: true, hide_balance_button: true, width: "full",
  },
  quick_actions: { visible: true, columns: 3, orientation: "grid", icon_size: 20, show_labels: true, width: "full" },
  recent_transactions: { visible: true, padding: 16, width: "full" },
  balance_trend:       { visible: true, padding: 16, width: "half", chart_size: "medium" },
  exchange_rates:      { visible: true, padding: 16, width: "half" },
  cards:               { visible: true, padding: 16, width: "half" },
  beneficiaries:       { visible: true, padding: 16, width: "half" },
  notifications:       { visible: true, padding: 16, width: "full" },
  faq:                 { visible: true, padding: 16, width: "full" },
  support:             { visible: true, padding: 16, width: "full" },
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

const WIDTH_SPAN: Record<WidthSize, string> = {
  full: "col-span-12",
  half: "col-span-12 md:col-span-6",
  third: "col-span-12 md:col-span-4",
};

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_MAX: Record<Device, string> = {
  desktop: "max-w-5xl",
  tablet: "max-w-2xl",
  mobile: "max-w-sm",
};

/* --------------------------------- Shell --------------------------------- */

function Designer() {
  const { id } = useParams({ from: "/manage/banks/$id/dashboard-designer" });
  const navigate = useNavigate();
  const getDraftFn = useServerFn(getDraft);
  const draftQ = useQuery({ queryKey: ["bb-draft", id], queryFn: () => getDraftFn({ data: { id } }) });
  const draft = draftQ.data as BankDraft | undefined;

  const [layout, _setLayout] = useState<LayoutDraft>(() => loadDraft(id));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [layersOpen, setLayersOpen] = useState(true);

  // Undo/redo history (layout-only)
  const pastRef = useRef<LayoutDraft[]>([]);
  const futureRef = useRef<LayoutDraft[]>([]);
  const [, forceRerender] = useState(0);

  const setLayout = useCallback((updater: LayoutDraft | ((prev: LayoutDraft) => LayoutDraft), opts?: { history?: boolean }) => {
    _setLayout((prev) => {
      const next = typeof updater === "function" ? (updater as (p: LayoutDraft) => LayoutDraft)(prev) : updater;
      if (opts?.history !== false) {
        pastRef.current.push(prev);
        if (pastRef.current.length > 100) pastRef.current.shift();
        futureRef.current = [];
      }
      return next;
    });
    forceRerender((n) => n + 1);
  }, []);

  const selected = layout.items.find((i) => i.id === selectedId) ?? null;

  const identity = (draft?.identity ?? {}) as Partial<BankIdentity>;
  const branding = (draft?.branding ?? {}) as Partial<BankBranding>;
  const primary   = branding.primary_color   ?? "#0a2540";
  const secondary = branding.secondary_color ?? "#1e88e5";
  const accent    = branding.accent_color    ?? "#00c48c";
  const fontHeading = branding.font_heading ?? "Inter";
  const fontBody    = branding.font_body    ?? "Inter";

  /* ---- Mutations (all go through setLayout so history is tracked) ---- */

  const updateItem = useCallback((idToUpdate: string, patch: Partial<CanvasItem["props"]>) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idToUpdate ? ({ ...it, props: { ...it.props, ...patch } } as CanvasItem) : it,
      ),
    }));
  }, [setLayout]);

  const addComponent = useCallback((kind: ComponentKind, atIndex?: number) => {
    setLayout((l) => {
      const item = { id: uid(), kind, props: { ...DEFAULTS[kind] } } as CanvasItem;
      const next = l.items.slice();
      if (typeof atIndex === "number") next.splice(atIndex, 0, item);
      else next.push(item);
      return { ...l, items: next };
    });
  }, [setLayout]);

  const removeItem = useCallback((idToRemove: string) => {
    setLayout((l) => ({ ...l, items: l.items.filter((i) => i.id !== idToRemove || i.props.locked) }));
    if (selectedId === idToRemove) setSelectedId(null);
  }, [selectedId, setLayout]);

  const duplicateItem = useCallback((idToDup: string) => {
    setLayout((l) => {
      const idx = l.items.findIndex((i) => i.id === idToDup);
      if (idx < 0) return l;
      const copy = { ...l.items[idx], id: uid(), props: { ...l.items[idx].props, locked: false } } as CanvasItem;
      const next = l.items.slice();
      next.splice(idx + 1, 0, copy);
      return { ...l, items: next };
    });
  }, [setLayout]);

  const toggleVisible = useCallback((idT: string) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idT ? ({ ...it, props: { ...it.props, visible: it.props.visible === false ? true : false } } as CanvasItem) : it,
      ),
    }));
  }, [setLayout]);

  const toggleLock = useCallback((idT: string) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idT ? ({ ...it, props: { ...it.props, locked: !it.props.locked } } as CanvasItem) : it,
      ),
    }));
  }, [setLayout]);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setLayout((l) => {
      if (fromIndex < 0 || fromIndex >= l.items.length) return l;
      const next = l.items.slice();
      const [moved] = next.splice(fromIndex, 1);
      const insertAt = Math.max(0, Math.min(next.length, toIndex));
      next.splice(insertAt, 0, moved);
      return { ...l, items: next };
    });
  }, [setLayout]);

  /* --------------------------- Save / Reset --------------------------- */

  function saveDraft() {
    const payload = { ...layout, updated_at: new Date().toISOString() };
    try {
      window.localStorage.setItem(storageKey(id), JSON.stringify(payload));
      _setLayout(payload);
      toast.success("Layout draft saved");
    } catch {
      toast.error("Could not save draft");
    }
  }
  function resetLayout() {
    setLayout(defaultLayout());
    setSelectedId(null);
    toast.message("Layout reset to defaults");
  }

  /* ------------------------------ Undo/Redo --------------------------- */

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    _setLayout((cur) => {
      futureRef.current.push(cur);
      return prev;
    });
    forceRerender((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    _setLayout((cur) => {
      pastRef.current.push(cur);
      return next;
    });
    forceRerender((n) => n + 1);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.key === "z" && e.shiftKey) || e.key === "y") { e.preventDefault(); redo(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  /* ----------------------------- DnD helpers -------------------------- */

  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  function onItemDragStart(e: React.DragEvent, itemId: string) {
    e.dataTransfer.setData("text/x-item-id", itemId);
    e.dataTransfer.effectAllowed = "move";
  }
  function onItemDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }
  function onCanvasDrop(e: React.DragEvent, dropIndex?: number) {
    e.preventDefault();
    const componentKind = e.dataTransfer.getData("text/x-component") as ComponentKind;
    const movingId = e.dataTransfer.getData("text/x-item-id");
    const targetIndex = dropIndex ?? layout.items.length;
    if (componentKind && COMPONENT_META[componentKind]) {
      addComponent(componentKind, targetIndex);
    } else if (movingId) {
      const from = layout.items.findIndex((i) => i.id === movingId);
      if (from >= 0) {
        // Adjust index when moving down
        const to = targetIndex > from ? targetIndex - 1 : targetIndex;
        reorder(from, to);
      }
    }
    setDragOverIndex(null);
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

          {/* Device switcher */}
          <div className="ml-4 hidden items-center gap-1 rounded-md border p-0.5 md:flex">
            {(["desktop","tablet","mobile"] as Device[]).map((d) => {
              const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
              return (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={cn("flex items-center gap-1 rounded px-2 py-1 text-xs capitalize",
                    device === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  title={`${d} preview`}
                >
                  <Icon className="h-3.5 w-3.5" /> {d}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={undo} disabled={pastRef.current.length === 0} title="Undo (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={futureRef.current.length === 0} title="Redo (Ctrl+Y)">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetLayout}><RotateCcw className="mr-1 h-4 w-4" /> Reset</Button>
            <Button variant="outline" size="sm" onClick={() => { setPreviewNonce((n) => n + 1); toast.success("Preview refreshed"); }}>
              <Eye className="mr-1 h-4 w-4" /> Preview
            </Button>
            <Button size="sm" onClick={saveDraft}><Save className="mr-1 h-4 w-4" /> Save Draft</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Left: Components + Layers */}
        <aside className="border-r bg-background overflow-y-auto">
          <div className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Components</div>
          <div className="space-y-1 px-2 pb-2">
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

          {/* Layers panel */}
          <div className="mt-2 border-t">
            <button
              onClick={() => setLayersOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
            >
              <span className="flex items-center gap-1">
                {layersOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Layout Structure
              </span>
              <span className="text-[10px] normal-case">{layout.items.length} items</span>
            </button>
            {layersOpen && (
              <ul className="space-y-0.5 px-2 pb-4">
                <li className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">Dashboard</li>
                {layout.items.map((it, idx) => {
                  const Icon = COMPONENT_META[it.kind].icon;
                  const isSel = selectedId === it.id;
                  const hidden = it.props.visible === false;
                  return (
                    <li key={it.id}>
                      <div
                        draggable
                        onDragStart={(e) => onItemDragStart(e, it.id)}
                        onDragOver={(e) => onItemDragOver(e, idx)}
                        onDrop={(e) => onCanvasDrop(e, idx)}
                        onClick={() => setSelectedId(it.id)}
                        className={cn(
                          "group flex cursor-grab items-center gap-1.5 rounded px-2 py-1 text-xs active:cursor-grabbing",
                          isSel ? "bg-primary/10 text-primary" : "hover:bg-muted",
                          hidden && "opacity-50",
                        )}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1 truncate">{COMPONENT_META[it.kind].label}</span>
                        {it.props.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                        {hidden && <EyeOff className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Center: Canvas */}
        <section
          className="min-w-0 overflow-y-auto p-6"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => onCanvasDrop(e)}
          key={previewNonce}
        >
          <div
            className={cn("mx-auto rounded-xl border bg-background p-4 shadow-sm transition-all", DEVICE_MAX[device])}
            style={{ fontFamily: fontBody }}
          >
            {layout.items.length === 0 && (
              <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">
                Drag components from the left to start designing.
              </div>
            )}
            <div className="grid grid-cols-12 gap-3">
              {layout.items.map((it, idx) => {
                const span = device === "mobile" ? "col-span-12" : WIDTH_SPAN[it.props.width ?? "full"];
                return (
                  <div
                    key={it.id}
                    className={cn(span, "relative")}
                  >
                    {dragOverIndex === idx && (
                      <div className="pointer-events-none absolute -top-1.5 left-0 right-0 h-1 rounded" style={{ backgroundColor: primary }} />
                    )}
                    <div
                      draggable={!it.props.locked}
                      onDragStart={(e) => onItemDragStart(e, it.id)}
                      onDragOver={(e) => onItemDragOver(e, idx)}
                      onDrop={(e) => onCanvasDrop(e, idx)}
                      onClick={() => setSelectedId(it.id)}
                      className={cn(
                        "group relative rounded-lg border bg-background p-1 transition",
                        selectedId === it.id ? "ring-2" : "hover:bg-muted/40",
                        it.props.locked && "cursor-not-allowed",
                      )}
                      style={selectedId === it.id ? { boxShadow: `0 0 0 2px ${primary}`, borderColor: primary } : undefined}
                    >
                      <div className="pointer-events-none absolute -top-2 left-2 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground group-hover:block">
                        {COMPONENT_META[it.kind].label}
                      </div>
                      <div className="absolute right-1 top-1 z-10 hidden gap-0.5 rounded border bg-background p-0.5 shadow-sm group-hover:flex">
                        <IconBtn title={it.props.visible === false ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); toggleVisible(it.id); }}>
                          {it.props.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </IconBtn>
                        <IconBtn title={it.props.locked ? "Unlock" : "Lock"} onClick={(e) => { e.stopPropagation(); toggleLock(it.id); }}>
                          {it.props.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </IconBtn>
                        <IconBtn title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateItem(it.id); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); if (!it.props.locked) removeItem(it.id); else toast.error("Unlock to delete"); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </IconBtn>
                      </div>
                      <RenderPreview
                        item={it}
                        colors={{ primary, secondary, accent }}
                        fontHeading={fontHeading}
                        bankName={identity.bank_name || "Sample Bank"}
                        currency={identity.currency || "USD"}
                      />
                    </div>
                  </div>
                );
              })}
              {/* Drop zone at end */}
              <div
                className="col-span-12 h-6 rounded border border-dashed border-transparent"
                onDragOver={(e) => onItemDragOver(e, layout.items.length)}
                onDrop={(e) => onCanvasDrop(e, layout.items.length)}
              />
            </div>
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

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded hover:bg-muted"
    >
      {children}
    </button>
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

      <Row label="Locked">
        <Switch
          checked={!!item.props.locked}
          onCheckedChange={(v) => onChange({ locked: v } as Partial<CanvasItem["props"]>)}
        />
      </Row>

      <Row label="Width">
        <Select
          value={item.props.width ?? "full"}
          onValueChange={(v) => onChange({ width: v as WidthSize } as Partial<CanvasItem["props"]>)}
        >
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full width</SelectItem>
            <SelectItem value="half">Half width</SelectItem>
            <SelectItem value="third">One third</SelectItem>
          </SelectContent>
        </Select>
      </Row>

      {item.kind === "header" && (
        <HeaderPropsPanel item={item as CanvasItem<"header">} onChange={onChange as (p: Partial<HeaderProps>) => void} />
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
      {item.kind === "balance_trend" && (
        <ChartPropsPanel item={item as CanvasItem<"balance_trend">} onChange={onChange as (p: Partial<ChartProps>) => void} />
      )}
      {["recent_transactions","exchange_rates","cards","beneficiaries","notifications","faq","support"].includes(item.kind) && (
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

function HeaderPropsPanel({ item, onChange }: { item: CanvasItem<"header">; onChange: (p: Partial<HeaderProps>) => void }) {
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

function ChartPropsPanel({ item, onChange }: { item: CanvasItem<"balance_trend">; onChange: (p: Partial<ChartProps>) => void }) {
  const p = item.props;
  return (
    <>
      <Row label="Chart size">
        <Select value={p.chart_size ?? "medium"} onValueChange={(v) => onChange({ chart_size: v as ChartSize })}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      <div>
        <Label className="text-xs text-muted-foreground">Padding ({p.padding ?? 16}px)</Label>
        <Slider className="mt-2" min={0} max={48} step={2}
          value={[p.padding ?? 16]}
          onValueChange={([v]) => onChange({ padding: v })}
        />
      </div>
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
      const colClass = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[p.columns ?? 3];
      const cols = p.orientation === "horizontal" ? "flex flex-wrap gap-2" : `grid gap-3 ${colClass}`;
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
    case "balance_trend": {
      const p = item.props as ChartProps;
      const h = { small: "h-12", medium: "h-20", large: "h-32" }[p.chart_size ?? "medium"];
      return (
        <div style={{ padding: p.padding ?? 16 }}>
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Balance trend</div>
          <svg viewBox="0 0 200 60" preserveAspectRatio="none" className={cn("w-full", h)}>
            <polyline fill="none" strokeWidth="2" stroke={colors.primary}
              points="0,40 20,32 40,36 60,20 80,28 100,18 120,22 140,10 160,16 180,8 200,12" />
          </svg>
        </div>
      );
    }
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

// Silence unused var lints
void useMemo;

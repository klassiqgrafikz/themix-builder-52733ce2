import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getDraft } from "@/lib/bank-builder.functions";
import type { BankBranding, BankDraft, BankIdentity } from "@/lib/bank-builder.types";
import {
  getDashboardLayout,
  saveDashboardLayoutDraft,
  publishDashboardLayout,
  resetDashboardLayout,
  duplicateDashboardLayout,
  listOwnedBanksForDuplicate,
} from "@/lib/dashboard-layout/functions";
import {
  defaultDashboardLayout,
  type DashboardComponentKind,
  type DashboardLayout,
  type DashboardLayoutItem,
  type DashboardPropValue,
  type WidthSize,
} from "@/lib/dashboard-layout/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, Save, Eye, RotateCcw, Undo2, Redo2, UploadCloud, CopyPlus,
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
      <Designer />
  );
}

/* --------------------------------- Meta --------------------------------- */

const COMPONENT_META: Record<DashboardComponentKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
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

const DEFAULT_PROPS: Record<DashboardComponentKind, Record<string, DashboardPropValue>> = {
  header: { style: "welcome", alignment: "left", typography: "lg" },
  account_summary: { style: "minimal", divider_thickness: 2, padding: 16, copy_button: true, hide_balance_button: true },
  quick_actions: { columns: 3, orientation: "grid", icon_size: 20, show_labels: true },
  recent_transactions: { padding: 16 },
  balance_trend: { padding: 16, chart_size: "medium" },
  exchange_rates: { padding: 16 },
  cards: { padding: 16 },
  beneficiaries: { padding: 16 },
  notifications: { padding: 16 },
  faq: { padding: 16 },
  support: { padding: 16 },
};

function uid() { return Math.random().toString(36).slice(2, 10); }

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
  const qc = useQueryClient();

  const getDraftFn = useServerFn(getDraft);
  const getLayoutFn = useServerFn(getDashboardLayout);
  const saveFn = useServerFn(saveDashboardLayoutDraft);
  const publishFn = useServerFn(publishDashboardLayout);
  const resetFn = useServerFn(resetDashboardLayout);
  const duplicateFn = useServerFn(duplicateDashboardLayout);
  const listOwnedFn = useServerFn(listOwnedBanksForDuplicate);

  const draftQ = useQuery({ queryKey: ["bb-draft", id], queryFn: () => getDraftFn({ data: { id } }) });
  const layoutQ = useQuery({ queryKey: ["dash-layout", id], queryFn: () => getLayoutFn({ data: { id } }) });
  const ownedQ = useQuery({ queryKey: ["dash-owned"], queryFn: () => listOwnedFn() });

  const draft = draftQ.data as BankDraft | undefined;

  const [layout, _setLayout] = useState<DashboardLayout>(() => defaultDashboardLayout());
  const initialisedRef = useRef(false);
  useEffect(() => {
    if (initialisedRef.current) return;
    if (layoutQ.data) {
      _setLayout(layoutQ.data.draft);
      initialisedRef.current = true;
    }
  }, [layoutQ.data]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [device, setDevice] = useState<Device>("desktop");
  const [layersOpen, setLayersOpen] = useState(true);

  // Undo/redo history (layout-only)
  const pastRef = useRef<DashboardLayout[]>([]);
  const futureRef = useRef<DashboardLayout[]>([]);
  const [, forceRerender] = useState(0);

  const setLayout = useCallback((updater: DashboardLayout | ((prev: DashboardLayout) => DashboardLayout), opts?: { history?: boolean }) => {
    _setLayout((prev) => {
      const next = typeof updater === "function" ? (updater as (p: DashboardLayout) => DashboardLayout)(prev) : updater;
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

  /* ---- Mutations ---- */

  const updateItem = useCallback((idToUpdate: string, patch: Partial<DashboardLayoutItem["props"]>) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idToUpdate ? { ...it, props: { ...it.props, ...patch } } : it,
      ),
    }));
  }, [setLayout]);

  const updateItemMeta = useCallback((idToUpdate: string, patch: Partial<Pick<DashboardLayoutItem, "width" | "visible" | "locked">>) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idToUpdate ? { ...it, ...patch } : it,
      ),
    }));
  }, [setLayout]);

  const addComponent = useCallback((kind: DashboardComponentKind, atIndex?: number) => {
    setLayout((l) => {
      const item: DashboardLayoutItem = {
        id: uid(), kind, width: "full", visible: true, props: { ...DEFAULT_PROPS[kind] },
      };
      const next = l.items.slice();
      if (typeof atIndex === "number") next.splice(atIndex, 0, item);
      else next.push(item);
      return { ...l, items: next };
    });
  }, [setLayout]);

  const removeItem = useCallback((idToRemove: string) => {
    setLayout((l) => ({ ...l, items: l.items.filter((i) => i.id !== idToRemove) }));
    if (selectedId === idToRemove) setSelectedId(null);
  }, [selectedId, setLayout]);

  const duplicateItem = useCallback((idToDup: string) => {
    setLayout((l) => {
      const idx = l.items.findIndex((i) => i.id === idToDup);
      if (idx < 0) return l;
      const copy: DashboardLayoutItem = { ...l.items[idx], id: uid(), locked: false };
      const next = l.items.slice();
      next.splice(idx + 1, 0, copy);
      return { ...l, items: next };
    });
  }, [setLayout]);

  const toggleVisible = useCallback((idT: string) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idT ? { ...it, visible: it.visible === false ? true : false } : it,
      ),
    }));
  }, [setLayout]);

  const toggleLock = useCallback((idT: string) => {
    setLayout((l) => ({
      ...l,
      items: l.items.map((it) =>
        it.id === idT ? { ...it, locked: !it.locked } : it,
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

  /* --------------------------- Save / Publish --------------------------- */

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { id, layout } }),
    onSuccess: () => { toast.success("Layout draft saved"); qc.invalidateQueries({ queryKey: ["dash-layout", id] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const publishMut = useMutation({
    mutationFn: () => publishFn({ data: { id, layout } }),
    onSuccess: () => { toast.success("Layout published to this bank"); qc.invalidateQueries({ queryKey: ["dash-layout", id] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Publish failed"),
  });

  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { id } }),
    onSuccess: (r) => { setLayout(r.layout); setSelectedId(null); toast.message("Layout reset to defaults"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Reset failed"),
  });

  const [dupFromId, setDupFromId] = useState<string>("");
  const duplicateMut = useMutation({
    mutationFn: () => duplicateFn({ data: { from_id: dupFromId, to_id: id } }),
    onSuccess: (r) => { setLayout(r.layout); toast.success("Layout duplicated into draft"); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Duplicate failed"),
  });

  /* ------------------------------ Undo/Redo --------------------------- */

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    _setLayout((cur) => { futureRef.current.push(cur); return prev; });
    forceRerender((n) => n + 1);
  }, []);
  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    _setLayout((cur) => { pastRef.current.push(cur); return next; });
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
    const componentKind = e.dataTransfer.getData("text/x-component") as DashboardComponentKind;
    const movingId = e.dataTransfer.getData("text/x-item-id");
    const targetIndex = dropIndex ?? layout.items.length;
    if (componentKind && COMPONENT_META[componentKind]) {
      addComponent(componentKind, targetIndex);
    } else if (movingId) {
      const from = layout.items.findIndex((i) => i.id === movingId);
      if (from >= 0) {
        const to = targetIndex > from ? targetIndex - 1 : targetIndex;
        reorder(from, to);
      }
    }
    setDragOverIndex(null);
  }

  const ownedBanks = (ownedQ.data ?? []).filter((b) => b.id !== id);

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

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {ownedBanks.length > 0 && (
              <div className="flex items-center gap-1">
                <Select value={dupFromId} onValueChange={setDupFromId}>
                  <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Duplicate from…" /></SelectTrigger>
                  <SelectContent>
                    {ownedBanks.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" disabled={!dupFromId || duplicateMut.isPending} onClick={() => duplicateMut.mutate()}>
                  <CopyPlus className="mr-1 h-4 w-4" /> Duplicate
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={undo} disabled={pastRef.current.length === 0} title="Undo (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={redo} disabled={futureRef.current.length === 0} title="Redo (Ctrl+Y)">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => resetMut.mutate()} disabled={resetMut.isPending}>
              <RotateCcw className="mr-1 h-4 w-4" /> Restore Default
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setPreviewNonce((n) => n + 1); toast.success("Preview refreshed"); }}>
              <Eye className="mr-1 h-4 w-4" /> Preview
            </Button>
            <Button variant="outline" size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              <Save className="mr-1 h-4 w-4" /> Save Draft
            </Button>
            <Button size="sm" onClick={() => publishMut.mutate()} disabled={publishMut.isPending}>
              <UploadCloud className="mr-1 h-4 w-4" /> Publish Layout
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Left: Components + Layers */}
        <aside className="border-r bg-background overflow-y-auto">
          <div className="p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Components</div>
          <div className="space-y-1 px-2 pb-2">
            {(Object.keys(COMPONENT_META) as DashboardComponentKind[]).map((kind) => {
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
                  const hidden = it.visible === false;
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
                        {it.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
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
                const span = device === "mobile" ? "col-span-12" : WIDTH_SPAN[it.width ?? "full"];
                return (
                  <div key={it.id} className={cn(span, "relative")}>
                    {dragOverIndex === idx && (
                      <div className="pointer-events-none absolute -top-1.5 left-0 right-0 h-1 rounded" style={{ backgroundColor: primary }} />
                    )}
                    <div
                      draggable={!it.locked}
                      onDragStart={(e) => onItemDragStart(e, it.id)}
                      onDragOver={(e) => onItemDragOver(e, idx)}
                      onDrop={(e) => onCanvasDrop(e, idx)}
                      onClick={() => setSelectedId(it.id)}
                      className={cn(
                        "group relative rounded-lg border bg-background p-1 transition",
                        selectedId === it.id ? "ring-2" : "hover:bg-muted/40",
                        it.locked && "cursor-not-allowed",
                      )}
                      style={selectedId === it.id ? { boxShadow: `0 0 0 2px ${primary}`, borderColor: primary } : undefined}
                    >
                      <div className="pointer-events-none absolute -top-2 left-2 hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground group-hover:block">
                        {COMPONENT_META[it.kind].label}
                      </div>
                      <div className="absolute right-1 top-1 z-10 hidden gap-0.5 rounded border bg-background p-0.5 shadow-sm group-hover:flex">
                        <IconBtn title={it.visible === false ? "Show" : "Hide"} onClick={(e) => { e.stopPropagation(); toggleVisible(it.id); }}>
                          {it.visible === false ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </IconBtn>
                        <IconBtn title={it.locked ? "Unlock" : "Lock"} onClick={(e) => { e.stopPropagation(); toggleLock(it.id); }}>
                          {it.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        </IconBtn>
                        <IconBtn title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateItem(it.id); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </IconBtn>
                        <IconBtn title="Delete" onClick={(e) => { e.stopPropagation(); if (!it.locked) removeItem(it.id); else toast.error("Unlock to delete"); }}>
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
                onMetaChange={(patch) => updateItemMeta(selected.id, patch)}
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

function readProp<T extends DashboardPropValue>(item: DashboardLayoutItem, key: string, fallback: T): T {
  const v = item.props?.[key];
  return (v === undefined || v === null ? fallback : (v as T));
}
function readStr(item: DashboardLayoutItem, key: string, fallback: string): string {
  const v = item.props?.[key];
  return typeof v === "string" ? v : fallback;
}
function readNum(item: DashboardLayoutItem, key: string, fallback: number): number {
  const v = item.props?.[key];
  return typeof v === "number" ? v : fallback;
}

function PropertiesPanel({
  item, onChange, onMetaChange,
}: {
  item: DashboardLayoutItem;
  onChange: (patch: Partial<Record<string, DashboardPropValue>>) => void;
  onMetaChange: (patch: Partial<Pick<DashboardLayoutItem, "width" | "visible" | "locked">>) => void;
}) {
  const meta = COMPONENT_META[item.kind];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <meta.icon className="h-4 w-4" />
        <div className="text-sm font-semibold">{meta.label}</div>
      </div>

      <Row label="Visible">
        <Switch checked={item.visible !== false} onCheckedChange={(v) => onMetaChange({ visible: v })} />
      </Row>
      <Row label="Locked">
        <Switch checked={!!item.locked} onCheckedChange={(v) => onMetaChange({ locked: v })} />
      </Row>
      <Row label="Width">
        <Select value={item.width ?? "full"} onValueChange={(v) => onMetaChange({ width: v as WidthSize })}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full width</SelectItem>
            <SelectItem value="half">Half width</SelectItem>
            <SelectItem value="third">One third</SelectItem>
          </SelectContent>
        </Select>
      </Row>

      {item.kind === "header" && (
        <>
          <Row label="Style">
            <Select value={readStr(item, "style", "welcome")} onValueChange={(v) => onChange({ style: v })}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="welcome">Welcome + name</SelectItem>
                <SelectItem value="photo">Photo + badge</SelectItem>
                <SelectItem value="minimal">Minimal (number)</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Alignment">
            <Select value={readStr(item, "alignment", "left")} onValueChange={(v) => onChange({ alignment: v })}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {item.kind === "account_summary" && (
        <>
          <Row label="Style">
            <Select value={readStr(item, "style", "minimal")} onValueChange={(v) => onChange({ style: v })}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="executive">Executive</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <div>
            <Label className="text-xs text-muted-foreground">Divider thickness ({readNum(item, "divider_thickness", 2)}px)</Label>
            <Slider className="mt-2" min={1} max={8} step={1}
              value={[readNum(item, "divider_thickness", 2)]}
              onValueChange={([v]) => onChange({ divider_thickness: v })}
            />
          </div>
        </>
      )}

      {item.kind === "quick_actions" && (
        <>
          <Row label="Columns">
            <Select value={String(readNum(item, "columns", 3))} onValueChange={(v) => onChange({ columns: Number(v) })}>
              <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Orientation">
            <Select value={readStr(item, "orientation", "grid")} onValueChange={(v) => onChange({ orientation: v })}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grid">Grid</SelectItem>
                <SelectItem value="horizontal">Horizontal</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </>
      )}

      {item.kind === "balance_trend" && (
        <Row label="Chart size">
          <Select value={readStr(item, "chart_size", "medium")} onValueChange={(v) => onChange({ chart_size: v })}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </Row>
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
  item: DashboardLayoutItem;
  colors: { primary: string; secondary: string; accent: string };
  fontHeading: string;
  bankName: string;
  currency: string;
}) {
  if (item.visible === false) {
    return <div className="rounded border border-dashed p-3 text-center text-xs text-muted-foreground">{COMPONENT_META[item.kind].label} — hidden</div>;
  }
  switch (item.kind) {
    case "header": {
      const style = readStr(item, "style", "welcome");
      const align = { left: "text-left", center: "text-center", right: "text-right" }[readStr(item, "alignment", "left")];
      if (style === "photo") {
        return (
          <div className={cn("py-3 flex items-center gap-3", align)} style={{ fontFamily: fontHeading, color: colors.primary }}>
            <div className="h-10 w-10 rounded-full grid place-items-center text-white text-sm font-bold" style={{ backgroundColor: colors.secondary }}>
              {SAMPLE.first_name[0]}
            </div>
            <div>
              <div className="font-semibold">{SAMPLE.first_name} {SAMPLE.last_name}</div>
              <span className="inline-block rounded-full px-2 py-0.5 text-[10px]" style={{ backgroundColor: `${colors.accent}22`, color: colors.accent }}>Verified</span>
            </div>
          </div>
        );
      }
      if (style === "minimal") {
        return (
          <div className={cn("py-3", align)} style={{ fontFamily: fontHeading, color: colors.primary }}>
            <div className="text-xs opacity-70">Customer</div>
            <div className="font-mono">{SAMPLE.customer_number}</div>
          </div>
        );
      }
      return (
        <div className={cn("py-3", align)} style={{ fontFamily: fontHeading, color: colors.primary }}>
          <div className="text-xs opacity-70">Welcome Back</div>
          <div className="text-xl font-bold">{SAMPLE.first_name} {SAMPLE.last_name}</div>
          <div className="text-xs opacity-70">{SAMPLE.customer_number} · {bankName}</div>
        </div>
      );
    }
    case "account_summary": {
      const style = readStr(item, "style", "minimal");
      const thick = readNum(item, "divider_thickness", 2);
      if (style === "compact") {
        return (
          <div className="flex items-center justify-between p-3">
            <div>
              <div className="text-xs opacity-70">Balance</div>
              <div className="text-xl font-bold" style={{ color: colors.primary }}>{currency} {SAMPLE.balance.toLocaleString()}</div>
            </div>
            <div className="font-mono text-xs">{SAMPLE.account_number}</div>
          </div>
        );
      }
      if (style === "modern") {
        return (
          <div className="rounded-xl p-4 text-white" style={{ background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})` }}>
            <div className="text-xs opacity-80">Available balance</div>
            <div className="text-2xl font-bold">{currency} {SAMPLE.balance.toLocaleString()}</div>
            <div className="mt-2 font-mono text-xs opacity-80">{SAMPLE.account_number}</div>
          </div>
        );
      }
      if (style === "executive") {
        return (
          <div className="p-4">
            <div className="text-[10px] uppercase tracking-widest opacity-60">Executive Account</div>
            <div className="mt-1 text-3xl font-bold" style={{ color: colors.primary, fontFamily: fontHeading }}>
              {currency} {SAMPLE.balance.toLocaleString()}
            </div>
            <div className="mt-2 h-px" style={{ background: colors.accent }} />
            <div className="mt-2 grid grid-cols-2 text-xs">
              <div><div className="opacity-60">Account</div><div className="font-mono">{SAMPLE.account_number}</div></div>
              <div><div className="opacity-60">Holder</div><div>{SAMPLE.first_name} {SAMPLE.last_name}</div></div>
            </div>
          </div>
        );
      }
      // minimal (divider-based)
      return (
        <div className="p-3">
          <div className="my-2" style={{ borderTop: `${thick}px solid ${colors.primary}` }} />
          <div className="text-xs opacity-70">Available balance</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: colors.primary }}>
            {currency} {SAMPLE.balance.toLocaleString()}
          </div>
          <div className="my-2" style={{ borderTop: `${thick}px solid ${colors.primary}` }} />
          <div className="font-mono text-sm">{SAMPLE.account_number}</div>
        </div>
      );
    }
    case "quick_actions": {
      const columns = readNum(item, "columns", 3);
      const orientation = readStr(item, "orientation", "grid");
      const actions = ["Transfer", "Pay", "Cards", "Statements", "Beneficiaries", "Support"];
      const colClass = ({ 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" } as Record<number, string>)[columns] ?? "grid-cols-3";
      const cls = orientation === "horizontal" ? "flex flex-wrap gap-2" : `grid gap-3 ${colClass}`;
      return (
        <div className="py-3">
          <div className={cls}>
            {actions.map((a) => (
              <div key={a} className="flex flex-col items-center gap-1 rounded-md border p-3 text-center">
                <div className="grid h-9 w-9 place-items-center rounded-full" style={{ backgroundColor: `${colors.primary}12`, color: colors.primary }}>
                  <Zap className="h-4 w-4" />
                </div>
                <div className="text-xs">{a}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "recent_transactions":
      return (
        <div className="p-3">
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
      const h = ({ small: "h-12", medium: "h-20", large: "h-32" } as Record<string, string>)[readStr(item, "chart_size", "medium")] ?? "h-20";
      return (
        <div className="p-3">
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
        <div className="p-3">
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
        <div className="p-3">
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
        <div className="p-3">
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
        <div className="p-3">
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>Notifications</div>
          <ul className="space-y-1 text-sm">
            <li>New card shipped</li>
            <li>Statement ready</li>
          </ul>
        </div>
      );
    case "faq":
      return (
        <div className="p-3">
          <div className="mb-2 text-sm font-semibold" style={{ color: colors.primary }}>FAQ</div>
          <div className="text-xs opacity-80">Answers to common questions about your account.</div>
        </div>
      );
    case "support":
      return (
        <div className="p-3">
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

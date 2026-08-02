import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  finalizeDraft,
  getDraft,
  listCountries,
  listModules,
  listTemplates,
  updateShortSlug,
} from "@/lib/bank-builder.functions";
import { updateDraft } from "@/lib/bank-builder.functions";
import { publishDraft, unpublishDraft, deleteBank, clearRenderingHistory } from "@/lib/website/registry.functions";
import { Input } from "@/components/ui/input";
import { sanitizeShortSlug, validateShortSlug } from "@/lib/website/reserved-slugs";
import { TenantGateway } from "@/lib/website/tenant-gateway";
import { TenantSite } from "@/lib/website/tenant-site";
import { HomepageEditor } from "@/routes/manage.banks.homepage-editor";
import {
  deleteBankProduct,
  listBankProducts,
  listBlueprintProducts,
  listCatalogProducts,
  listProductCategories,
  upsertBankProduct,
} from "@/lib/products/catalog.functions";
import type {
  BankBranding,
  BankCountry,
  BankDraft,
  BankIdentity,
  BankModule,
  BankTemplate,
  RenderLogEntry,
  RenderStatus,
  WebsiteManifest,
} from "@/lib/bank-builder.types";
import { getDashboardLayoutForKey, normalizePortalLayoutKey, type PortalLayoutKey } from "@/lib/dashboard-layout/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Pencil,
  Users,
  BarChart3,
  FileText,
  Cpu,
  ExternalLink,
  Rocket,
  RefreshCw,
  PauseCircle,
  Trash2,
  History,
  LayoutDashboard,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";


export const Route = createFileRoute("/manage/banks/$id")({
  head: () => ({
    meta: [
      { title: "Bank Overview — TheMixWeb" },
      { name: "description", content: "Overview of a generated bank tenant." },
    ],
  }),
  component: BankOverviewPage,
});

function BankOverviewPage() {
  return (
      <BankOverview />
  );
}

function BankOverview() {
  const { id } = useParams({ from: "/manage/banks/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getDraftFn = useServerFn(getDraft);
  const listCountriesFn = useServerFn(listCountries);
  const listModulesFn = useServerFn(listModules);
  const listTemplatesFn = useServerFn(listTemplates);
  const finalizeDraftFn = useServerFn(finalizeDraft);
  const publishDraftFn = useServerFn(publishDraft);
  const unpublishDraftFn = useServerFn(unpublishDraft);

  const draftQ = useQuery({
    queryKey: ["bb-draft", id],
    queryFn: () => getDraftFn({ data: { id } }),
  });
  const draft = draftQ.data as BankDraft | undefined;

  const countriesQ = useQuery({ queryKey: ["bb-countries"], queryFn: () => listCountriesFn() });
  const modulesQ = useQuery({ queryKey: ["bb-modules"], queryFn: () => listModulesFn() });
  const templatesQ = useQuery({
    queryKey: ["bb-templates", draft?.country_code ?? "all"],
    queryFn: () => listTemplatesFn({ data: { country_code: draft?.country_code ?? null } }),
    enabled: !!draft,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bb-draft", id] });
    qc.invalidateQueries({ queryKey: ["bb-drafts"] });
  };

  const rerenderMut = useMutation({
    mutationFn: () => finalizeDraftFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Website re-rendered"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Render failed"),
  });
  const publishMut = useMutation({
    mutationFn: () => publishDraftFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Bank published"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Publish failed"),
  });
  const unpublishMut = useMutation({
    mutationFn: () => unpublishDraftFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Bank unpublished"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Unpublish failed"),
  });
  const deleteBankFn = useServerFn(deleteBank);
  const clearHistoryFn = useServerFn(clearRenderingHistory);
  const clearHistoryMut = useMutation({
    mutationFn: () => clearHistoryFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Rendering timeline cleared"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to clear history"),
  });
  const deleteMut = useMutation({
    mutationFn: (purgeAudit: boolean) =>
      deleteBankFn({ data: { id, purge_audit: purgeAudit } }),
    onSuccess: () => {
      toast.success("Bank deleted");
      qc.invalidateQueries({ queryKey: ["bb-drafts"] });
      navigate({ to: "/admin" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  if (draftQ.isLoading || !draft) {
    return <div className="p-8 text-center text-muted-foreground">Loading bank…</div>;
  }

  const identity = (draft.identity ?? {}) as Partial<BankIdentity>;
  const branding = (draft.branding ?? {}) as Partial<BankBranding>;
  const countries = (countriesQ.data as BankCountry[]) ?? [];
  const modules = (modulesQ.data as BankModule[]) ?? [];
  const templates = (templatesQ.data as BankTemplate[]) ?? [];
  const country = countries.find((c) => c.code === draft.country_code);
  const template = templates.find((t) => t.id === draft.template_id);
  const enabledKeys = Object.entries(draft.features ?? {})
    .filter(([, on]) => on)
    .map(([k]) => k);
  const enabledModules = modules.filter((m) => enabledKeys.includes(m.key));
  const renderStatus: RenderStatus = draft.render_status ?? "draft";
  const manifest = isManifest(draft.manifest) ? draft.manifest : null;
  const navigation = draft.navigation ?? [];
  const logs = Array.isArray(draft.render_logs) ? draft.render_logs : [];
  const publicSlug = draft.short_slug ?? draft.slug ?? null;
  const publicRoute = publicSlug ? `/${publicSlug}` : null;
  const isPublished = renderStatus === "published" && !!publicRoute;
  const isReady = renderStatus === "ready";
  const busy = rerenderMut.isPending || publishMut.isPending || unpublishMut.isPending;

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewPage, setPreviewPage] = useState<"gateway" | "site">("site");
  const previewFrameW = previewDevice === "desktop" ? "100%" : previewDevice === "tablet" ? 768 : 375;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="text-sm font-semibold">TheMixWeb</Link>
          <span className="text-muted-foreground">›</span>
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">Admin</Link>
          <span className="text-muted-foreground">›</span>
          <span className="truncate text-sm font-medium">
            {identity.bank_name || "Untitled bank"}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl text-lg font-bold text-white"
              style={{
                background: `linear-gradient(135deg, ${branding.primary_color ?? "#0a2540"}, ${branding.secondary_color ?? "#1e88e5"})`,
              }}
            >
              {(identity.bank_name ?? "B").slice(0, 1).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{identity.bank_name || "Untitled bank"}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {country && <span>{country.flag_emoji} {country.name}</span>}
                {draft.slug && <span className="font-mono">· slug: {draft.slug}</span>}
                {draft.short_slug && <span className="font-mono">· url: /{draft.short_slug}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RenderStatusBadge status={renderStatus} />
            <Button variant="outline" onClick={() => navigate({ to: "/admin" })}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Admin
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Blueprint</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="font-medium">{template?.name ?? "Custom build"}</div>
              {template && (
                <div className="text-xs text-muted-foreground">
                  {template.category} · v{template.version}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Locale</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div>
                {identity.currency ?? "—"} · {identity.language?.toUpperCase() ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">{identity.timezone ?? "—"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Theme</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {(["primary_color", "secondary_color", "accent_color"] as const).map((k) => (
                  <div key={k} className="flex-1 rounded border p-2 text-center">
                    <div
                      className="mx-auto h-8 w-8 rounded"
                      style={{ backgroundColor: (branding[k] as string) || "#ccc" }}
                    />
                    <div className="mt-1 text-xs text-muted-foreground">{k.replace("_color", "")}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {branding.font_heading ?? "—"} / {branding.font_body ?? "—"} ·{" "}
                {branding.dark_mode ? "Dark" : "Light"}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Enabled Bank Modules</CardTitle></CardHeader>
          <CardContent>
            {enabledModules.length === 0 ? (
              <div className="text-sm text-muted-foreground">No modules enabled</div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {enabledModules.map((m) => (
                  <Badge key={m.key} variant="secondary">{m.label}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-4 w-4" /> Website Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Render status" value={<RenderStatusBadge status={renderStatus} />} />
              <Row
                label="Public route"
                value={
                  publicRoute ? (
                    <span className="font-mono">{publicRoute}</span>
                  ) : (
                    <span className="text-muted-foreground">Not generated</span>
                  )
                }
              />
              <Row
                label="Last render"
                value={draft.rendered_at ? new Date(draft.rendered_at).toLocaleString() : "—"}
              />
              <Row
                label="Publish date"
                value={draft.published_at ? new Date(draft.published_at).toLocaleString() : "—"}
              />
              {!isPublished && (
                <p className="pt-2 text-xs text-muted-foreground">
                  {renderStatus === "draft" &&
                    "Bank is still a draft. Finish the wizard and click Generate Bank."}
                  {renderStatus === "rendering" && "Rendering in progress…"}
                  {renderStatus === "ready" &&
                    "Website is generated and ready. Click Publish to make it public at /" +
                      (draft.slug ?? "…") +
                      "."}
                  {renderStatus === "archived" && "This bank has been archived."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Website Manifest
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {manifest ? (
                <>
                  <Row label="Manifest version" value={`v${manifest.version}`} />
                  <Row label="Pages" value={String(manifest.pages.length)} />
                  <Row label="Nav items" value={String(navigation.length)} />
                  <Row label="Modules" value={String(manifest.modules.length)} />
                  <Row
                    label="Generated"
                    value={new Date(manifest.metadata.generated_at).toLocaleString()}
                  />
                </>
              ) : (
                <div className="text-muted-foreground">
                  Manifest not yet generated. Run the wizard's Generate step.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-4 w-4" /> Website Registry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isPublished ? (
              <>
                <Row label="Registered slug" value={<span className="font-mono">{draft.slug}</span>} />
                <Row label="Route" value={<span className="font-mono">{publicRoute}</span>} />
                <Row label="Blueprint" value={template?.name ?? "Custom build"} />
                <Row label="Status" value={<RenderStatusBadge status="published" />} />
              </>
            ) : (
              <div className="text-muted-foreground">
                This bank is not yet in the public Website Registry.
              </div>
            )}
          </CardContent>
        </Card>

        <ShortSlugEditor draftId={id} current={draft.short_slug ?? ""} onSaved={invalidate} />


        {manifest && manifest.pages.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Generated Pages</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1">
                {manifest.pages.map((p) => (
                  <Badge key={p.slug} variant={p.system ? "outline" : "secondary"}>
                    {p.title}
                    <span className="ml-1 font-mono text-[10px] opacity-60">{p.path}</span>
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <BankProductsPanel draftId={id} onChanged={() => rerenderMut.mutate()} rerenderPending={rerenderMut.isPending} />

        <DashboardStylePanel
          draftId={id}
          manifest={manifest}
          branding={(draft.branding ?? {}) as Record<string, unknown> | null}
          current={normalizeStyle((draft?.manifest as Record<string, unknown> | undefined)?.portal_layout_key ?? (branding as Record<string, unknown>).portal_layout_key)}
          primaryColor={branding.primary_color ?? "#0a2540"}
          secondaryColor={branding.secondary_color ?? "#1e88e5"}
          onSaved={invalidate}
        />



        <Card>
          <CardHeader><CardTitle>Rendering Timeline</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No render has run yet.</div>
            ) : (
              <ol className="space-y-1 font-mono text-xs">
                {logs.map((l, i) => (
                  <LogRow key={i} entry={l} />
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Manage this bank</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Button
              className="justify-start"
              disabled={!isPublished}
              onClick={() =>
                publicRoute && window.open(publicRoute, "_blank", "noopener")
              }
              title={
                isPublished
                  ? "Open the public banking website"
                  : "Publish this bank to open its public site"
              }
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {isPublished ? "Open Public Site" : "Public site unavailable"}
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              disabled={!manifest}
              onClick={() => setPreviewOpen(true)}
            >
              <Monitor className="mr-2 h-4 w-4" />
              Preview Homepage
            </Button>
            {isReady && (
              <Button
                className="justify-start"
                disabled={busy}
                onClick={() => publishMut.mutate()}
              >
                <Rocket className="mr-2 h-4 w-4" /> Publish Website
              </Button>
            )}
            {isPublished && (
              <>
                <Button
                  variant="outline"
                  className="justify-start"
                  disabled={busy}
                  onClick={() => rerenderMut.mutate()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Republish Website
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  disabled={busy}
                  onClick={() => unpublishMut.mutate()}
                >
                  <PauseCircle className="mr-2 h-4 w-4" /> Unpublish
                </Button>
              </>
            )}
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate({ to: "/bank-builder", search: { draftId: id } })}
            >
              <Pencil className="mr-2 h-4 w-4" /> Edit configuration
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate({ to: "/admin/$section", params: { section: "customers" } })}
            >
              <Users className="mr-2 h-4 w-4" /> Manage Customers
            </Button>
            <Button
              variant="outline"
              className="justify-start"
              onClick={() => navigate({ to: "/admin" })}
            >
              <BarChart3 className="mr-2 h-4 w-4" /> Analytics
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="justify-start" disabled={logs.length === 0 || clearHistoryMut.isPending}>
                  <History className="mr-2 h-4 w-4" /> Clear Rendering History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear rendering timeline?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Only rendering timeline entries are removed. Banks, customers, audit logs, website manifests and ledger entries are preserved.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => clearHistoryMut.mutate()}>Clear history</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="justify-start" disabled={deleteMut.isPending}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Bank
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this bank?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the website manifest, published website, navigation, branding assets, customer portal, and rendering timeline for <strong>{identity.bank_name}</strong>. Audit logs are preserved. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteMut.mutate(false)}
                  >
                    Delete bank
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        <HomepageEditor
          manifest={manifest}
          branding={(draft.branding ?? {}) as Record<string, unknown> | null}
          draftId={id}
          onSaved={() => qc.invalidateQueries({ queryKey: ["bb-draft", id] })}
        />
      </main>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Homepage Preview — {identity.bank_name}</DialogTitle>
            <DialogDescription>
              See how your landing page looks across devices.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap items-center gap-3 border-b pb-3">
            <Tabs value={previewPage} onValueChange={(v) => setPreviewPage(v as typeof previewPage)}>
              <TabsList>
                <TabsTrigger value="gateway">Gateway</TabsTrigger>
                <TabsTrigger value="site">Landing Page</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={previewDevice} onValueChange={(v) => setPreviewDevice(v as typeof previewDevice)} className="ml-auto">
              <TabsList>
                <TabsTrigger value="desktop"><Monitor className="mr-1 h-4 w-4" />Desktop</TabsTrigger>
                <TabsTrigger value="tablet"><Tablet className="mr-1 h-4 w-4" />Tablet</TabsTrigger>
                <TabsTrigger value="mobile"><Smartphone className="mr-1 h-4 w-4" />Mobile</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-hidden rounded-lg border bg-muted/40 p-4 min-h-0">
            <div
              className="mx-auto overflow-auto rounded-md border bg-background shadow-sm transition-all"
              style={{ width: previewFrameW, maxWidth: "100%", maxHeight: "600px" }}
            >
              <div className="pointer-events-none">
                {manifest && previewPage === "gateway" && (
                  <TenantGateway manifest={manifest} />
                )}
                {manifest && previewPage === "site" && (
                  <TenantSite
                    manifest={manifest}
                    page={manifest.pages[0] ?? { slug: "home", path: "/home", title: "Home", module_key: null, system: false }}
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function LogRow({ entry }: { entry: RenderLogEntry }) {
  const color =
    entry.level === "error"
      ? "text-red-600"
      : entry.level === "warn"
        ? "text-amber-600"
        : "text-emerald-600";
  return (
    <li className="flex gap-2">
      <span className="text-muted-foreground">
        {new Date(entry.at).toLocaleTimeString()}
      </span>
      <span className={color}>[{entry.stage}]</span>
      <span>{entry.message}</span>
    </li>
  );
}

function RenderStatusBadge({ status }: { status: RenderStatus }) {
  const styles: Record<RenderStatus, string> = {
    draft: "bg-muted text-foreground",
    rendering: "bg-blue-500 text-white hover:bg-blue-500",
    ready: "bg-emerald-500 text-white hover:bg-emerald-500",
    published: "bg-primary text-primary-foreground",
    archived: "bg-neutral-500 text-white hover:bg-neutral-500",
  };
  return <Badge className={styles[status]}>{status}</Badge>;
}

function isManifest(v: unknown): v is WebsiteManifest {
  return (
    typeof v === "object" &&
    v !== null &&
    "version" in v &&
    "pages" in v &&
    "modules" in v
  );
}

function BankProductsPanel({
  draftId,
  onChanged,
  rerenderPending,
}: {
  draftId: string;
  onChanged: () => void;
  rerenderPending: boolean;
}) {
  const qc = useQueryClient();
  const catFn = useServerFn(listProductCategories);
  const prodFn = useServerFn(listCatalogProducts);
  const bankFn = useServerFn(listBankProducts);
  const upsertFn = useServerFn(upsertBankProduct);
  const deleteFn = useServerFn(deleteBankProduct);
  const bpFn = useServerFn(listBlueprintProducts);

  const catQ = useQuery({ queryKey: ["bp-categories"], queryFn: () => catFn() });
  const prodQ = useQuery({ queryKey: ["bp-products"], queryFn: () => prodFn() });
  const bankQ = useQuery({
    queryKey: ["bp-bank-products", draftId],
    queryFn: () => bankFn({ data: { draftId } }),
  });
  const cachedDraft = qc.getQueryData<BankDraft>(["bb-draft", draftId]);
  const blueprintId = cachedDraft?.template_id ?? null;
  const bpQ = useQuery({
    queryKey: ["bp-blueprint-products", blueprintId],
    queryFn: () => (blueprintId ? bpFn({ data: { blueprintId } }) : Promise.resolve([])),
    enabled: !!blueprintId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["bp-bank-products", draftId] });
  };

  const upsertMut = useMutation({
    mutationFn: (v: { code: string; enabled: boolean; label?: string | null }) =>
      upsertFn({
        data: {
          draftId,
          product_code: v.code,
          enabled: v.enabled,
          display_label: v.label ?? null,
        },
      }),
    onSuccess: () => { invalidate(); toast.success("Product updated"); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });
  const deleteMut = useMutation({
    mutationFn: (code: string) => deleteFn({ data: { draftId, product_code: code } }),
    onSuccess: () => { invalidate(); toast.success("Override cleared"); onChanged(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Clear failed"),
  });

  const categories = catQ.data ?? [];
  const products = prodQ.data ?? [];
  const overrides = bankQ.data ?? [];
  const blueprintCodes = new Set((bpQ.data ?? []).map((b) => b.product_code));
  const overrideMap = new Map(overrides.map((o) => [o.product_code, o]));

  const byCat = new Map<string, typeof products>();
  for (const p of products) {
    const arr = byCat.get(p.category_slug) ?? [];
    arr.push(p);
    byCat.set(p.category_slug, arr);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Products & Services</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">
          Enable, disable or rename products inherited from the central catalog. Re-render the
          bank after changes to update the customer portal.
        </p>
        {categories.map((c) => {
          const list = byCat.get(c.slug) ?? [];
          return (
            <div key={c.slug}>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {c.name}
              </div>
              <div className="divide-y rounded-md border">
                {list.map((p) => {
                  const ov = overrideMap.get(p.code);
                  const fromBlueprint = blueprintCodes.has(p.code);
                  const enabled = ov ? ov.enabled : fromBlueprint;
                  return (
                    <div key={p.code} className="flex items-center justify-between gap-2 p-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {ov?.display_label || p.name}
                          {fromBlueprint && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              blueprint
                            </Badge>
                          )}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{p.code}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={enabled ? "default" : "secondary"} className="text-[10px]">
                          {enabled ? "enabled" : "disabled"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={upsertMut.isPending || rerenderPending}
                          onClick={() =>
                            upsertMut.mutate({
                              code: p.code,
                              enabled: !enabled,
                              label: ov?.display_label,
                            })
                          }
                        >
                          {enabled ? "Disable" : "Enable"}
                        </Button>
                        {ov && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={deleteMut.isPending || rerenderPending}
                            onClick={() => deleteMut.mutate(p.code)}
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}


function ShortSlugEditor({
  draftId,
  current,
  onSaved,
}: {
  draftId: string;
  current: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(current);
  const doUpdate = useServerFn(updateShortSlug);
  const mut = useMutation({
    mutationFn: () => doUpdate({ data: { id: draftId, short_slug: value } }),
    onSuccess: (r) => {
      toast.success(`Short URL set to /${r.short_slug}`);
      setValue(r.short_slug);
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save slug"),
  });
  const clientErr = value === current ? null : validateShortSlug(value);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4" /> Short URL
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Customer-facing URL for this bank. Only lowercase letters, digits, and hyphens.
          Duplicates are automatically suffixed with -2, -3, etc.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">bankofa.online/</span>
          <Input
            value={value}
            onChange={(e) => setValue(sanitizeShortSlug(e.target.value))}
            placeholder="boa"
            className="max-w-[220px] font-mono"
          />
          <Button
            onClick={() => mut.mutate()}
            disabled={
              mut.isPending || !value || value === current || !!clientErr
            }
          >
            {mut.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
        {clientErr && <div className="text-xs text-destructive">{clientErr}</div>}
      </CardContent>
    </Card>
  );
}

type LayoutKey = PortalLayoutKey;

function normalizeStyle(v: unknown): LayoutKey {
  return normalizePortalLayoutKey(v);
}

const LAYOUT_OPTIONS: {
  key: LayoutKey;
  title: string;
  desc: string;
}[] = [
  { key: "sidebar", title: "Sidebar", desc: "Standard left sidebar with full navigation. Classic banking layout with all dashboard sections in a balanced grid." },
  { key: "traditional", title: "Traditional Banking", desc: "Dark header banner with greeting, a horizontal row of account cards, square action buttons and a two-column transactions area." },
  { key: "multi_account", title: "Multi-Account Summary", desc: "Mobile-first account summaries with a gradient dropdown, Accounts/Cards tabs and a fixed bottom navigation bar." },
  { key: "secure_tools", title: "Secure Banking Tools", desc: "Clean utility strip with secure-tools banner, a solid balance card, pill actions and a compact transactions table." },
  { key: "rewards", title: "Preferred Rewards", desc: "Mobile-first rewards dashboard with profile header, search, Banking/Credit Cards accordions and a bottom tab bar." },
  { key: "neo", title: "Modern Neo-Bank", desc: "Mobile-first neo-bank style with greeting header, wave-pattern card, circular actions and a minimal bottom bar." },
];

function DashboardStylePanel({
  draftId,
  manifest,
  branding,
  current,
  primaryColor,
  secondaryColor,
  onSaved,
}: {
  draftId: string;
  manifest: WebsiteManifest | null;
  branding: Record<string, unknown> | null;
  current: LayoutKey;
  primaryColor: string;
  secondaryColor: string;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<LayoutKey>(current);
  const updateFn = useServerFn(updateDraft);

  const saveMut = useMutation({
    mutationFn: async () => {
      const patch: Record<string, unknown> = {
        branding: {
          ...(branding ?? {}),
          portal_layout_key: selected,
        },
      };
      if (manifest) {
        patch.manifest = {
          ...manifest,
          portal_layout_key: selected,
          dashboard_layout: getDashboardLayoutForKey(selected),
        };
      }
      return updateFn({ data: { id: draftId, patch } });
    },
    onSuccess: () => {
      toast.success("Dashboard layout saved");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-4 w-4" /> Dashboard Layout
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-xs text-muted-foreground">
          Choose the portal layout for this bank's customer dashboard.
          Each layout changes the sidebar style, navigation order, and the
          sections shown on the dashboard.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {LAYOUT_OPTIONS.map((opt) => {
            const active = selected === opt.key;
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => setSelected(opt.key)}
                className={`flex flex-col overflow-hidden rounded-xl border text-left transition ${
                  active ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/60"
                }`}
              >
                <LayoutThumb layout={opt.key} primaryColor={primaryColor} secondaryColor={secondaryColor} />
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{opt.title}</div>
                    {active && <Badge variant="default" className="text-[10px]">Selected</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || selected === current}>
            {saveMut.isPending ? "Saving…" : "Save Layout"}
          </Button>
          {selected !== current && (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            Changes apply instantly to the live customer portal.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function LayoutThumb({
  layout,
  primaryColor,
  secondaryColor,
}: {
  layout: LayoutKey;
  primaryColor: string;
  secondaryColor: string;
}) {
  const bar = (w: string, c?: string) => <div className={`h-1.5 rounded ${w}`} style={{ backgroundColor: c ?? "#e2e8f0" }} />;
  switch (layout) {
    case "traditional":
      return (
        <div className="flex h-24 w-full flex-col bg-white">
          <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ backgroundColor: primaryColor }}>
            <div className="h-2.5 w-2.5 rounded-sm bg-white/80" />
            <div className="h-1.5 flex-1 rounded bg-white/50" />
          </div>
          <div className="flex gap-1.5 p-2">
            <div className="flex-1">
              <div className="mb-1.5 h-4 rounded" style={{ backgroundColor: primaryColor }} />
              <div className="flex gap-1">
                <div className="h-5 flex-1 rounded bg-slate-100" />
                <div className="h-5 flex-1 rounded bg-slate-100" />
              </div>
            </div>
            <div className="w-1/3 space-y-1.5">
              {bar("w-full")} {bar("w-full")}
            </div>
          </div>
        </div>
      );
    case "multi_account":
      return (
        <div className="flex h-24 w-full flex-col bg-white">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="h-3.5 w-3.5 rounded-full bg-slate-200" />
            <div className="h-1.5 w-10 rounded bg-slate-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
          <div className="mx-2 flex gap-1.5">
            {[primaryColor, secondaryColor].map((c, i) => (
              <div key={i} className="h-6 flex-1 rounded" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="mt-1.5 flex items-center justify-around border-t px-2 py-1">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-2 w-3 rounded bg-slate-200" />)}
          </div>
        </div>
      );
    case "secure_tools":
      return (
        <div className="flex h-24 w-full flex-col bg-white">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="h-1.5 w-14 rounded bg-slate-200" />
            <div className="h-1.5 w-6 rounded bg-slate-300" />
          </div>
          <div className="mx-2 rounded px-2 py-1.5" style={{ backgroundColor: primaryColor }}>
            <div className="h-1.5 w-12 rounded bg-white/60" />
            <div className="mt-1 h-2.5 w-16 rounded bg-white" />
          </div>
          <div className="flex gap-1 p-2">
            {[0, 1, 2].map((i) => <div key={i} className="h-3 flex-1 rounded-full bg-slate-200" />)}
          </div>
        </div>
      );
    case "rewards":
      return (
        <div className="flex h-24 w-full flex-col bg-white">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="h-2 w-2.5 rounded bg-slate-300" />
            <div className="flex gap-1">
              <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
              <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
            </div>
            <div className="h-1.5 w-7 rounded bg-slate-200" />
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <div className="h-5 w-5 rounded-full" style={{ backgroundColor: primaryColor }} />
            <div className="h-1.5 w-14 rounded bg-slate-200" />
            <div className="ml-auto h-2.5 w-8 rounded" style={{ backgroundColor: primaryColor }} />
          </div>
          <div className="mt-1.5 space-y-1 px-2">
            {bar("w-full")} {bar("w-5/6")}
          </div>
          <div className="mt-auto flex items-center justify-around border-t px-2 py-1">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-2 w-3 rounded bg-slate-200" />)}
          </div>
        </div>
      );
    case "neo":
      return (
        <div className="flex h-24 w-full flex-col bg-white">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="h-1.5 w-12 rounded bg-slate-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
          </div>
          <div className="mx-2 rounded-md px-2 py-1.5 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
            <div className="h-1.5 w-10 rounded bg-white/60" />
            <div className="mt-1 h-2.5 w-14 rounded bg-white" />
          </div>
          <div className="flex justify-center gap-1 p-1.5">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-3 w-3 rounded-full border border-slate-200" />)}
          </div>
        </div>
      );
    case "sidebar":
    default:
      return (
        <div className="flex h-24 w-full bg-white">
          <div className="flex w-1/3 flex-col gap-1 border-r bg-slate-50 p-2">
            <div className="h-2 w-10 rounded" style={{ backgroundColor: primaryColor }} />
            <div className="h-2 rounded bg-slate-200" />
            <div className="h-2 rounded bg-slate-200" />
            <div className="h-2 rounded bg-slate-200" />
          </div>
          <div className="flex-1 p-2">
            <div className="h-2 w-16 rounded bg-slate-200" />
            <div className="mt-2 h-4 w-24 rounded bg-slate-300" />
            <div className="mt-2 flex gap-1">
              <div className="h-6 flex-1 rounded bg-slate-100" />
              <div className="h-6 flex-1 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      );
  }
}



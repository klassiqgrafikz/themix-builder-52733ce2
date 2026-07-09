import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  finalizeDraft,
  getDraft,
  listCountries,
  listModules,
  listTemplates,
} from "@/lib/bank-builder.functions";
import { publishDraft, unpublishDraft } from "@/lib/website/registry.functions";
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
import { RequireAuth } from "@/components/launch/require-auth";
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
} from "lucide-react";


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
    <RequireAuth>
      <BankOverview />
    </RequireAuth>
  );
}

function BankOverview() {
  const { id } = useParams({ from: "/banks/$id" });
  const navigate = useNavigate();
  const getDraftFn = useServerFn(getDraft);
  const listCountriesFn = useServerFn(listCountries);
  const listModulesFn = useServerFn(listModules);
  const listTemplatesFn = useServerFn(listTemplates);

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
                <Cpu className="h-4 w-4" /> Rendering Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Status" value={<RenderStatusBadge status={renderStatus} />} />
              <Row
                label="Rendered at"
                value={draft.rendered_at ? new Date(draft.rendered_at).toLocaleString() : "—"}
              />
              <Row
                label="Public website"
                value={<span className="text-muted-foreground">Not available yet</span>}
              />
              <p className="pt-2 text-xs text-muted-foreground">
                The publishing engine has not been implemented. The public website will
                become available after publishing is wired up.
              </p>
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

        <Card>
          <CardHeader><CardTitle>Rendering Logs</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No render has run yet.
              </div>
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
          </CardContent>
        </Card>
      </main>
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

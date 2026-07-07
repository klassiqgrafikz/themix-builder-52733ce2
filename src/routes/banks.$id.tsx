import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getDraft,
  listCountries,
  listModules,
  listTemplates,
} from "@/lib/bank-builder.functions";
import type {
  BankBranding,
  BankCountry,
  BankDraft,
  BankIdentity,
  BankModule,
  BankTemplate,
} from "@/lib/bank-builder.types";
import { RequireAuth } from "@/components/launch/require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Pencil, Eye, Users, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/banks/$id")({
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
  const url = identity.subdomain ? `${identity.subdomain}.themixweb.app` : null;
  const publicUrl = url ? `https://${url}` : null;
  const isPublished = draft.status === "saved";

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
                {url && <span className="font-mono">· {url}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={isPublished ? "Published" : "Draft"} />
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
            <CardHeader><CardTitle>Domain</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="font-mono">{url ?? "—"}</div>
              <div className="text-xs text-muted-foreground">
                {identity.currency ?? "—"} · {identity.language?.toUpperCase() ?? "—"} · {identity.timezone ?? "—"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
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

        <Card>
          <CardHeader><CardTitle>Manage this bank</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ActionButton
              icon={<Eye className="h-4 w-4" />}
              label="Preview"
              onClick={() => publicUrl && window.open(publicUrl, "_blank", "noopener")}
              disabled={!publicUrl}
            />
            <ActionButton
              icon={<Pencil className="h-4 w-4" />}
              label="Edit"
              onClick={() => navigate({ to: "/bank-builder", search: { draftId: id } })}
            />
            <ActionButton
              icon={<Users className="h-4 w-4" />}
              label="Manage Customers"
              onClick={() => navigate({ to: "/admin/$section", params: { section: "customers" } })}
            />
            <ActionButton
              icon={<BarChart3 className="h-4 w-4" />}
              label="Analytics"
              onClick={() => navigate({ to: "/admin" })}
            />
            <ActionButton
              icon={<ExternalLink className="h-4 w-4" />}
              label="Open Public Site"
              onClick={() => publicUrl && window.open(publicUrl, "_blank", "noopener")}
              disabled={!publicUrl}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: "Draft" | "Published" | "Suspended" }) {
  const styles: Record<string, string> = {
    Draft: "bg-muted text-foreground",
    Published: "bg-emerald-500 text-white hover:bg-emerald-500",
    Suspended: "bg-amber-500 text-white hover:bg-amber-500",
  };
  return <Badge className={styles[status]}>{status}</Badge>;
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button variant="outline" onClick={onClick} disabled={disabled} className="justify-start">
      <span className="mr-2 inline-flex">{icon}</span>
      {label}
    </Button>
  );
}

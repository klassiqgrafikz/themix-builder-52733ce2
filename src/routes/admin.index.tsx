import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listDrafts } from "@/lib/bank-builder.functions";
import { ADMIN_SECTIONS, type BankDraft } from "@/lib/bank-builder.types";
import { Card, CardContent } from "@/components/ui/card";
import * as Icons from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminOverview,
});

function AdminOverview() {
  const fn = useServerFn(listDrafts);
  const q = useQuery({ queryKey: ["bb-drafts"], queryFn: () => fn() });
  const drafts = (q.data as BankDraft[]) ?? [];
  const saved = drafts.filter((d) => d.status === "saved").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Global Administration</h1>
        <p className="mt-2 text-muted-foreground">
          One centralized control plane for every bank generated on TheMixWeb.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Generated banks" value={saved} />
        <StatCard label="Drafts in progress" value={drafts.length - saved} />
        <StatCard label="Total tenants" value={drafts.length} />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Tools</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_SECTIONS.map((s) => {
            const Icon =
              (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[s.icon] ??
              Icons.Circle;
            return (
              <Link key={s.slug} to="/admin/$section" params={{ section: s.slug }}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="font-medium">{s.label}</div>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

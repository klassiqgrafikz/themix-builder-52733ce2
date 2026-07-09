import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, Users, Wallet, Activity } from "lucide-react";

export const Route = createFileRoute("/gboc/")({
  component: GbocDashboard,
});

function GbocDashboard() {
  const listFn = useServerFn(gbocListBanks);
  const q = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => listFn() });
  const banks = q.data ?? [];
  const totals = banks.reduce(
    (acc, b) => {
      acc.customers += b.customer_count;
      acc.accounts += b.account_count;
      if (b.render_status === "published") acc.published += 1;
      return acc;
    },
    { customers: 0, accounts: 0, published: 0 },
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Global Banking Operations Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Centralized, tenant-aware operations for every generated bank. Select a bank to open the
          Operations Console.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard icon={Building2} label="Banks" value={banks.length} />
        <StatCard icon={Activity} label="Published" value={totals.published} />
        <StatCard icon={Users} label="Customers" value={totals.customers} />
        <StatCard icon={Wallet} label="Accounts" value={totals.accounts} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Bank selector
        </h2>
        {q.isLoading ? (
          <div className="p-8 text-sm text-muted-foreground">Loading banks…</div>
        ) : banks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              You haven't generated any banks yet.{" "}
              <Link to="/launch" className="underline">Launch your first bank</Link>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {banks.map((b) => (
              <Link
                key={b.id}
                to="/gboc/operations"
                search={{ bank: b.id } as never}
                className="group"
              >
                <Card className="transition group-hover:border-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {b.logo_url ? (
                        <img
                          src={b.logo_url}
                          alt=""
                          className="h-10 w-10 rounded object-contain"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
                          <Building2 className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="truncate font-semibold">{b.bank_name}</div>
                          <Badge variant={b.render_status === "published" ? "default" : "secondary"}>
                            {b.render_status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {b.blueprint ?? "custom"} · {b.country ?? "—"} · {b.currency ?? "USD"}
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{b.customer_count} customers</span>
                      <span>{b.account_count} accounts</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold leading-none">{value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

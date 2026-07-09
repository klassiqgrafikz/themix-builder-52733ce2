import { createFileRoute, useMatch } from "@tanstack/react-router";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";

export const Route = createFileRoute("/banks/$slug/portal/accounts")({
  component: AccountsPage,
});

function fmt(v: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

function AccountsPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const theme = manifest.theme;
  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
        >
          Accounts
        </h1>
        <p className="mt-1 text-sm opacity-80">
          Every customer of {manifest.bank.name} receives a default account on registration.
        </p>
      </div>
      <div className="space-y-3">
        {session.accounts.map((a) => (
          <BrandedCard key={a.id} manifest={manifest}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div
                  className="text-base font-semibold"
                  style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
                >
                  {a.account_name}
                </div>
                <div className="mt-1 text-xs opacity-70">
                  #{a.account_number} · {a.account_type} · {a.status}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase opacity-70">Available</div>
                <div
                  className="text-xl font-bold"
                  style={{ color: theme.colors.primary, fontFamily: theme.typography.heading }}
                >
                  {fmt(a.available_balance, a.currency)}
                </div>
                <div className="text-xs opacity-70">
                  Current {fmt(a.current_balance, a.currency)}
                </div>
              </div>
            </div>
          </BrandedCard>
        ))}
        {session.accounts.length === 0 && (
          <BrandedCard manifest={manifest}>
            <p className="text-sm opacity-70">No accounts yet.</p>
          </BrandedCard>
        )}
      </div>
    </div>
  );
}

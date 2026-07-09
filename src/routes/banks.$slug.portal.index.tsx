import { createFileRoute, Link, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { simulateVerifyEmail } from "@/lib/customer/customer.functions";
import {
  customerListNotifications,
  customerListRestrictions,
  customerListTransactions,
} from "@/lib/customer/activity.functions";
import { Button } from "@/components/ui/button";
import { Bell, HeadphonesIcon, PlusCircle, Send, ShieldAlert, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/banks/$slug/portal/")({
  component: DashboardPage,
});

function useParentData() {
  return useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
}

function fmt(v: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

function DashboardPage() {
  const { bank, session } = useParentData();
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const primary = theme.colors.primary;
  const primaryAccount = session.accounts[0];
  const currency = primaryAccount?.currency ?? manifest.bank.currency ?? "USD";
  const qc = useQueryClient();
  const doVerify = useServerFn(simulateVerifyEmail);
  const verifyMut = useMutation({
    mutationFn: () => doVerify({ data: { slug: bank.slug } }),
    onSuccess: () => {
      toast.success("Email verified (simulation)");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Verification failed"),
  });

  const txFn = useServerFn(customerListTransactions);
  const notifFn = useServerFn(customerListNotifications);
  const restrFn = useServerFn(customerListRestrictions);
  const txQ = useQuery({
    queryKey: ["portal-tx", bank.slug],
    queryFn: () => txFn({ data: { slug: bank.slug } }),
    refetchInterval: 15000,
  });
  const notifQ = useQuery({
    queryKey: ["portal-notif", bank.slug],
    queryFn: () => notifFn({ data: { slug: bank.slug } }),
    refetchInterval: 15000,
  });
  const restrQ = useQuery({
    queryKey: ["portal-restr", bank.slug],
    queryFn: () => restrFn({ data: { slug: bank.slug } }),
    refetchInterval: 30000,
  });
  const transactions = txQ.data ?? [];
  const notifications = notifQ.data ?? [];
  const restrictions = restrQ.data ?? [];

  return (
    <div className="space-y-6">
      <BrandedCard manifest={manifest} className="!p-8">
        <p className="text-xs uppercase tracking-widest" style={{ color: theme.colors.accent }}>
          Welcome back
        </p>
        <h1
          className="mt-1 text-3xl font-bold"
          style={{ fontFamily: theme.typography.heading, color: primary }}
        >
          Hello, {session.customer.first_name}.
        </h1>
        <p className="mt-2 text-sm opacity-80">
          You're signed in to your {manifest.bank.name} customer portal. Balances, transfers and
          statements will be enabled as banking modules go live.
        </p>
        {!session.customer.email_verified && (
          <div
            className="mt-4 flex flex-wrap items-center gap-3 rounded-md p-3 text-sm"
            style={{ backgroundColor: `${primary}12`, color: primary }}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Your email isn't verified yet.</span>
            <Button
              size="sm"
              disabled={verifyMut.isPending}
              onClick={() => verifyMut.mutate()}
              style={{ backgroundColor: theme.colors.accent }}
            >
              {verifyMut.isPending ? "Verifying…" : "Verify email (simulate)"}
            </Button>
          </div>
        )}
      </BrandedCard>

      {restrictions.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-md border p-3 text-sm"
          style={{ borderColor: "#f59e0b", backgroundColor: "#fef3c7", color: "#78350f" }}
        >
          <ShieldAlert className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-semibold">Your account has active restrictions</div>
            {restrictions.map((r) => (
              <div key={r.id} className="text-xs">
                {r.types.join(", ")} — {r.reason || "No reason provided"}
                {r.end_at ? ` (until ${new Date(r.end_at).toLocaleDateString()})` : ""}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <BrandedCard manifest={manifest}>
          <div className="text-xs uppercase opacity-70">Available balance</div>
          <div
            className="mt-1 text-3xl font-bold"
            style={{ fontFamily: theme.typography.heading, color: primary }}
          >
            {primaryAccount ? fmt(primaryAccount.available_balance, currency) : "—"}
          </div>
          <div className="mt-2 text-xs opacity-70">
            {primaryAccount ? `Acct •••• ${primaryAccount.account_number.slice(-4)}` : "No account"}
          </div>
        </BrandedCard>
        <BrandedCard manifest={manifest}>
          <div className="text-xs uppercase opacity-70">Current balance</div>
          <div
            className="mt-1 text-3xl font-bold"
            style={{ fontFamily: theme.typography.heading, color: primary }}
          >
            {primaryAccount ? fmt(primaryAccount.current_balance, currency) : "—"}
          </div>
          <div className="mt-2 text-xs opacity-70">Includes pending activity</div>
        </BrandedCard>
        <BrandedCard manifest={manifest}>
          <div className="text-xs uppercase opacity-70">Customer number</div>
          <div
            className="mt-1 text-lg font-semibold"
            style={{ fontFamily: theme.typography.heading, color: primary }}
          >
            {session.customer.customer_number}
          </div>
          <div className="mt-2 text-xs opacity-70">
            Status: <span className="font-medium">{session.customer.status}</span>
          </div>
        </BrandedCard>
      </div>

      <BrandedCard manifest={manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>
          Quick actions
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: Send, label: "Transfer" },
            { icon: PlusCircle, label: "Deposit" },
            { icon: Bell, label: "Alerts" },
            { icon: HeadphonesIcon, label: "Support" },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              disabled
              className="flex cursor-not-allowed flex-col items-center gap-2 rounded-xl p-4 text-sm opacity-70"
              style={{
                border: `1px dashed ${primary}44`,
                color: primary,
                backgroundColor: `${primary}08`,
              }}
              title="Coming soon"
            >
              <a.icon className="h-5 w-5" />
              {a.label}
            </button>
          ))}
        </div>
      </BrandedCard>

      <div className="grid gap-4 md:grid-cols-2">
        <BrandedCard manifest={manifest}>
          <div className="mb-2 text-sm font-semibold" style={{ color: primary }}>
            Recent transactions
          </div>
          <div className="rounded-md border border-dashed p-6 text-center text-sm opacity-70">
            No transactions yet. Activity will appear here once the transactions module is enabled.
          </div>
        </BrandedCard>
        <BrandedCard manifest={manifest}>
          <div className="mb-2 text-sm font-semibold" style={{ color: primary }}>
            Profile summary
          </div>
          <ul className="space-y-1.5 text-sm">
            <li>
              <span className="opacity-60">Name: </span>
              {session.customer.first_name} {session.customer.last_name}
            </li>
            <li>
              <span className="opacity-60">Email: </span>
              {session.customer.email}
            </li>
            <li>
              <span className="opacity-60">Phone: </span>
              {session.customer.phone ?? "—"}
            </li>
            <li>
              <span className="opacity-60">Country: </span>
              {session.customer.country ?? "—"}
            </li>
          </ul>
          <Link
            to="/banks/$slug/portal/profile"
            params={{ slug: bank.slug }}
            className="mt-3 inline-block text-sm underline"
            style={{ color: primary }}
          >
            Manage profile →
          </Link>
        </BrandedCard>
      </div>
    </div>
  );
}

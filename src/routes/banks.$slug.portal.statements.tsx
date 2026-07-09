import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { generateStatementCsv } from "@/lib/customer/transactions.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/banks/$slug/portal/statements")({
  component: StatementsPage,
});

function StatementsPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const [account, setAccount] = useState(session.accounts[0]?.id ?? "");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const doGen = useServerFn(generateStatementCsv);
  const mut = useMutation({
    mutationFn: (format: "csv" | "pdf") =>
      doGen({
        data: {
          slug: bank.slug,
          account_id: account,
          from: new Date(from).toISOString(),
          to: new Date(new Date(to).getTime() + 86400000).toISOString(),
        },
      }).then((r) => ({ ...r, format })),
    onSuccess: (r) => {
      if (r.format === "csv") {
        const blob = new Blob([r.csv], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = r.filename;
        a.click();
      } else {
        // Printable HTML window (browser Save as PDF)
        const w = window.open("", "_blank");
        if (!w) return;
        w.document.write(`<pre style="font-family:monospace">${r.csv.replace(/</g, "&lt;")}</pre>`);
        w.document.close();
        w.print();
      }
      toast.success("Statement generated");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Account statements</h1>
        <p className="mt-1 text-sm opacity-70">
          Generated directly from the Core Banking Engine ledger.
        </p>
      </BrandedCard>
      <BrandedCard manifest={bank.manifest}>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Account</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {session.accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={mut.isPending} onClick={() => mut.mutate("csv")} style={{ backgroundColor: primary }}>
            {mut.isPending ? "Generating…" : "Download CSV"}
          </Button>
          <Button variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("pdf")}>
            Print / Save PDF
          </Button>
        </div>
      </BrandedCard>
    </div>
  );
}

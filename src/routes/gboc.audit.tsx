import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { gbocListAudit, gbocListBanks } from "@/lib/gboc/operations.functions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const searchSchema = z.object({ bank: z.string().uuid().optional() });

export const Route = createFileRoute("/gboc/audit")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuditPage,
});

function AuditPage() {
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];
  const [bankId, setBankId] = useState<string>(Route.useSearch().bank ?? "");
  const listFn = useServerFn(gbocListAudit);
  const auditQ = useQuery({
    queryKey: ["gboc", "audit", bankId],
    enabled: !!bankId,
    queryFn: () => listFn({ data: { bank_id: bankId } }),
  });
  const rows = auditQ.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable trail of every operations action taken on this bank.
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <Select value={bankId} onValueChange={setBankId}>
            <SelectTrigger className="w-64 text-xs">
              <SelectValue placeholder={banks.length ? "Choose bank" : "No banks"} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            {auditQ.isFetching ? "Loading…" : `${rows.length} entries`}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Actor</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                    <td className="px-3 py-2 text-xs">{r.actor_email ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.reason ?? ""}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.reference ?? ""}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                      {bankId ? "No audit entries yet." : "Select a bank."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

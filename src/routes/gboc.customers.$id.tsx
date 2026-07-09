import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import { CustomerOperationsPanel } from "@/components/gboc/customer-ops-panel";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const searchSchema = z.object({
  bank: z.string().uuid(),
  tab: z.string().optional(),
});

export const Route = createFileRoute("/gboc/customers/$id")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CustomerProfilePage,
});

function CustomerProfilePage() {
  const { id } = Route.useParams();
  const { bank, tab } = Route.useSearch();
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const selected = banksQ.data?.find((b) => b.id === bank) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/gboc/customers"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All customers
        </Link>
        {selected && (
          <div className="ml-auto text-xs text-muted-foreground">
            {selected.bank_name} · {selected.country ?? "—"} · {selected.currency ?? "USD"}
          </div>
        )}
      </div>

      {!bank ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Missing bank context. Return to the customer list.
          </CardContent>
        </Card>
      ) : (
        <CustomerOperationsPanel
          bankId={bank}
          customerId={id}
          currency={selected?.currency ?? "USD"}
          defaultTab={tab ?? "profile"}
        />
      )}
    </div>
  );
}

import { createFileRoute, useParams, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ADMIN_SECTIONS } from "@/lib/bank-builder.types";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as Icons from "lucide-react";
import {
  adminSectionToGboc,
  useSelectedBankId,
} from "@/lib/admin/selected-bank";

export const Route = createFileRoute("/admin/$section")({
  component: AdminSection,
});

function AdminSection() {
  const { section } = useParams({ from: "/admin/$section" });
  const meta = ADMIN_SECTIONS.find((s) => s.slug === section);
  const [bankId, setBankId] = useSelectedBankId();
  const navigate = useNavigate();

  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];

  // If we have a bank selection and the section maps to a GBOC page,
  // hand off immediately so the user lands on the existing engine.
  useEffect(() => {
    if (!meta || !bankId) return;
    const target = adminSectionToGboc(meta.slug, bankId);
    if (!target) return;
    if (target.to === "/gboc/operations") {
      navigate({ to: target.to, search: target.search, replace: true });
    } else {
      navigate({ to: target.to, replace: true });
    }
  }, [meta, bankId, navigate]);

  if (!meta) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Unknown section</h1>
        <p className="text-muted-foreground">
          <Link to="/admin" className="underline">Return to overview</Link>
        </p>
      </div>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[meta.icon] ??
    Icons.Circle;

  const target = bankId ? adminSectionToGboc(meta.slug, bankId) : null;
  const isSimulation = meta.slug === "simulation";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{meta.label}</h1>
          <p className="mt-1 text-muted-foreground">{meta.description}</p>
        </div>
      </div>

      {isSimulation ? (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icons.Cpu className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-lg font-medium">Simulation Engine coming soon.</div>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              The Simulation Engine will live inside GBOC. Once available, this
              Admin entry will hand off directly to the GBOC implementation.
            </p>
          </CardContent>
        </Card>
      ) : !bankId ? (
        <Card>
          <CardContent className="space-y-4 p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Icons.Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="font-medium">Select a published bank to continue.</div>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {meta.label} is powered by the Global Banking Operations Center.
              Pick a bank to open the corresponding GBOC workspace.
            </p>
            <div className="mx-auto flex max-w-xs items-center gap-2">
              <Select
                value=""
                onValueChange={(id) => setBankId(id)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue
                    placeholder={
                      banksQ.isLoading
                        ? "Loading banks…"
                        : banks.length === 0
                          ? "No published banks yet"
                          : "Choose a bank…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Opening {meta.label} in the Global Banking Operations Center…
            {target && (
              <div className="mt-3">
                <Link
                  to={target.to}
                  search={target.to === "/gboc/operations" ? target.search : undefined}
                  className="text-primary underline"
                >
                  Continue
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

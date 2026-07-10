// GBOC Domain Manager (Phase 1) — persist a custom domain per generated bank.
// No DNS, SSL provisioning or routing changes. Existing URLs keep working.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import {
  getBankDomain,
  saveBankDomain,
  verifyBankDomain,
  removeBankDomain,
} from "@/lib/gboc/domains.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Globe, ShieldCheck, ShieldAlert, Clock, CalendarClock, Trash2 } from "lucide-react";

const searchSchema = z.object({ bank: z.string().uuid().optional() });

export const Route = createFileRoute("/gboc/domains")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Domain Manager — GBOC" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DomainManagerPage,
});

function DomainManagerPage() {
  const { bank } = Route.useSearch();
  const navigate = useNavigate();
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];
  const selectedBank = banks.find((b) => b.id === bank) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Domain Manager</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure a custom domain for each generated bank. Phase 1: persistence only.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <Label className="text-xs text-muted-foreground">Bank</Label>
          <Select
            value={bank ?? ""}
            onValueChange={(id) =>
              navigate({ to: "/gboc/domains", search: { bank: id || undefined } })
            }
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder={banks.length ? "Select a bank…" : "No published banks"} />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.bank_name}
                  {b.country ? ` · ${b.country}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedBank ? (
        <Card>
          <CardHeader>
            <CardTitle>Domain Manager</CardTitle>
            <CardDescription>
              Select a generated bank to begin managing its custom domain.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <DomainEditor bankId={selectedBank.id} bankName={selectedBank.bank_name} />
      )}
    </div>
  );
}

function DomainEditor({ bankId, bankName }: { bankId: string; bankName: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getBankDomain);
  const saveFn = useServerFn(saveBankDomain);
  const verifyFn = useServerFn(verifyBankDomain);
  const removeFn = useServerFn(removeBankDomain);

  const q = useQuery({
    queryKey: ["gboc", "domain", bankId],
    queryFn: () => getFn({ data: { bank_id: bankId } }),
  });

  const [domain, setDomain] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  useEffect(() => {
    setDomain(q.data?.domain ?? "");
    setIsPrimary(q.data?.is_primary ?? true);
  }, [q.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({ data: { bank_id: bankId, domain: domain.trim(), is_primary: isPrimary } }),
    onSuccess: () => {
      toast.success("Domain saved");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });
  const verifyMut = useMutation({
    mutationFn: () => verifyFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Domain verified");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Verification failed"),
  });
  const removeMut = useMutation({
    mutationFn: () => removeFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Domain removed");
      setDomain("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const row = q.data ?? null;
  const statusVariant =
    row?.status === "connected"
      ? "default"
      : row?.status === "error"
        ? "destructive"
        : "secondary";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Current Domain
          </CardTitle>
          <CardDescription>{bankName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoRow label="Current Domain" value={row?.domain ?? "—"} />
          <InfoRow label="Primary Domain" value={row?.is_primary ? "Yes" : row ? "No" : "—"} />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={statusVariant} className="capitalize">
              {row?.status ?? "not configured"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">SSL Status</span>
            <span className="flex items-center gap-1.5 capitalize">
              {row?.ssl_status === "active" ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              )}
              {row?.ssl_status ?? "inactive"}
            </span>
          </div>
          <InfoRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Last Verification"
            value={fmtDate(row?.last_verified_at)}
          />
          <InfoRow
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label="Connected Since"
            value={fmtDate(row?.connected_since)}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Configure Domain</CardTitle>
          <CardDescription>
            Save the custom domain for this bank. DNS and SSL setup arrive in a later phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!domain.trim()) {
                toast.error("Enter a domain");
                return;
              }
              saveMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="domain">Custom Domain</Label>
              <Input
                id="domain"
                autoComplete="off"
                spellCheck={false}
                placeholder="bank.example.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use a fully-qualified domain, e.g. <code>portal.mybank.com</code>.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
              />
              Set as primary domain
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={saveMut.isPending}>
                {saveMut.isPending ? "Saving…" : "Save Domain"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!row?.domain || verifyMut.isPending}
                onClick={() => verifyMut.mutate()}
              >
                {verifyMut.isPending ? "Verifying…" : "Verify Domain"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    disabled={!row?.domain || removeMut.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Domain
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove custom domain?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The custom domain configuration for <strong>{bankName}</strong> will be
                      deleted. Existing bank URLs are not affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeMut.mutate()}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

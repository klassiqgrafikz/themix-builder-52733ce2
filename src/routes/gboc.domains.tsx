// GBOC Domain Manager (Phase 2) — persist and verify custom domains via DNS.
// Adds DNS instructions, TXT-based verification and a permanent Lovable
// fallback URL. No SSL provisioning yet.
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
  type BankDomain,
  type DnsRecord,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  Clock,
  CalendarClock,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Info,
} from "lucide-react";

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
            Route each generated bank through its own verified custom domain. The
            original <code>.lovable.app</code> URL always keeps working as a fallback.
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

  const row: BankDomain | null = q.data ?? null;
  const [domain, setDomain] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);

  useEffect(() => {
    setDomain(row?.domain ?? "");
    setIsPrimary(row?.is_primary ?? true);
  }, [row?.domain, row?.is_primary]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({ data: { bank_id: bankId, domain: domain.trim(), is_primary: isPrimary } }),
    onSuccess: () => {
      toast.success("Domain saved. Add the DNS records below, then click Verify.");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });
  const verifyMut = useMutation({
    mutationFn: () => verifyFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Domain verified. Custom domain is now the primary route.");
      invalidate();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Verification failed");
      invalidate();
    },
  });
  const removeMut = useMutation({
    mutationFn: () => removeFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Custom domain removed. The fallback URL still works.");
      setDomain("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const verificationStatus = row?.dns_status ?? "pending";
  const domainSaved = Boolean(row?.domain);
  const isVerified = row?.status === "connected" && row?.dns_status === "verified";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Domain Overview
          </CardTitle>
          <CardDescription>{bankName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoRow label="Primary Domain" value={isVerified && row?.domain ? row.domain : "—"} />
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Lovable Fallback URL</span>
            {row?.fallback_url ? (
              <a
                href={row.fallback_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 truncate font-medium text-primary hover:underline"
                title={row.fallback_url}
              >
                <span className="truncate">{row.fallback_url.replace(/^https?:\/\//, "")}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : (
              <span className="font-medium">—</span>
            )}
          </div>
          <StatusRow label="Verification Status" value={verificationStatus} />
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
          <StatusRow label="DNS Status" value={verificationStatus} />
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

      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure Domain</CardTitle>
            <CardDescription>
              Save a custom domain, then publish the DNS records shown below at your
              registrar. Click <strong>Verify Domain</strong> once DNS has propagated.
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
                  Use a fully-qualified subdomain, e.g. <code>portal.mybank.com</code>.
                  Apex domain support arrives in a later phase.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                />
                Prefer this domain as the primary route once verified
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="submit" disabled={saveMut.isPending}>
                  {saveMut.isPending ? "Saving…" : "Save Domain"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!domainSaved || verifyMut.isPending}
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
                      disabled={!domainSaved || removeMut.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove Domain
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove custom domain?</AlertDialogTitle>
                      <AlertDialogDescription>
                        The custom domain for <strong>{bankName}</strong> will be
                        deleted. Your Lovable fallback URL keeps working.
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">DNS Instructions</CardTitle>
            <CardDescription>
              Add these records at your DNS provider. Values are the same for every
              provider — only the field labels differ.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {row?.dns_records?.length ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Type</TableHead>
                      <TableHead>Host</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="w-20">TTL</TableHead>
                      <TableHead className="w-24 text-right">Copy</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {row.dns_records.map((r, i) => (
                      <DnsRow key={`${r.type}-${i}`} record={r} />
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  DNS changes can take a few minutes to a few hours to propagate.
                  Re-run <strong>Verify Domain</strong> after publishing the records.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Save a custom domain to generate the DNS records for this bank.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DnsRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState<null | "host" | "value" | "row">(null);
  const copy = async (text: string, tag: "host" | "value" | "row") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1200);
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <TableRow>
      <TableCell>
        <Badge variant="secondary">{record.type}</Badge>
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => copy(record.host, "host")}
          className="group inline-flex max-w-[220px] items-center gap-1.5 truncate text-left font-mono text-xs hover:text-primary"
          title={`Copy ${record.host}`}
        >
          <span className="truncate">{record.host}</span>
          {copied === "host" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
          )}
        </button>
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={() => copy(record.value, "value")}
          className="group inline-flex max-w-[320px] items-center gap-1.5 truncate text-left font-mono text-xs hover:text-primary"
          title={`Copy ${record.value}`}
        >
          <span className="truncate">{record.value}</span>
          {copied === "value" ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <Copy className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100" />
          )}
        </button>
      </TableCell>
      <TableCell className="font-mono text-xs">{record.ttl}</TableCell>
      <TableCell className="text-right">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            copy(
              `${record.type}\t${record.host}\t${record.value}\t${record.ttl}`,
              "row",
            )
          }
        >
          {copied === "row" ? (
            <>
              <Check className="mr-1 h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </>
          )}
        </Button>
      </TableCell>
    </TableRow>
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

function StatusRow({ label, value }: { label: string; value: string }) {
  const variant: "default" | "secondary" | "destructive" =
    value === "verified"
      ? "default"
      : value === "failed"
        ? "destructive"
        : "secondary";
  const display =
    value === "verified" ? "Verified" : value === "failed" ? "Failed" : "Pending";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={variant}>{display}</Badge>
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

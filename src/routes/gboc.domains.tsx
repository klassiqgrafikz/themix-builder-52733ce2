// GBOC Domain Manager — production-grade custom domain management.
// Handles apex + subdomain setup, live DNS / SSL / routing diagnostics,
// auto-refresh while propagating, and detailed per-check error reporting.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import {
  getBankDomain,
  saveBankDomain,
  verifyBankDomain,
  removeBankDomain,
  diagnoseBankDomain,
  type BankDomain,
  type DnsRecord,
  type DomainDiagnostics,
  type DiagnosticCheck,
  type DiagnosticStatus,
} from "@/lib/gboc/domains.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Shield,
  Clock,
  CalendarClock,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Info,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Activity,
  Server,
  Route as RouteIcon,
  Timer,
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
            Connect apex or subdomains to any generated bank. Live DNS, SSL and
            routing diagnostics keep every custom domain healthy.
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

// -----------------------------------------------------------------------------
function DomainEditor({ bankId, bankName }: { bankId: string; bankName: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getBankDomain);
  const saveFn = useServerFn(saveBankDomain);
  const verifyFn = useServerFn(verifyBankDomain);
  const removeFn = useServerFn(removeBankDomain);
  const diagnoseFn = useServerFn(diagnoseBankDomain);

  const q = useQuery({
    queryKey: ["gboc", "domain", bankId],
    queryFn: () => getFn({ data: { bank_id: bankId } }),
  });

  const row: BankDomain | null = q.data ?? null;

  const [domain, setDomain] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [diagnostics, setDiagnostics] = useState<DomainDiagnostics | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setDomain(row?.domain ?? "");
    setIsPrimary(row?.is_primary ?? true);
    setDiagnostics(null);
    setLastCheckedAt(null);
  }, [bankId, row?.domain, row?.is_primary]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });

  const detectedKind = useMemo<"apex" | "subdomain" | null>(() => {
    if (!domain.trim()) return null;
    const labels = domain.trim().toLowerCase().split(".").filter(Boolean);
    if (labels.length <= 2) return "apex";
    const lastTwo = labels.slice(-2).join(".");
    const twoPart = new Set([
      "co.uk","org.uk","gov.uk","ac.uk","co.jp","or.jp","ne.jp","com.au",
      "net.au","org.au","com.br","com.mx","co.nz","co.za","co.in","co.kr",
      "com.sg","com.hk","com.tr","com.tw","com.cn","com.ar","com.co",
    ]);
    if (twoPart.has(lastTwo) && labels.length === 3) return "apex";
    return "subdomain";
  }, [domain]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({ data: { bank_id: bankId, domain: domain.trim(), is_primary: isPrimary } }),
    onSuccess: () => {
      toast.success("Domain saved. Publish the DNS records below, then Verify.");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const verifyMut = useMutation({
    mutationFn: () => verifyFn({ data: { bank_id: bankId } }),
    onSuccess: (res) => {
      setDiagnostics(res.diagnostics);
      setLastCheckedAt(Date.now());
      if (res.diagnostics.overall === "verified") {
        toast.success("Domain verified. Custom domain is live.");
      } else if (res.diagnostics.overall === "propagating") {
        toast.info("DNS is still propagating. We'll auto-recheck every 60s.");
      } else {
        toast.error("Verification failed. See the diagnostics below.");
      }
      invalidate();
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Verification failed");
      invalidate();
    },
  });

  const diagnoseMut = useMutation({
    mutationFn: () => diagnoseFn({ data: { bank_id: bankId } }),
    onSuccess: (res) => {
      setDiagnostics(res);
      setLastCheckedAt(Date.now());
    },
  });

  const removeMut = useMutation({
    mutationFn: () => removeFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Custom domain removed. The fallback URL still works.");
      setDomain("");
      setDiagnostics(null);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const domainSaved = Boolean(row?.domain);
  const propagating = diagnostics?.overall === "propagating" || row?.dns_status === "propagating";

  // Auto-refresh while propagating.
  useEffect(() => {
    if (!domainSaved || !propagating) return;
    const id = window.setInterval(() => diagnoseMut.mutate(), 60_000);
    return () => window.clearInterval(id);
  }, [domainSaved, propagating, diagnoseMut]);

  // Ticking clock for "Last checked: Xs ago".
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  void tick;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <OverviewCard bankName={bankName} row={row} diagnostics={diagnostics} />
        <HealthCard
          diagnostics={diagnostics}
          row={row}
          lastCheckedAt={lastCheckedAt}
          onRecheck={() => diagnoseMut.mutate()}
          isChecking={diagnoseMut.isPending || verifyMut.isPending}
          canRecheck={domainSaved}
        />
        <DiagnosticsCard diagnostics={diagnostics} row={row} />
      </div>

      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configure Domain</CardTitle>
            <CardDescription>
              Enter an apex domain (<code>example.com</code>) or a subdomain
              (<code>portal.example.com</code>). We'll generate the correct DNS
              records for you.
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
                <div className="flex gap-2">
                  <Input
                    id="domain"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="portal.example.com or example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                  {detectedKind && (
                    <Badge variant="outline" className="shrink-0 self-center capitalize">
                      {detectedKind}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {detectedKind === "apex"
                    ? "Apex domains use A records that point to TheMixWeb's edge."
                    : detectedKind === "subdomain"
                      ? "Subdomains use a CNAME to themix-builder.lovable.app."
                      : "We auto-detect apex vs subdomain and generate the right records."}
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
                  {verifyMut.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" /> Verify Domain
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!domainSaved || diagnoseMut.isPending}
                  onClick={() => diagnoseMut.mutate()}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${diagnoseMut.isPending ? "animate-spin" : ""}`}
                  />
                  Force Recheck
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

        <DiagnosticsBreakdown diagnostics={diagnostics} />

        <DnsInstructionsCard row={row} />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
function OverviewCard({
  bankName,
  row,
  diagnostics,
}: {
  bankName: string;
  row: BankDomain | null;
  diagnostics: DomainDiagnostics | null;
}) {
  const verified = row?.status === "connected" && row?.dns_status === "verified";
  const ssl = row?.ssl_status ?? "inactive";
  const dnsStatus = diagnostics?.overall ?? row?.dns_status ?? "not_configured";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" /> Domain Overview
        </CardTitle>
        <CardDescription>{bankName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <InfoRow label="Primary Domain" value={verified && row?.domain ? row.domain : "—"} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Fallback URL</span>
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
        <StatusRow label="Verification" value={verified ? "verified" : dnsStatus} />
        <StatusRow label="DNS Status" value={dnsStatus} />
        <SslRow ssl={ssl} />
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
  );
}

function HealthCard({
  diagnostics,
  row,
  lastCheckedAt,
  onRecheck,
  isChecking,
  canRecheck,
}: {
  diagnostics: DomainDiagnostics | null;
  row: BankDomain | null;
  lastCheckedAt: number | null;
  onRecheck: () => void;
  isChecking: boolean;
  canRecheck: boolean;
}) {
  const cards: Array<{ label: string; status: DiagnosticStatus; icon: React.ReactNode; hint: string }> = [
    {
      label: "DNS",
      status: statusFromCheck(diagnostics, ["cname", "a"]),
      icon: <Server className="h-3.5 w-3.5" />,
      hint: row?.dns_status ?? "not_configured",
    },
    {
      label: "SSL",
      status: sslToStatus(row?.ssl_status),
      icon: <Shield className="h-3.5 w-3.5" />,
      hint: row?.ssl_status ?? "inactive",
    },
    {
      label: "HTTPS",
      status: statusFromCheck(diagnostics, ["https"]),
      icon: <Activity className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.https_status ? `${diagnostics.meta.https_status}` : "—",
    },
    {
      label: "HTTP",
      status: statusFromCheck(diagnostics, ["http"]),
      icon: <Activity className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.http_status ? `${diagnostics.meta.http_status}` : "—",
    },
    {
      label: "Routing",
      status: statusFromCheck(diagnostics, ["routing"]),
      icon: <RouteIcon className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.routing_active ? "active" : "—",
    },
    {
      label: "TXT",
      status: statusFromCheck(diagnostics, ["txt"]),
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      hint: diagnostics?.meta.txt_records.length ? "present" : "—",
    },
  ];
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">Connection Health</CardTitle>
          <CardDescription>
            {lastCheckedAt ? (
              <>Last checked {formatAgo(lastCheckedAt)}</>
            ) : (
              "Run Verify or Force Recheck to gather live status."
            )}
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRecheck}
          disabled={!canRecheck || isChecking}
          title="Force Recheck"
        >
          <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {diagnostics ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Propagation</span>
              <span>{diagnostics.meta.propagation_percent}%</span>
            </div>
            <Progress value={diagnostics.meta.propagation_percent} />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {cards.map((c) => (
            <HealthPill key={c.label} {...c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthPill({
  label,
  status,
  icon,
  hint,
}: {
  label: string;
  status: DiagnosticStatus;
  icon: React.ReactNode;
  hint: string;
}) {
  const color =
    status === "pass"
      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      : status === "fail"
        ? "border-destructive/40 bg-destructive/5 text-destructive"
        : status === "warn"
          ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          : "border-muted bg-muted/30 text-muted-foreground";
  return (
    <div className={`rounded-md border px-2.5 py-2 ${color}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label}
        <StatusDot status={status} />
      </div>
      <div className="mt-0.5 truncate text-[11px] opacity-80" title={hint}>
        {hint}
      </div>
    </div>
  );
}

function DiagnosticsCard({
  diagnostics,
  row,
}: {
  diagnostics: DomainDiagnostics | null;
  row: BankDomain | null;
}) {
  if (!diagnostics && !row?.domain) return null;
  const meta = diagnostics?.meta;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform Diagnostics</CardTitle>
        <CardDescription>Live resolver + reachability data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <InfoRow label="Domain type" value={diagnostics?.domain_kind ?? row?.domain_kind ?? "—"} />
        <InfoRow
          label="Resolved A"
          value={meta?.resolved_a.length ? meta.resolved_a.join(", ") : "—"}
        />
        <InfoRow
          label="Resolved CNAME"
          value={meta?.resolved_cname.length ? meta.resolved_cname.join(", ") : "—"}
        />
        <InfoRow
          label="TXT Verification"
          value={meta?.txt_records.length ? "Present" : "—"}
        />
        <InfoRow label="TTL" value={meta?.ttl ? `${meta.ttl}s` : "—"} />
        <InfoRow
          icon={<Timer className="h-3.5 w-3.5" />}
          label="Response time"
          value={meta?.response_time_ms != null ? `${meta.response_time_ms} ms` : "—"}
        />
        <InfoRow
          label="HTTP / HTTPS"
          value={`${meta?.http_status ?? "—"} / ${meta?.https_status ?? "—"}`}
        />
        <InfoRow label="Routing active" value={meta?.routing_active ? "Yes" : "No"} />
      </CardContent>
    </Card>
  );
}

function DiagnosticsBreakdown({ diagnostics }: { diagnostics: DomainDiagnostics | null }) {
  if (!diagnostics) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verification Checks</CardTitle>
        <CardDescription>
          Detailed per-check results from the last DNS + reachability probe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {diagnostics.checks.map((c) => (
          <CheckRow key={c.key} check={c} />
        ))}
      </CardContent>
    </Card>
  );
}

function CheckRow({ check }: { check: DiagnosticCheck }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <StatusDot status={check.status} />
        {check.label}
        <Badge variant="outline" className="ml-auto capitalize">
          {check.status}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{check.message}</p>
      {(check.expected?.length || check.found?.length) ? (
        <div className="mt-2 grid gap-1 text-xs font-mono">
          {check.expected?.length ? (
            <div>
              <span className="text-muted-foreground">Expected: </span>
              {check.expected.join(", ")}
            </div>
          ) : null}
          {check.found?.length ? (
            <div>
              <span className="text-muted-foreground">Found: </span>
              {check.found.join(", ")}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DnsInstructionsCard({ row }: { row: BankDomain | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">DNS Instructions</CardTitle>
        <CardDescription>
          {row?.domain_kind === "apex"
            ? "Apex domain — add these A records plus the TXT verification record."
            : row?.domain_kind === "subdomain"
              ? "Subdomain — add the CNAME plus the TXT verification record."
              : "Save a domain to generate the right DNS records."}
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
              After publishing the records, use <strong>Verify Domain</strong> or
              <strong> Force Recheck</strong>. We auto-recheck every 60s while
              propagating.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Save a custom domain to generate the DNS records for this bank.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
function DnsRow({ record }: { record: DnsRecord }) {
  const [copied, setCopied] = useState<null | "host" | "value" | "row">(null);
  const copy = async (text: string, tag: "host" | "value" | "row") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      toast.success("Copied!");
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

// -----------------------------------------------------------------------------
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
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="max-w-[60%] truncate text-right font-medium" title={value}>
        {value}
      </span>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  const v = value.toLowerCase();
  const variant: "default" | "secondary" | "destructive" =
    v === "verified" || v === "connected"
      ? "default"
      : v === "failed" || v === "incorrect" || v === "error"
        ? "destructive"
        : "secondary";
  const display =
    v === "verified" || v === "connected"
      ? "Verified"
      : v === "failed" || v === "incorrect"
        ? "Failed"
        : v === "propagating"
          ? "Propagating"
          : v === "not_configured"
            ? "Not configured"
            : "Pending";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={variant}>{display}</Badge>
    </div>
  );
}

function SslRow({ ssl }: { ssl: string }) {
  const icon =
    ssl === "active" ? (
      <ShieldCheck className="h-4 w-4 text-emerald-600" />
    ) : ssl === "error" || ssl === "expired" ? (
      <ShieldAlert className="h-4 w-4 text-destructive" />
    ) : (
      <Shield className="h-4 w-4 text-muted-foreground" />
    );
  const hint =
    ssl === "active"
      ? "Certificate active."
      : ssl === "issuing" || ssl === "requesting" || ssl === "pending"
        ? "Being issued — usually 5–30 min after DNS propagation."
        : ssl === "expired"
          ? "Certificate expired — recheck to reissue."
          : ssl === "error"
            ? "Issuance failed — check DNS."
            : "SSL inactive until the domain is verified.";
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">SSL Status</span>
      <span className="flex items-center gap-1.5 text-right capitalize" title={hint}>
        {icon}
        {ssl}
      </span>
    </div>
  );
}

function StatusDot({ status }: { status: DiagnosticStatus }) {
  if (status === "pass") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function statusFromCheck(
  diagnostics: DomainDiagnostics | null,
  keys: string[],
): DiagnosticStatus {
  if (!diagnostics) return "pending";
  for (const k of keys) {
    const c = diagnostics.checks.find((x) => x.key === k);
    if (c) return c.status;
  }
  return "pending";
}

function sslToStatus(ssl: string | undefined): DiagnosticStatus {
  if (ssl === "active") return "pass";
  if (ssl === "error" || ssl === "expired") return "fail";
  if (ssl === "issuing" || ssl === "requesting" || ssl === "pending") return "warn";
  return "pending";
}

function fmtDate(v: string | null | undefined): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function formatAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

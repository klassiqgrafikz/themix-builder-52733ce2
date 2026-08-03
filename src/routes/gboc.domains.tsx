import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { gbocListBanks } from "@/lib/gboc/operations.functions";
import {
  getBankDomain,
  saveBankDomain,
  removeBankDomain,
  connectBankDomain,
  diagnoseBankDomain,
  type BankDomain,
  type DomainDiagnostics,
} from "@/lib/gboc/domains.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  CheckCircle2,
  Trash2,
  Loader2,
  Copy,
  Check,
  Building2,
  ChevronRight,
  ArrowLeft,
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

const DNS_TARGET = "cname.vercel-dns.com";
const PLATFORM_A_RECORDS = ["76.76.21.21"];

function DomainManagerPage() {
  const { bank } = Route.useSearch();
  const navigate = useNavigate();
  const banksFn = useServerFn(gbocListBanks);
  const banksQ = useQuery({ queryKey: ["gboc", "banks"], queryFn: () => banksFn() });
  const banks = banksQ.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Domain Manager</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a domain you already own to any generated bank.
        </p>
      </div>

      <ConnectFlow
        bankParam={bank}
        banks={banks}
        banksLoading={banksQ.isLoading}
        onSelectBank={(id) => navigate({ to: "/gboc/domains", search: { bank: id || undefined } })}
      />
    </div>
  );
}

function ConnectFlow({
  bankParam,
  banks,
  banksLoading,
  onSelectBank,
}: {
  bankParam: string | undefined;
  banks: Array<{ id: string; bank_name: string; country?: string | null }>;
  banksLoading: boolean;
  onSelectBank: (id: string) => void;
}) {
  const selectedBank = banks.find((b) => b.id === bankParam) ?? null;

  if (!selectedBank) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Select a bank
          </CardTitle>
          <CardDescription>Choose which bank to connect a custom domain to.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label className="text-xs text-muted-foreground">Bank</Label>
            <Select value="" onValueChange={onSelectBank}>
              <SelectTrigger className="h-10">
                <SelectValue
                  placeholder={
                    banksLoading ? "Loading banks…" : banks.length ? "Select a bank…" : "No banks yet"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {banks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bank_name}{b.country ? ` · ${b.country}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <DomainEditor bankId={selectedBank.id} bankName={selectedBank.bank_name} onChangeBank={() => onSelectBank("")} />;
}

function DomainEditor({
  bankId,
  bankName,
  onChangeBank,
}: {
  bankId: string;
  bankName: string;
  onChangeBank: () => void;
}) {
  const qc = useQueryClient();
  const getFn = useServerFn(getBankDomain);
  const saveFn = useServerFn(saveBankDomain);
  const removeFn = useServerFn(removeBankDomain);
  const connectFn = useServerFn(connectBankDomain);
  const diagnoseFn = useServerFn(diagnoseBankDomain);

  const q = useQuery({
    queryKey: ["gboc", "domain", bankId],
    queryFn: () => getFn({ data: { bank_id: bankId } }),
  });

  const row: BankDomain | null = q.data ?? null;
  const [domain, setDomain] = useState(row?.domain ?? "");
  const [isPrimary, setIsPrimary] = useState(row?.is_primary ?? true);
  const [lastDiagnostics, setLastDiagnostics] = useState<DomainDiagnostics | null>(null);
  const [vercelStatus, setVercelStatus] = useState<string | null>(null);
  const [vercelRecords, setVercelRecords] = useState<Array<{ type: string; value: string }>>([]);

  const saveMut = useMutation({
    mutationFn: () => saveFn({ data: { bank_id: bankId, domain: domain.trim(), is_primary: isPrimary } }),
    onSuccess: () => {
      toast.success("Domain saved");
      qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const connectMut = useMutation({
    mutationFn: () => connectFn({ data: { bank_id: bankId } }),
    onSuccess: (r) => {
      setLastDiagnostics(r.diagnostics);
      const vercelStatus = r.vercel?.status ?? "valid";
      setVercelStatus(vercelStatus);
      setVercelRecords(
        (r.vercel?.verification ?? []).map((v) => ({ type: v.type, value: v.value })),
      );
      toast.success(
        vercelStatus === "valid"
          ? "Domain connected to Vercel!"
          : "Domain attached — Vercel is verifying DNS (pending).",
      );
      qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to connect"),
  });

  const diagnoseMut = useMutation({
    mutationFn: () => diagnoseFn({ data: { bank_id: bankId } }),
    onSuccess: (r) => {
      if (r) setLastDiagnostics(r);
      else toast.error("Save a domain before diagnosing");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Diagnostics failed"),
  });

  const removeMut = useMutation({
    mutationFn: () => removeFn({ data: { bank_id: bankId } }),
    onSuccess: () => {
      toast.success("Domain removed");
      setDomain("");
      setLastDiagnostics(null);
      setVercelStatus(null);
      setVercelRecords([]);
      qc.invalidateQueries({ queryKey: ["gboc", "domain", bankId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to remove"),
  });

  const connected = row?.status === "connected";
  const domainSaved = Boolean(row?.domain);
  const kind = row?.domain_kind ?? detectKind(domain);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" className="-ml-2" onClick={onChangeBank}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Change bank
            </Button>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{bankName}</span>
            {row?.domain ? (
              <Badge variant={connected ? "default" : "secondary"} className="capitalize">
                {connected ? <CheckCircle2 className="mr-1 h-3 w-3" /> : null}
                {connected ? "Connected" : "Not connected"}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {/* Domain input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domain</CardTitle>
          <CardDescription>
            Enter a domain you own (e.g. <code>mybank.com</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!domain.trim()) { toast.error("Enter a domain"); return; }
              saveMut.mutate();
            }}
          >
            <div className="flex gap-2">
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mybank.com"
                className="flex-1"
              />
              <Button type="submit" disabled={saveMut.isPending || !domain.trim()}>
                {saveMut.isPending ? "Saving…" : domainSaved ? "Update" : "Save"}
              </Button>
            </div>
          </form>

          {domainSaved && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending || connected}
              >
                {connectMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {connected ? "Connected" : "Mark as Connected"}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive hover:text-destructive" disabled={removeMut.isPending}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove custom domain?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The custom domain for <strong>{bankName}</strong> will be removed. The fallback URL still works.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeMut.mutate()}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DNS Instructions */}
      {domainSaved && row?.domain && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DNS Records</CardTitle>
            <CardDescription>
              Add these records at your domain registrar (GoDaddy, Namecheap, etc.) so the domain points at the platform's hosting (Vercel). The bank will start working at <strong>{row.domain}</strong> once DNS propagates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <DnsRecordRow
              type="TXT"
              host="_themix"
              value={`themix-verify=${row.verification_token ?? row.id.replace(/-/g, "")}`}
              purpose="Proves domain ownership (optional)"
            />
            {kind === "apex" ? (
              <>
                <DnsRecordRow type="A" host="@" value={PLATFORM_A_RECORDS[0]} purpose="Points apex to the hosting edge" />
                <DnsRecordRow type="CNAME" host="www" value={DNS_TARGET} purpose="Redirects www to your domain" />
              </>
            ) : (
              <DnsRecordRow type="CNAME" host="@" value={DNS_TARGET} purpose="Points subdomain to your bank" />
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              After adding the records, click <strong>"Mark as Connected"</strong> — it attaches the domain to the hosting project and checks the live DNS. Propagation can take a few minutes to a few hours.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {row?.domain && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Domain</span>
              <span className="font-medium">{row.domain}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={connected ? "default" : "secondary"}>{connected ? "Connected" : "Pending"}</Badge>
            </div>
            {vercelStatus && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vercel</span>
                <Badge variant={vercelStatus === "valid" ? "default" : "secondary"} className="capitalize">
                  {vercelStatus === "valid" ? "Valid" : "Pending DNS"}
                </Badge>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fallback URL</span>
              <span className="font-mono text-xs">{row.fallback_url}</span>
            </div>
            {row.connected_since && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Connected since</span>
                <span>{new Date(row.connected_since).toLocaleDateString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diagnostics */}
      {domainSaved && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Live diagnostics</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => diagnoseMut.mutate()}
              disabled={diagnoseMut.isPending}
            >
              {diagnoseMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Re-check
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {!lastDiagnostics && (
              <p className="text-sm text-muted-foreground">
                Click "Mark as Connected" or "Re-check" to run live DNS + HTTPS checks.
              </p>
            )}
            {lastDiagnostics?.checks.map((c) => (
              <div key={c.key} className="flex items-start justify-between gap-2 text-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                        c.status === "pass"
                          ? "bg-emerald-500"
                          : c.status === "fail"
                            ? "bg-destructive"
                            : c.status === "warn"
                              ? "bg-amber-500"
                              : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="font-medium">{c.label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.message}</p>
                </div>
                <span className="shrink-0 text-xs uppercase text-muted-foreground">{c.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DnsRecordRow({ type, host, value, purpose }: { type: string; host: string; value: string; purpose: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">{type}</Badge>
            <span className="font-mono text-xs">{host}</span>
          </div>
          <p className="font-mono text-xs break-all">{value}</p>
          <p className="text-xs text-muted-foreground">{purpose}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function detectKind(domain: string): "apex" | "subdomain" | null {
  const d = domain.toLowerCase().trim();
  if (!d) return null;
  const labels = d.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  if (labels.length <= 2) return "apex";
  const twoPart = new Set(["co.uk","org.uk","gov.uk","ac.uk","co.jp","or.jp","ne.jp","com.au","net.au","org.au","com.br","com.mx","co.nz","co.za","co.in","co.kr","com.sg","com.hk","com.tr","com.tw","com.cn","com.ar","com.co"]);
  if (twoPart.has(labels.slice(-2).join(".")) && labels.length === 3) return "apex";
  return "subdomain";
}

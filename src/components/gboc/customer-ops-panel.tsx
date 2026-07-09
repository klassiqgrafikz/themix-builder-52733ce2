// Shared GBOC customer operations panel. Extracted from gboc.operations.tsx so
// both the Operations Console and the Customer Profile page can render the
// exact same workflows without duplicating logic. All calls go through the
// existing server functions — no banking logic lives in this file.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  gbocAccountAction,
  gbocBalanceOperation,
  gbocCreateTransaction,
  gbocGetCustomer,
  gbocSetRestriction,
} from "@/lib/gboc/operations.functions";
import {
  ACCOUNT_ACTIONS,
  BALANCE_OPS,
  RESTRICTION_TYPES,
  TRANSACTION_KINDS,
  type GbocAccount,
  type GbocCustomerDetail,
} from "@/lib/gboc/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldAlert } from "lucide-react";

export function fmtCurrency(v: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

function useInvalidate(bankId: string, customerId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["gboc", "customer", bankId, customerId] });
    qc.invalidateQueries({ queryKey: ["gboc", "customers", bankId] });
    qc.invalidateQueries({ queryKey: ["gboc", "audit", bankId] });
  };
}

export function CustomerOperationsPanel({
  bankId,
  customerId,
  currency,
  defaultTab = "profile",
}: {
  bankId: string;
  customerId: string;
  currency: string;
  defaultTab?: string;
}) {
  const getFn = useServerFn(gbocGetCustomer);
  const q = useQuery({
    queryKey: ["gboc", "customer", bankId, customerId],
    queryFn: () => getFn({ data: { bank_id: bankId, customer_id: customerId } }),
  });
  const detail = q.data;
  const [accountId, setAccountId] = useState<string | null>(null);
  const account = useMemo(() => {
    if (!detail) return null;
    return detail.accounts.find((a) => a.id === accountId) ?? detail.accounts[0] ?? null;
  }, [detail, accountId]);

  if (q.isLoading || !detail) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-muted-foreground">Loading customer…</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-lg font-semibold">
                  {detail.customer.first_name} {detail.customer.last_name}
                </h2>
                <Badge variant={detail.customer.status === "active" ? "default" : "secondary"}>
                  {detail.customer.status}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {detail.customer.email} · {detail.customer.customer_number}
                {detail.customer.phone ? ` · ${detail.customer.phone}` : ""}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Last login:{" "}
                {detail.customer.last_login_at
                  ? new Date(detail.customer.last_login_at).toLocaleString()
                  : "—"}
              </div>
            </div>
            <div className="min-w-[220px]">
              <Label className="text-xs">Account</Label>
              <Select value={account?.id ?? undefined} onValueChange={(v) => setAccountId(v)}>
                <SelectTrigger className="mt-1 h-9 text-xs">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {detail.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.account_name} · •••• {a.account_number.slice(-4)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {account && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Current" value={fmtCurrency(account.current_balance, account.currency)} />
              <MiniStat label="Available" value={fmtCurrency(account.available_balance, account.currency)} />
              <MiniStat label="Status" value={account.status} />
            </div>
          )}
          {detail.restrictions.some((r) => r.active) && (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <ShieldAlert className="mt-0.5 h-4 w-4" />
              <div>
                <div className="font-semibold">Active restrictions</div>
                {detail.restrictions
                  .filter((r) => r.active)
                  .map((r) => (
                    <div key={r.id}>
                      {r.types.join(", ")} — {r.reason || "No reason provided"}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {account && (
        <Tabs defaultValue={defaultTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="balance">Balance</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="restrictions">Restrictions</TabsTrigger>
            <TabsTrigger value="transactions">New Transaction</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="profile">
            <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
                <Info label="Full name" value={`${detail.customer.first_name} ${detail.customer.last_name}`} />
                <Info label="Customer number" value={detail.customer.customer_number} />
                <Info label="Email" value={detail.customer.email} />
                <Info label="Phone" value={detail.customer.phone ?? "—"} />
                <Info label="Country" value={detail.customer.country ?? "—"} />
                <Info label="Status" value={detail.customer.status} />
                <Info label="Created" value={new Date(detail.customer.created_at).toLocaleString()} />
                <Info
                  label="Accounts"
                  value={String(detail.accounts.length)}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="balance">
            <BalanceOps bankId={bankId} account={account} currency={currency} />
          </TabsContent>
          <TabsContent value="account">
            <AccountOps bankId={bankId} account={account} />
          </TabsContent>
          <TabsContent value="restrictions">
            <RestrictionOps bankId={bankId} account={account} restrictions={detail.restrictions} />
          </TabsContent>
          <TabsContent value="transactions">
            <TransactionForm bankId={bankId} account={account} />
          </TabsContent>
          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/40 text-left">
                      <tr>
                        <th className="px-3 py-2">When</th>
                        <th className="px-3 py-2">Kind</th>
                        <th className="px-3 py-2">Direction</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Balance</th>
                        <th className="px-3 py-2">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.transactions.map((t) => (
                        <tr key={t.id} className="border-b last:border-b-0">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                            {new Date(t.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">{t.kind}</td>
                          <td className="px-3 py-2">
                            <Badge variant={t.direction === "credit" ? "default" : "secondary"}>
                              {t.direction}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-mono">
                            {fmtCurrency(t.amount, t.currency)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {fmtCurrency(t.balance_after, t.currency)}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{t.description}</td>
                        </tr>
                      ))}
                      {detail.transactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                            No transactions yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notifications">
            <Card>
              <CardContent className="p-3">
                {detail.notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No notifications sent yet.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {detail.notifications.map((n) => (
                      <li key={n.id} className="p-3 text-sm">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{n.title}</div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                        </div>
                        {n.body && <div className="mt-0.5 text-xs text-muted-foreground">{n.body}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="audit">
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
                      </tr>
                    </thead>
                    <tbody>
                      {detail.audit.map((a) => (
                        <tr key={a.id} className="border-b last:border-b-0">
                          <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{a.action}</td>
                          <td className="px-3 py-2 text-xs">{a.actor_email ?? "—"}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{a.reason ?? ""}</td>
                        </tr>
                      ))}
                      {detail.audit.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                            No audit entries yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}

function BalanceOps({
  bankId,
  account,
  currency,
}: {
  bankId: string;
  account: GbocAccount;
  currency: string;
}) {
  const [op, setOp] = useState<(typeof BALANCE_OPS)[number]>("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fn = useServerFn(gbocBalanceOperation);
  const invalidate = useInvalidate(bankId, "");

  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          bank_id: bankId,
          account_id: account.id,
          op,
          amount: op === "clear" ? undefined : Number(amount),
          reason,
          reference: reference || null,
        },
      }),
    onSuccess: () => {
      toast.success(`Balance ${op} applied`);
      setAmount("");
      setReason("");
      setReference("");
      setConfirmOpen(false);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Operation failed"),
  });

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <Label>Operation</Label>
          <Select value={op} onValueChange={(v) => setOp(v as typeof op)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="add">Add balance</SelectItem>
              <SelectItem value="deduct">Deduct balance</SelectItem>
              <SelectItem value="set">Set balance</SelectItem>
              <SelectItem value="clear">Clear balance</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {op !== "clear" && (
          <div>
            <Label>Amount ({currency})</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
          </div>
        )}
        <div className="sm:col-span-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label>Internal reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Button
            disabled={!reason || (op !== "clear" && !amount)}
            onClick={() => setConfirmOpen(true)}
          >
            Apply operation
          </Button>
        </div>
      </CardContent>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm balance operation</DialogTitle>
            <DialogDescription>
              {op === "clear"
                ? "This will reset the account balance to zero."
                : `This will ${op} ${amount || "0"} ${currency} on •••• ${account.account_number.slice(-4)}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
              {mut.isPending ? "Applying…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AccountOps({ bankId, account }: { bankId: string; account: GbocAccount }) {
  const [action, setAction] = useState<(typeof ACCOUNT_ACTIONS)[number]>("freeze");
  const [reason, setReason] = useState("");
  const fn = useServerFn(gbocAccountAction);
  const invalidate = useInvalidate(bankId, "");
  const mut = useMutation({
    mutationFn: () => fn({ data: { bank_id: bankId, account_id: account.id, action, reason } }),
    onSuccess: () => {
      toast.success(`Account ${action} applied`);
      setReason("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Operation failed"),
  });

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <Label>Action</Label>
          <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ACCOUNT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Current status</Label>
          <div className="mt-1"><Badge>{account.status}</Badge></div>
        </div>
        <div className="sm:col-span-2">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Button disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Applying…" : "Apply"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RestrictionOps({
  bankId,
  account,
  restrictions,
}: {
  bankId: string;
  account: GbocAccount;
  restrictions: GbocCustomerDetail["restrictions"];
}) {
  const [types, setTypes] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const fn = useServerFn(gbocSetRestriction);
  const invalidate = useInvalidate(bankId, "");
  const enableMut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          bank_id: bankId,
          account_id: account.id,
          action: "enable",
          types,
          start_at: start ? new Date(start).toISOString() : null,
          end_at: end ? new Date(end).toISOString() : null,
          reason,
        },
      }),
    onSuccess: () => {
      toast.success("Restriction applied");
      setTypes([]); setStart(""); setEnd(""); setReason("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Operation failed"),
  });
  const disableMut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          bank_id: bankId,
          account_id: account.id,
          action: "disable",
          types: [],
          reason: reason || "Lifted",
        },
      }),
    onSuccess: () => {
      toast.success("Restrictions disabled");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Operation failed"),
  });

  const active = restrictions.filter((r) => r.active && r.account_id === account.id);

  return (
    <Card>
      <CardContent className="grid gap-4 p-4">
        <div>
          <Label>Restriction types</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {RESTRICTION_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Checkbox
                  checked={types.includes(t)}
                  onCheckedChange={(checked) => {
                    setTypes((prev) => (checked ? [...prev, t] : prev.filter((x) => x !== t)));
                  }}
                />
                {t}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Start</Label>
            <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>End</Label>
            <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={enableMut.isPending || types.length === 0} onClick={() => enableMut.mutate()}>
            {enableMut.isPending ? "Applying…" : "Enable restrictions"}
          </Button>
          <Button variant="outline" disabled={disableMut.isPending || active.length === 0} onClick={() => disableMut.mutate()}>
            {disableMut.isPending ? "Disabling…" : "Disable all restrictions"}
          </Button>
        </div>
        {active.length > 0 && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs">
            <div className="mb-1 font-semibold">Active restrictions on this account</div>
            {active.map((r) => (
              <div key={r.id}>
                {r.types.join(", ")} — {r.reason}{" "}
                {r.end_at ? `(until ${new Date(r.end_at).toLocaleString()})` : ""}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TransactionForm({ bankId, account }: { bankId: string; account: GbocAccount }) {
  const [kind, setKind] = useState<(typeof TRANSACTION_KINDS)[number]>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const fn = useServerFn(gbocCreateTransaction);
  const invalidate = useInvalidate(bankId, "");
  const mut = useMutation({
    mutationFn: () =>
      fn({
        data: {
          bank_id: bankId,
          account_id: account.id,
          kind,
          amount: Number(amount),
          description,
          category: category || null,
          reference: reference || null,
        },
      }),
    onSuccess: () => {
      toast.success("Transaction created");
      setAmount(""); setDescription(""); setCategory(""); setReference("");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
        <div>
          <Label>Kind</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSACTION_KINDS.map((k) => (
                <SelectItem key={k} value={k}>{k}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Amount ({account.currency})</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label>Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Category</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label>Internal reference</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Button disabled={mut.isPending || !amount || !description} onClick={() => mut.mutate()}>
            {mut.isPending ? "Creating…" : "Create transaction"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

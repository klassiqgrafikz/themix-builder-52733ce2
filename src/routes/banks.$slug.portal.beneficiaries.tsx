import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import {
  addBeneficiary,
  deleteBeneficiary,
  listBeneficiaries,
  toggleBeneficiaryFavorite,
} from "@/lib/customer/beneficiaries.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, StarOff, Trash2 } from "lucide-react";

export const Route = createFileRoute("/banks/$slug/portal/beneficiaries")({
  component: BeneficiariesPage,
});

function BeneficiariesPage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
  };
  const { bank } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    kind: "internal" as "own" | "internal" | "external",
    beneficiary_name: "",
    account_number: "",
    bank_name: "",
    nickname: "",
    currency: bank.manifest.bank.currency ?? "USD",
  });

  const listFn = useServerFn(listBeneficiaries);
  const addFn = useServerFn(addBeneficiary);
  const delFn = useServerFn(deleteBeneficiary);
  const favFn = useServerFn(toggleBeneficiaryFavorite);
  const listQ = useQuery({
    queryKey: ["beneficiaries", bank.slug, q],
    queryFn: () => listFn({ data: { slug: bank.slug, q: q || undefined } }),
  });

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { slug: bank.slug, ...form } }),
    onSuccess: () => {
      toast.success("Beneficiary added");
      setForm({ ...form, beneficiary_name: "", account_number: "", bank_name: "", nickname: "" });
      qc.invalidateQueries({ queryKey: ["beneficiaries", bank.slug] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <h1 className="text-xl font-semibold" style={{ color: primary }}>Beneficiaries</h1>
        <p className="mt-1 text-sm opacity-70">Manage the recipients you send money to.</p>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>Add new beneficiary</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label>Type</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as typeof form.kind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Same bank</SelectItem>
                <SelectItem value="external">Other bank</SelectItem>
                <SelectItem value="own">My account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Name</Label><Input value={form.beneficiary_name} onChange={(e) => setForm({ ...form, beneficiary_name: e.target.value })} /></div>
          <div><Label>Account number</Label><Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} /></div>
          <div><Label>Bank name</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
          <div><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></div>
          <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button disabled={addMut.isPending || !form.beneficiary_name || !form.account_number}
            onClick={() => addMut.mutate()} style={{ backgroundColor: primary }}>
            {addMut.isPending ? "Adding…" : "Add beneficiary"}
          </Button>
        </div>
      </BrandedCard>

      <BrandedCard manifest={bank.manifest}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold" style={{ color: primary }}>Saved beneficiaries</div>
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        </div>
        {listQ.data && listQ.data.length > 0 ? (
          <ul className="divide-y">
            {listQ.data.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-medium">
                    {b.beneficiary_name}
                    {b.nickname && <span className="text-xs opacity-70">({b.nickname})</span>}
                  </div>
                  <div className="text-xs opacity-70">
                    {b.account_number}{b.bank_name ? ` · ${b.bank_name}` : ""} · {b.kind}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => favFn({ data: { slug: bank.slug, id: b.id, is_favorite: !b.is_favorite } }).then(() => qc.invalidateQueries({ queryKey: ["beneficiaries", bank.slug] }))}>
                    {b.is_favorite ? <Star className="h-4 w-4" style={{ color: primary }} /> : <StarOff className="h-4 w-4 opacity-60" />}
                  </button>
                  <button type="button" onClick={() => delFn({ data: { slug: bank.slug, id: b.id } }).then(() => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["beneficiaries", bank.slug] }); })}>
                    <Trash2 className="h-4 w-4 opacity-70" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm opacity-70">
            No beneficiaries yet.
          </div>
        )}
      </BrandedCard>
    </div>
  );
}

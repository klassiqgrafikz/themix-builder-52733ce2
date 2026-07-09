import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import type { CustomerSession } from "@/lib/customer/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { updateCustomerProfile } from "@/lib/customer/customer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/banks/$slug/portal/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const parent = useMatch({ from: "/banks/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
    session: CustomerSession;
  };
  const { bank, session } = parent;
  const manifest = bank.manifest;
  const theme = manifest.theme;
  const c = session.customer;
  const [form, setForm] = useState({
    phone: c.phone ?? "",
    address: c.address ?? "",
    country: c.country ?? "",
    nationality: c.nationality ?? "",
  });
  const qc = useQueryClient();
  const doUpdate = useServerFn(updateCustomerProfile);
  const mut = useMutation({
    mutationFn: () => doUpdate({ data: { slug: bank.slug, ...form } }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries();
      window.location.reload();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}
        >
          Your profile
        </h1>
        <p className="mt-1 text-sm opacity-80">Personal, contact and security details.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <BrandedCard manifest={manifest}>
          <div className="text-xs uppercase opacity-70">Personal</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li>
              <span className="opacity-60">Name: </span>
              {c.first_name} {c.last_name}
            </li>
            <li>
              <span className="opacity-60">DOB: </span>
              {c.date_of_birth ?? "—"}
            </li>
            <li>
              <span className="opacity-60">Gender: </span>
              {c.gender ?? "—"}
            </li>
            <li>
              <span className="opacity-60">Customer #: </span>
              {c.customer_number}
            </li>
          </ul>
        </BrandedCard>
        <BrandedCard manifest={manifest} className="lg:col-span-2">
          <div className="text-xs uppercase opacity-70">Contact & address (editable)</div>
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
          >
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email (read-only)">
              <Input value={c.email} readOnly disabled />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <Field label="Country">
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </Field>
            <Field label="Nationality">
              <Input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button
                type="submit"
                disabled={mut.isPending}
                style={{ backgroundColor: theme.colors.accent }}
              >
                {mut.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </BrandedCard>
      </div>
      <BrandedCard manifest={manifest}>
        <div className="text-xs uppercase opacity-70">Security</div>
        <p className="mt-2 text-sm opacity-80">
          Email verification: <strong>{c.email_verified ? "Verified" : "Pending"}</strong>. Password
          reset is available on the sign-in page.
        </p>
      </BrandedCard>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

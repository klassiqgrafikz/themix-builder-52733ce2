import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { registerCustomer } from "@/lib/customer/customer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/banks/$slug/register")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    return { bank };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `Open an account — ${loaderData.bank.manifest.bank.name}`
          : "Open an account",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { bank } = Route.useLoaderData();
  const m = bank.manifest;
  const theme = m.theme;
  const navigate = useNavigate();
  const doRegister = useServerFn(registerCustomer);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    nationality: "",
    password: "",
    confirm_password: "",
  });
  const mut = useMutation({
    mutationFn: () => doRegister({ data: { slug: bank.slug, ...form } }),
    onSuccess: (r) => {
      toast.success(`Account created — ${r.customer_number}`);
      navigate({ to: "/banks/$slug/portal", params: { slug: bank.slug } });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Registration failed"),
  });

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div
      className="min-h-screen p-4"
      style={{
        backgroundColor: theme.dark_mode ? "#0b1120" : "#f6f7fb",
        color: theme.dark_mode ? "#e2e8f0" : "#0f172a",
        fontFamily: theme.typography.body,
      }}
    >
      <div className="mx-auto max-w-3xl py-8">
        <div className="mb-6">
          <Link
            to="/banks/$slug"
            params={{ slug: bank.slug }}
            className="text-sm underline"
            style={{ color: theme.colors.primary }}
          >
            ← Back to {m.bank.name}
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}>
              Open an account at {m.bank.name}
            </CardTitle>
            <CardDescription>
              Registration for this bank only. Your details stay isolated to {m.bank.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (form.password !== form.confirm_password) {
                  toast.error("Passwords do not match");
                  return;
                }
                mut.mutate();
              }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <Field label="First name" required>
                <Input value={form.first_name} onChange={update("first_name")} required />
              </Field>
              <Field label="Last name" required>
                <Input value={form.last_name} onChange={update("last_name")} required />
              </Field>
              <Field label="Date of birth">
                <Input type="date" value={form.date_of_birth} onChange={update("date_of_birth")} />
              </Field>
              <Field label="Gender">
                <Input value={form.gender} onChange={update("gender")} placeholder="e.g. Female" />
              </Field>
              <Field label="Email" required>
                <Input type="email" value={form.email} onChange={update("email")} required />
              </Field>
              <Field label="Phone">
                <Input value={form.phone} onChange={update("phone")} />
              </Field>
              <Field label="Residential address" className="sm:col-span-2">
                <Input value={form.address} onChange={update("address")} />
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={update("country")} />
              </Field>
              <Field label="Nationality">
                <Input value={form.nationality} onChange={update("nationality")} />
              </Field>
              <Field label="Password" required>
                <Input
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={update("password")}
                  required
                />
              </Field>
              <Field label="Confirm password" required>
                <Input
                  type="password"
                  minLength={8}
                  value={form.confirm_password}
                  onChange={update("confirm_password")}
                  required
                />
              </Field>
              <div className="sm:col-span-2 flex items-center justify-between pt-2">
                <Link
                  to="/banks/$slug/login"
                  params={{ slug: bank.slug }}
                  className="text-sm underline"
                  style={{ color: theme.colors.primary }}
                >
                  Already have an account? Sign in
                </Link>
                <Button
                  type="submit"
                  disabled={mut.isPending}
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  {mut.isPending ? "Creating account…" : "Create account"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>
        {label} {required ? <span className="text-red-500">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

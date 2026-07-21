import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { loginCustomer } from "@/lib/customer/customer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { I18nProvider, useT, type TranslationKey } from "@/lib/i18n";

// Map raw server / network errors to translation keys.
function loginErrorKey(err: unknown): TranslationKey {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const m = msg.toLowerCase();
  if (!msg) return "auth.err_generic";
  if (m.includes("network") || m.includes("failed to fetch")) return "auth.err_network";
  if (m.includes("password")) return "auth.err_password";
  if (m.includes("no such") || m.includes("not found") || m.includes("unknown")) return "auth.err_no_user";
  if (m.includes("frozen")) return "auth.err_frozen";
  if (m.includes("restrict")) return "auth.err_restricted";
  if (m.includes("too many") || m.includes("rate")) return "auth.err_rate";
  if (m.includes("expired")) return "auth.err_expired";
  if (m.includes("unavailable") || m.includes("500") || m.includes("server")) return "auth.err_server";
  return "auth.err_generic";
}


export const Route = createFileRoute("/$slug/login")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    return { bank };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `Sign in — ${loaderData.bank.manifest.bank.name}` : "Sign in",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { bank } = Route.useLoaderData();
  const m = bank.manifest;
  const theme = m.theme;
  const variant = m.bank.template_variant ?? "modern";
  const navigate = useNavigate();
  const doLogin = useServerFn(loginCustomer);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mut = useMutation({
    mutationFn: () => doLogin({ data: { slug: bank.slug, email, password } }),
    onSuccess: () => {
      toast.success(`Welcome back, ${email.split("@")[0]}`);
      setTimeout(() => {
        navigate({ to: "/$slug/portal", params: { slug: bank.slug } });
      }, 350);
    },
    onError: (e: unknown) => toast.error(humanizeLoginError(e)),
  });

  const form = (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        mut.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Password</Label>
        <PasswordInput
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        disabled={mut.isPending}
        style={{ backgroundColor: theme.colors.accent }}
      >
        {mut.isPending ? "Signing in…" : "Sign in"}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <Link to="/$slug/forgot" params={{ slug: bank.slug }} className="underline" style={{ color: theme.colors.primary }}>
          Forgot password?
        </Link>
        <Link to="/$slug/register" params={{ slug: bank.slug }} className="underline" style={{ color: theme.colors.primary }}>
          Open an account
        </Link>
      </div>
    </form>
  );

  /* ----- CORPORATE: two-column, formal, information rail ----- */
  if (variant === "corporate") {
    return (
      <div className="min-h-screen bg-slate-100" style={{ fontFamily: theme.typography.body }}>
        <div
          className="w-full border-b text-white"
          style={{ backgroundColor: theme.colors.primary }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              {m.brand.login_logo_url && (
                <img src={m.brand.login_logo_url} alt="" className="h-9 w-9 rounded bg-white/10 object-contain p-1" />
              )}
              <div className="text-lg font-semibold" style={{ fontFamily: theme.typography.heading }}>
                {m.bank.name}
              </div>
              <span className="text-xs uppercase tracking-widest opacity-80">
                Client Access
              </span>
            </div>
            <div className="text-xs opacity-90">Secure sign-in · TLS 1.3</div>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[1fr_400px]">
          <div className="hidden rounded border bg-white p-8 md:block">
            <h1
              className="text-3xl font-semibold text-slate-900"
              style={{ fontFamily: theme.typography.heading }}
            >
              Welcome back to {m.bank.name}.
            </h1>
            <p className="mt-3 text-slate-600">
              Access your accounts, initiate payments, and download statements. For your
              protection, sessions expire after inactivity.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-slate-700">
              <li>· Never share your password or one-time codes.</li>
              <li>· We will never call you asking for credentials.</li>
              <li>· Report suspicious activity to your relationship manager.</li>
            </ul>
          </div>
          <div className="rounded border bg-white p-6">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-widest text-slate-500">Sign in</div>
              <div className="text-lg font-semibold text-slate-900">Client portal</div>
            </div>
            {form}
          </div>
        </div>
      </div>
    );
  }

  /* ----- PREMIUM: dark, executive, gold accents ----- */
  if (variant === "premium") {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{
          backgroundColor: "#0a0a0f",
          color: "#f5f2ea",
          backgroundImage:
            "radial-gradient(1000px 500px at 50% -10%, rgba(201,168,76,0.10), transparent 60%)",
          fontFamily: theme.typography.body,
        }}
      >
        <div
          className="w-full max-w-md border p-10"
          style={{ borderColor: "rgba(201,168,76,0.35)", backgroundColor: "rgba(255,255,255,0.02)" }}
        >
          <div className="mb-8 text-center">
            {m.brand.login_logo_url && (
              <img src={m.brand.login_logo_url} alt="" className="mx-auto mb-4 h-14 w-14 rounded object-contain" />
            )}
            <div className="text-xs uppercase tracking-[0.35em]" style={{ color: "#c9a84c" }}>
              Private Banking
            </div>
            <div
              className="mt-3 text-3xl"
              style={{
                fontFamily: `'Cormorant Garamond','Playfair Display',${theme.typography.heading},serif`,
              }}
            >
              {m.bank.name}
            </div>
            <div className="mt-1 text-xs uppercase tracking-widest text-white/50">
              Client access
            </div>
          </div>
          <div className="[&_label]:text-white/70 [&_input]:border-white/20 [&_input]:bg-white/5 [&_input]:text-white">
            {form}
          </div>
        </div>
      </div>
    );
  }

  /* ----- MODERN (default): centered rounded card ----- */
  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        backgroundColor: theme.dark_mode ? "#0b1120" : "#f6f7fb",
        color: theme.dark_mode ? "#e2e8f0" : "#0f172a",
        fontFamily: theme.typography.body,
      }}
    >
      <Card className="w-full max-w-md rounded-3xl">
        <CardHeader className="items-center text-center">
          {m.brand.login_logo_url && (
            <img src={m.brand.login_logo_url} alt="" className="mb-3 h-14 w-14 rounded-xl object-contain" />
          )}
          <CardTitle style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}>
            {m.bank.name}
          </CardTitle>
          <CardDescription>Sign in to your customer portal.</CardDescription>
        </CardHeader>
        <CardContent>{form}</CardContent>
      </Card>
    </div>
  );
}


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

// Map raw server / network errors to friendly customer-facing wording.
function humanizeLoginError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const m = msg.toLowerCase();
  if (!msg) return "We couldn't sign you in. Please try again.";
  if (m.includes("network") || m.includes("failed to fetch")) return "Network error — check your connection and try again.";
  if (m.includes("password")) return "Incorrect password. Please try again.";
  if (m.includes("no such") || m.includes("not found") || m.includes("unknown")) return "We don't recognise this email at this bank.";
  if (m.includes("frozen")) return "Your account is frozen. Contact support to unlock it.";
  if (m.includes("restrict")) return "Your account is restricted. Contact support for details.";
  if (m.includes("too many") || m.includes("rate")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("expired")) return "Your session expired. Please sign in again.";
  if (m.includes("unavailable") || m.includes("500") || m.includes("server")) return "Our servers are temporarily unavailable. Please try again shortly.";
  return msg;
}

export const Route = createFileRoute("/banks/$slug/login")({
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
  const navigate = useNavigate();
  const doLogin = useServerFn(loginCustomer);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const mut = useMutation({
    mutationFn: () => doLogin({ data: { slug: bank.slug, email, password } }),
    onSuccess: () => {
      toast.success(`Welcome back, ${email.split("@")[0]}`);
      setTimeout(() => {
        navigate({ to: "/banks/$slug/portal", params: { slug: bank.slug } });
      }, 350);
    },
    onError: (e: unknown) => toast.error(humanizeLoginError(e)),
  });

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        backgroundColor: theme.dark_mode ? "#0b1120" : "#f6f7fb",
        color: theme.dark_mode ? "#e2e8f0" : "#0f172a",
        fontFamily: theme.typography.body,
      }}
    >
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}>
            {m.bank.name}
          </CardTitle>
          <CardDescription>Sign in to your customer portal.</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Link
                to="/banks/$slug/forgot"
                params={{ slug: bank.slug }}
                className="underline"
                style={{ color: theme.colors.primary }}
              >
                Forgot password?
              </Link>
              <Link
                to="/banks/$slug/register"
                params={{ slug: bank.slug }}
                className="underline"
                style={{ color: theme.colors.primary }}
              >
                Open an account
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

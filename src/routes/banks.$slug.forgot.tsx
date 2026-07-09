import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getPublishedBank } from "@/lib/website/registry.functions";
import { requestPasswordReset, resetPassword } from "@/lib/customer/customer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const Route = createFileRoute("/banks/$slug/forgot")({
  loader: async ({ params }) => {
    const bank = await getPublishedBank({ data: { slug: params.slug } });
    if (!bank) throw notFound();
    return { bank };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData ? `Reset password — ${loaderData.bank.manifest.bank.name}` : "Reset password",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const { bank } = Route.useLoaderData();
  const m = bank.manifest;
  const theme = m.theme;
  const doRequest = useServerFn(requestPasswordReset);
  const doReset = useServerFn(resetPassword);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const requestMut = useMutation({
    mutationFn: () => doRequest({ data: { slug: bank.slug, email } }),
    onSuccess: (r) => {
      if (r.token) {
        setToken(r.token);
        toast.success("Reset link generated. Set your new password below.");
      } else {
        toast.success("If an account exists, a reset link will be sent.");
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Request failed"),
  });

  const resetMut = useMutation({
    mutationFn: () =>
      doReset({ data: { slug: bank.slug, token: token ?? "", password: newPassword } }),
    onSuccess: () => {
      toast.success("Password updated. You can now sign in.");
      setToken(null);
      setNewPassword("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Reset failed"),
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
            Forgot your password?
          </CardTitle>
          <CardDescription>
            We'll generate a reset link for {m.bank.name}. This is a simulation — the token appears
            below instead of an email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              requestMut.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              disabled={requestMut.isPending}
              style={{ backgroundColor: theme.colors.accent }}
            >
              {requestMut.isPending ? "Generating…" : "Send reset link"}
            </Button>
          </form>

          {token && (
            <form
              className="space-y-3 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                resetMut.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input
                  type="password"
                  minLength={8}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="text-xs opacity-70">Token: {token}</div>
              <Button
                type="submit"
                disabled={resetMut.isPending}
                style={{ backgroundColor: theme.colors.primary }}
              >
                {resetMut.isPending ? "Updating…" : "Set new password"}
              </Button>
            </form>
          )}

          <Link
            to="/banks/$slug/login"
            params={{ slug: bank.slug }}
            className="block text-sm underline"
            style={{ color: theme.colors.primary }}
          >
            ← Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

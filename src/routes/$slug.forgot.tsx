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
import { I18nProvider, useT } from "@/lib/i18n";

export const Route = createFileRoute("/$slug/forgot")({
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
  return (
    <I18nProvider language={m.bank.language} currency={m.bank.currency} timezone={m.bank.timezone}>
      <ForgotPageInner />
    </I18nProvider>
  );
}

function ForgotPageInner() {
  const t = useT();
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
        toast.success(t("auth.reset_generated"));
      } else {
        toast.success(t("auth.reset_maybe_sent"));
      }
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : t("toast.failed")),
  });

  const resetMut = useMutation({
    mutationFn: () =>
      doReset({ data: { slug: bank.slug, token: token ?? "", password: newPassword } }),
    onSuccess: () => {
      toast.success(t("auth.password_updated"));
      setToken(null);
      setNewPassword("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : t("toast.failed")),
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
        <CardHeader className="items-center text-center">
          {m.brand.login_logo_url && (
            <img src={m.brand.login_logo_url} alt="" className="mb-3 h-14 w-14 rounded-xl object-contain" />
          )}
          <CardTitle style={{ fontFamily: theme.typography.heading, color: theme.colors.primary }}>
            {t("auth.reset_title")}
          </CardTitle>
          <CardDescription>{t("auth.reset_desc", { bank: m.bank.name })}</CardDescription>
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
              <Label>{t("auth.email")}</Label>
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
              {requestMut.isPending ? t("action.generating") : t("auth.send_reset_link")}
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
                <Label>{t("auth.new_password")}</Label>
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
                {resetMut.isPending ? t("auth.updating") : t("auth.set_new_password")}
              </Button>
            </form>
          )}

          <Link
            to="/$slug/login"
            params={{ slug: bank.slug }}
            className="block text-sm underline"
            style={{ color: theme.colors.primary }}
          >
            ← {t("auth.back_to_sign_in")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

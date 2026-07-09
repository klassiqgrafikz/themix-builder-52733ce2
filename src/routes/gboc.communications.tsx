import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getPlatformSettings,
  updatePlatformSettings,
  type ChatConfig,
  type ChatProvider,
} from "@/lib/gboc/platform-settings.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/gboc/communications")({
  component: LiveChatPage,
});

function previewHref(provider: ChatProvider, c: ChatConfig): string {
  switch (provider) {
    case "tawk":
      return c.tawk_link || "";
    case "crisp":
      return c.crisp_link || "";
    case "smartsupp":
      return c.smartsupp_link || "";
    case "whatsapp": {
      if (c.whatsapp_link) return c.whatsapp_link;
      const num = (c.whatsapp_number ?? "").replace(/[^\d]/g, "");
      const greeting = encodeURIComponent(c.whatsapp_greeting ?? "Hello, I need help.");
      return num ? `https://wa.me/${num}?text=${greeting}` : "";
    }
    case "telegram":
      return c.telegram_group_link || "";
    default:
      return "";
  }
}

const PROVIDERS: { value: ChatProvider; label: string; description: string }[] = [
  { value: "none", label: "None", description: "No chat widget is displayed on tenant portals." },
  { value: "tawk", label: "Tawk.to", description: "Property ID + Widget ID; optional direct chat link." },
  { value: "crisp", label: "Crisp", description: "Website ID; optional direct chat link." },
  { value: "smartsupp", label: "Smartsupp", description: "API key; optional direct chat link." },
  { value: "whatsapp", label: "WhatsApp Business", description: "Business number + direct wa.me link + greeting." },
  { value: "telegram", label: "Telegram", description: "Bot token, chat/group id, and group link." },
];

function LiveChatPage() {
  const qc = useQueryClient();
  const getFn = useServerFn(getPlatformSettings);
  const setFn = useServerFn(updatePlatformSettings);
  const q = useQuery({ queryKey: ["platform-settings"], queryFn: () => getFn() });
  const [live, setLive] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [provider, setProvider] = useState<ChatProvider>("none");
  const [config, setConfig] = useState<ChatConfig>({});

  useEffect(() => {
    if (q.data) {
      setLive(q.data.live_chat_enabled);
      setEmail(q.data.support_email ?? "");
      setPhone(q.data.support_phone ?? "");
      setProvider(q.data.chat_provider);
      setConfig(q.data.chat_config ?? {});
    }
  }, [q.data]);

  const setCfg = <K extends keyof ChatConfig>(k: K, v: ChatConfig[K]) =>
    setConfig((p) => ({ ...p, [k]: v }));

  const mut = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          live_chat_enabled: live,
          support_email: email || null,
          support_phone: phone || null,
          chat_provider: provider,
          chat_config: config,
        },
      }),
    onSuccess: () => {
      toast.success("Live chat configuration saved");
      qc.invalidateQueries({ queryKey: ["platform-settings"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const activeLabel = PROVIDERS.find((p) => p.value === provider)?.label ?? "None";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Live Chat Providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the global chat provider surfaced to every generated bank's Support Center.
          </p>
        </div>
        <Badge variant={live ? "default" : "secondary"}>
          {live ? `Enabled · ${activeLabel}` : "Disabled"}
        </Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>Global toggle & support fallbacks</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Live chat enabled globally</div>
              <div className="text-xs text-muted-foreground">
                When off, tenants fall back to email / phone / contact form only.
              </div>
            </div>
            <Switch checked={live} onCheckedChange={setLive} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Support email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@themixweb.dev" />
            </div>
            <div>
              <Label>Support phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 000 000 0000" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Provider</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Active provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ChatProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {PROVIDERS.find((p) => p.value === provider)?.description}
            </p>
          </div>

          {provider === "tawk" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Property ID"><Input value={config.tawk_property_id ?? ""} onChange={(e) => setCfg("tawk_property_id", e.target.value)} /></Field>
              <Field label="Widget ID"><Input value={config.tawk_widget_id ?? ""} onChange={(e) => setCfg("tawk_widget_id", e.target.value)} /></Field>
              <Field label="Direct chat link (optional)" wide><Input value={config.tawk_link ?? ""} onChange={(e) => setCfg("tawk_link", e.target.value)} placeholder="https://tawk.to/chat/…" /></Field>
            </div>
          )}

          {provider === "crisp" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Website ID"><Input value={config.crisp_website_id ?? ""} onChange={(e) => setCfg("crisp_website_id", e.target.value)} /></Field>
              <Field label="Direct chat link (optional)"><Input value={config.crisp_link ?? ""} onChange={(e) => setCfg("crisp_link", e.target.value)} placeholder="https://go.crisp.chat/chat/…" /></Field>
            </div>
          )}

          {provider === "smartsupp" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="API key"><Input value={config.smartsupp_api_key ?? ""} onChange={(e) => setCfg("smartsupp_api_key", e.target.value)} /></Field>
              <Field label="Direct chat link (optional)"><Input value={config.smartsupp_link ?? ""} onChange={(e) => setCfg("smartsupp_link", e.target.value)} /></Field>
            </div>
          )}

          {provider === "whatsapp" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Business number"><Input value={config.whatsapp_number ?? ""} onChange={(e) => setCfg("whatsapp_number", e.target.value)} placeholder="+1 555 000 0000" /></Field>
              <Field label="WhatsApp link"><Input value={config.whatsapp_link ?? ""} onChange={(e) => setCfg("whatsapp_link", e.target.value)} placeholder="https://wa.me/15550000000" /></Field>
              <Field label="Default greeting" wide><Input value={config.whatsapp_greeting ?? ""} onChange={(e) => setCfg("whatsapp_greeting", e.target.value)} placeholder="Hi, I need help with my account." /></Field>
            </div>
          )}

          {provider === "telegram" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Bot token"><Input value={config.telegram_bot_token ?? ""} onChange={(e) => setCfg("telegram_bot_token", e.target.value)} /></Field>
              <Field label="Chat ID"><Input value={config.telegram_chat_id ?? ""} onChange={(e) => setCfg("telegram_chat_id", e.target.value)} /></Field>
              <Field label="Group / channel link" wide><Input value={config.telegram_group_link ?? ""} onChange={(e) => setCfg("telegram_group_link", e.target.value)} placeholder="https://t.me/…" /></Field>
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const href = previewHref(provider, config);
                if (!href) {
                  toast.error("No preview link available for this provider. Fill in the required fields and save first.");
                  return;
                }
                window.open(href, "_blank", "noopener,noreferrer");
              }}
              disabled={provider === "none"}
            >
              Test / preview
            </Button>
            <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : "Save configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

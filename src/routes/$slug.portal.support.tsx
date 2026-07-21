import { createFileRoute, useMatch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import type { WebsiteManifest } from "@/lib/rendering/types";
import { BrandedCard } from "@/lib/customer/portal-ui";
import { ChatWidget } from "@/lib/customer/chat-widget";
import {
  getPlatformSupportConfig,
  getSupportTicket,
  listSupportTickets,
  openSupportTicket,
  replySupportTicket,
} from "@/lib/customer/support.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useT, useFormatDate } from "@/lib/i18n";

export const Route = createFileRoute("/$slug/portal/support")({
  component: SupportPage,
});

function SupportPage() {
  const t = useT();
  const fmtDate = useFormatDate();
  const parent = useMatch({ from: "/$slug/portal" }).loaderData as {
    bank: { manifest: WebsiteManifest; slug: string };
  };
  const { bank } = parent;
  const primary = bank.manifest.theme.colors.primary;
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const cfgFn = useServerFn(getPlatformSupportConfig);
  const listFn = useServerFn(listSupportTickets);
  const openFn = useServerFn(openSupportTicket);
  const detailFn = useServerFn(getSupportTicket);
  const replyFn = useServerFn(replySupportTicket);

  const cfgQ = useQuery({ queryKey: ["platform-support"], queryFn: () => cfgFn() });
  const listQ = useQuery({ queryKey: ["tickets", bank.slug], queryFn: () => listFn({ data: { slug: bank.slug } }) });
  const detailQ = useQuery({
    queryKey: ["ticket", bank.slug, activeTicket],
    enabled: !!activeTicket,
    queryFn: () => detailFn({ data: { slug: bank.slug, id: activeTicket! } }),
  });

  const openMut = useMutation({
    mutationFn: () => openFn({ data: { slug: bank.slug, subject, body, priority } }),
    onSuccess: (r) => {
      toast.success(t("support.opened"));
      setSubject(""); setBody(""); setActiveTicket(r.id);
      qc.invalidateQueries({ queryKey: ["tickets", bank.slug] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : t("toast.failed")),
  });
  const replyMut = useMutation({
    mutationFn: () => replyFn({ data: { slug: bank.slug, id: activeTicket!, body: reply } }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["ticket", bank.slug, activeTicket] }); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : t("toast.failed")),
  });

  const FAQ = [
    { q: t("support.faq"), a: t("support.contact_us") },
  ];

  return (
    <div className="space-y-6">
      <BrandedCard manifest={bank.manifest}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: primary }}>{t("support.title")}</h1>
            <div className="mt-2 text-sm">
              <div className="text-xs uppercase opacity-70">{t("support.live_chat")}</div>
              <div>{cfgQ.data?.live_chat_enabled ? t("support.chat_available", { provider: cfgQ.data.chat_provider }) : t("support.chat_disabled")}</div>
            </div>
          </div>
          {cfgQ.data && <ChatWidget config={cfgQ.data} primary={primary} />}
        </div>
      </BrandedCard>

      <div className="grid gap-6 md:grid-cols-2">
        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>{t("support.contact_form")}</div>
          <div className="space-y-3">
            <div><Label>{t("support.subject")}</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div>
              <Label>{t("support.priority")}</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("support.priority_low")}</SelectItem>
                  <SelectItem value="normal">{t("support.priority_normal")}</SelectItem>
                  <SelectItem value="high">{t("support.priority_high")}</SelectItem>
                  <SelectItem value="urgent">{t("support.priority_urgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>{t("support.message")}</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} /></div>
            <Button disabled={openMut.isPending || !subject || !body} onClick={() => openMut.mutate()} style={{ backgroundColor: primary }}>
              {openMut.isPending ? t("support.sending") : t("support.open_ticket")}
            </Button>
            {cfgQ.data?.live_chat_enabled && (
              <Button variant="outline" onClick={() => { setPriority("high"); openFn({ data: { slug: bank.slug, subject: subject || t("support.live_chat"), body: body || t("support.live_chat"), channel: "chat", priority: "high" } }).then(() => { toast.success(t("support.opened")); qc.invalidateQueries({ queryKey: ["tickets", bank.slug] }); }); }}>
                {t("support.start_chat")}
              </Button>
            )}
          </div>
        </BrandedCard>

        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>{t("support.your_tickets")}</div>
          {(listQ.data ?? []).length === 0 ? (
            <p className="text-sm opacity-70">{t("support.no_tickets")}</p>
          ) : (
            <ul className="divide-y">
              {(listQ.data ?? []).map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between py-2">
                  <button type="button" onClick={() => setActiveTicket(ticket.id)} className="text-left">
                    <div className="font-medium">{ticket.subject}</div>
                    <div className="text-xs opacity-70">{ticket.channel} · {ticket.status} · {fmtDate(ticket.last_message_at, { dateStyle: "medium" })}</div>
                  </button>
                  <span className="rounded px-2 py-0.5 text-xs" style={{ backgroundColor: `${primary}18`, color: primary }}>{ticket.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </BrandedCard>
      </div>

      {activeTicket && detailQ.data && (
        <BrandedCard manifest={bank.manifest}>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold" style={{ color: primary }}>{detailQ.data.ticket.subject}</div>
            <button className="text-xs underline" onClick={() => setActiveTicket(null)}>{t("action.close")}</button>
          </div>
          <div className="space-y-2">
            {detailQ.data.messages.map((m) => (
              <div key={m.id} className={`rounded-md p-3 text-sm ${m.author === "customer" ? "ml-auto max-w-md" : "max-w-md"}`}
                style={{ backgroundColor: m.author === "customer" ? `${primary}12` : "#f3f4f6" }}>
                <div className="text-xs opacity-70">{m.author} · {fmtDate(m.created_at, { dateStyle: "medium", timeStyle: "short" })}</div>
                <div className="mt-1 whitespace-pre-wrap">{m.body}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} placeholder={t("support.reply_placeholder")} />
            <Button disabled={!reply || replyMut.isPending} onClick={() => replyMut.mutate()} style={{ backgroundColor: primary }}>{t("action.send")}</Button>
          </div>
        </BrandedCard>
      )}

      <BrandedCard manifest={bank.manifest}>
        <div className="mb-3 text-sm font-semibold" style={{ color: primary }}>{t("support.faq")}</div>
        <div className="space-y-3">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-md border p-3 text-sm">
              <summary className="cursor-pointer font-medium">{f.q}</summary>
              <p className="mt-2 opacity-80">{f.a}</p>
            </details>
          ))}
        </div>
      </BrandedCard>
    </div>
  );
}

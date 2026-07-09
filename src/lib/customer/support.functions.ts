// Support Center — tickets, messages, contact form, live chat gating.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const slug = z.string().min(1);

export type SupportTicket = {
  id: string;
  subject: string;
  category: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "pending" | "resolved" | "closed";
  channel: "ticket" | "chat" | "contact_form";
  last_message_at: string;
  created_at: string;
};

export type SupportMessage = {
  id: string;
  author: "customer" | "agent" | "system";
  body: string;
  created_at: string;
};

export type PlatformSupportConfig = {
  live_chat_enabled: boolean;
  support_email: string | null;
  support_phone: string | null;
  chat_provider:
    | "none"
    | "tawk"
    | "crisp"
    | "smartsupp"
    | "whatsapp"
    | "telegram";
  chat_config: Record<string, string | undefined>;
};

export const getPlatformSupportConfig = createServerFn({ method: "GET" })
  .handler(async (): Promise<PlatformSupportConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("gboc_platform_settings")
      .select("live_chat_enabled, support_email, support_phone, settings")
      .eq("id", 1)
      .maybeSingle();
    const settings = (data?.settings ?? {}) as {
      chat_provider?: PlatformSupportConfig["chat_provider"];
      chat_config?: Record<string, string | undefined>;
    };
    // Strip fields that must never reach untrusted browsers.
    const cfg = { ...(settings.chat_config ?? {}) };
    delete cfg.telegram_bot_token;
    return {
      live_chat_enabled: !!data?.live_chat_enabled,
      support_email: data?.support_email ?? null,
      support_phone: data?.support_phone ?? null,
      chat_provider: settings.chat_provider ?? "none",
      chat_config: cfg,
    };
  });

export const listSupportTickets = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug }).parse(d))
  .handler(async ({ data }): Promise<SupportTicket[]> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("bank_support_tickets")
      .select("*")
      .eq("customer_id", s.customer.id)
      .order("last_message_at", { ascending: false });
    return (rows ?? []).map((r) => ({
      id: r.id,
      subject: r.subject,
      category: r.category,
      priority: r.priority as SupportTicket["priority"],
      status: r.status as SupportTicket["status"],
      channel: r.channel as SupportTicket["channel"],
      last_message_at: r.last_message_at,
      created_at: r.created_at,
    }));
  });

export const getSupportTicket = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; id: string }) =>
    z.object({ slug, id: z.string().uuid() }).parse(d),
  )
  .handler(
    async ({
      data,
    }): Promise<{ ticket: SupportTicket; messages: SupportMessage[] } | null> => {
      const { requireCustomerSession } = await import("./session.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const s = await requireCustomerSession(data.slug);
      const { data: t } = await supabaseAdmin
        .from("bank_support_tickets")
        .select("*")
        .eq("id", data.id)
        .eq("customer_id", s.customer.id)
        .maybeSingle();
      if (!t) return null;
      const { data: msgs } = await supabaseAdmin
        .from("bank_support_messages")
        .select("id, author, body, created_at")
        .eq("ticket_id", t.id)
        .order("created_at", { ascending: true });
      return {
        ticket: {
          id: t.id,
          subject: t.subject,
          category: t.category,
          priority: t.priority as SupportTicket["priority"],
          status: t.status as SupportTicket["status"],
          channel: t.channel as SupportTicket["channel"],
          last_message_at: t.last_message_at,
          created_at: t.created_at,
        },
        messages: (msgs ?? []).map((m) => ({
          id: m.id,
          author: m.author as SupportMessage["author"],
          body: m.body,
          created_at: m.created_at,
        })),
      };
    },
  );

export const openSupportTicket = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      slug: string;
      subject: string;
      body: string;
      category?: string;
      priority?: "low" | "normal" | "high" | "urgent";
      channel?: "ticket" | "chat" | "contact_form";
    }) =>
      z
        .object({
          slug,
          subject: z.string().trim().min(2).max(200),
          body: z.string().trim().min(1).max(4000),
          category: z.string().optional(),
          priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
          channel: z.enum(["ticket", "chat", "contact_form"]).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ id: string }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: t, error } = await supabaseAdmin
      .from("bank_support_tickets")
      .insert({
        bank_id: s.bank.id,
        customer_id: s.customer.id,
        subject: data.subject,
        category: data.category ?? "general",
        priority: data.priority ?? "normal",
        channel: data.channel ?? "ticket",
      })
      .select("id")
      .single();
    if (error || !t) throw new Error(error?.message ?? "Failed to open ticket");
    await supabaseAdmin.from("bank_support_messages").insert({
      ticket_id: t.id,
      bank_id: s.bank.id,
      author: "customer",
      author_id: s.customer.id,
      body: data.body,
    });
    await supabaseAdmin.from("bank_notifications").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      kind: "support",
      title: "Support ticket created",
      body: `We received your request: ${data.subject}.`,
    });
    return { id: t.id };
  });

export const replySupportTicket = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; id: string; body: string }) =>
    z
      .object({ slug, id: z.string().uuid(), body: z.string().trim().min(1).max(4000) })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: t } = await supabaseAdmin
      .from("bank_support_tickets")
      .select("id, bank_id")
      .eq("id", data.id)
      .eq("customer_id", s.customer.id)
      .maybeSingle();
    if (!t) throw new Error("Ticket not found");
    await supabaseAdmin.from("bank_support_messages").insert({
      ticket_id: t.id,
      bank_id: t.bank_id,
      author: "customer",
      author_id: s.customer.id,
      body: data.body,
    });
    await supabaseAdmin
      .from("bank_support_tickets")
      .update({ status: "open", last_message_at: new Date().toISOString() })
      .eq("id", t.id);
    return { ok: true };
  });

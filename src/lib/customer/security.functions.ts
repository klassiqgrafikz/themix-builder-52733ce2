// Customer Security Center: password/pin change, trusted devices, sessions, 2FA foundation.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const slug = z.string().min(1);

export type TrustedDevice = {
  id: string;
  label: string;
  user_agent: string | null;
  ip: string | null;
  last_used_at: string;
  created_at: string;
};

export type ActiveSession = {
  token_preview: string;
  expires_at: string;
  is_current: boolean;
};

export const changePassword = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; current_password: string; new_password: string }) =>
      z
        .object({
          slug,
          current_password: z.string().min(1),
          new_password: z.string().min(8).max(120),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { hashPassword, verifyPassword, randomHex } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: c } = await supabaseAdmin
      .from("bank_customers")
      .select("password_salt, password_hash")
      .eq("id", s.customer.id)
      .maybeSingle();
    if (!c) throw new Error("Customer not found");
    const ok = await verifyPassword(data.current_password, c.password_salt, c.password_hash);
    if (!ok) throw new Error("Current password is incorrect");
    const salt = randomHex(16);
    const hash = await hashPassword(data.new_password, salt);
    const { error } = await supabaseAdmin
      .from("bank_customers")
      .update({ password_salt: salt, password_hash: hash })
      .eq("id", s.customer.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("bank_notifications").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      kind: "security",
      title: "Password changed",
      body: "Your password was successfully updated.",
    });
    return { ok: true };
  });

export const changePin = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { slug: string; new_pin: string; current_pin?: string }) =>
      z
        .object({
          slug,
          new_pin: z.string().regex(/^\d{4,8}$/),
          current_pin: z.string().regex(/^\d{4,8}$/).optional(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { hashPassword, verifyPassword, randomHex } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: c } = await supabaseAdmin
      .from("bank_customers")
      .select("pin_salt, pin_hash")
      .eq("id", s.customer.id)
      .maybeSingle();
    if (c?.pin_hash && data.current_pin) {
      const ok = await verifyPassword(data.current_pin, c.pin_salt ?? "", c.pin_hash);
      if (!ok) throw new Error("Current PIN is incorrect");
    }
    const salt = randomHex(8);
    const hash = await hashPassword(data.new_pin, salt);
    const { error } = await supabaseAdmin
      .from("bank_customers")
      .update({ pin_salt: salt, pin_hash: hash })
      .eq("id", s.customer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setTwoFactor = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; enabled: boolean }) =>
    z.object({ slug, enabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { randomHex } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const patch: Record<string, unknown> = { two_factor_enabled: data.enabled };
    if (data.enabled) patch.two_factor_secret = randomHex(20);
    else patch.two_factor_secret = null;
    const { error } = await supabaseAdmin
      .from("bank_customers")
      .update(patch)
      .eq("id", s.customer.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTrustedDevices = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug }).parse(d))
  .handler(async ({ data }): Promise<TrustedDevice[]> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const { data: rows } = await supabaseAdmin
      .from("bank_customer_trusted_devices")
      .select("*")
      .eq("customer_id", s.customer.id)
      .order("last_used_at", { ascending: false });
    return (rows ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      user_agent: r.user_agent,
      ip: r.ip,
      last_used_at: r.last_used_at,
      created_at: r.created_at,
    }));
  });

export const addTrustedDevice = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; label: string }) =>
    z.object({ slug, label: z.string().trim().min(1).max(80) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const ua = getRequestHeader("user-agent") ?? null;
    await supabaseAdmin.from("bank_customer_trusted_devices").insert({
      bank_id: s.bank.id,
      customer_id: s.customer.id,
      label: data.label,
      user_agent: ua,
    });
    return { ok: true };
  });

export const removeTrustedDevice = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; id: string }) =>
    z.object({ slug, id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    await supabaseAdmin
      .from("bank_customer_trusted_devices")
      .delete()
      .eq("id", data.id)
      .eq("customer_id", s.customer.id);
    return { ok: true };
  });

export const listActiveSessions = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug }).parse(d))
  .handler(async ({ data }): Promise<ActiveSession[]> => {
    const { requireCustomerSession } = await import("./session.server");
    const { parseCookies, cookieName } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const currentToken = parseCookies(getRequestHeader("cookie"))[cookieName(data.slug)];
    const { data: rows } = await supabaseAdmin
      .from("bank_customer_sessions")
      .select("token, expires_at")
      .eq("customer_id", s.customer.id)
      .order("expires_at", { ascending: false });
    return (rows ?? []).map((r) => ({
      token_preview: `${(r.token as string).slice(0, 6)}…${(r.token as string).slice(-4)}`,
      expires_at: r.expires_at,
      is_current: r.token === currentToken,
    }));
  });

export const revokeOtherSessions = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => z.object({ slug }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { requireCustomerSession } = await import("./session.server");
    const { parseCookies, cookieName } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await requireCustomerSession(data.slug);
    const token = parseCookies(getRequestHeader("cookie"))[cookieName(data.slug)];
    let q = supabaseAdmin.from("bank_customer_sessions").delete().eq("customer_id", s.customer.id);
    if (token) q = q.neq("token", token);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

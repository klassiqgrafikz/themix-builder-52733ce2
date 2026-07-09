// Customer avatar upload: proxies to private `customer-avatars` bucket and
// stores a stable proxy URL on bank_customers.profile_picture_url.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const uploadSchema = z.object({
  slug: z.string().min(1),
  content_type: z.string().min(3).max(120),
  data_base64: z.string().min(4).max(8_000_000), // ~6 MB after base64
  extension: z.string().trim().min(1).max(8),
});

export const uploadCustomerAvatar = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof uploadSchema>) => uploadSchema.parse(d))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { parseCookies, cookieName, resolveBankBySlug } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bank = await resolveBankBySlug(data.slug);
    if (!bank) throw new Error("Bank not found");
    const cookies = parseCookies(getRequestHeader("cookie"));
    const token = cookies[cookieName(data.slug)];
    if (!token) throw new Error("Not signed in");

    const { data: session } = await supabaseAdmin
      .from("bank_customer_sessions")
      .select("customer_id, bank_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!session || session.bank_id !== bank.id) throw new Error("Not signed in");
    if (new Date(session.expires_at).getTime() < Date.now()) throw new Error("Session expired");

    const customerId = session.customer_id as string;
    const ext = data.extension.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6) || "bin";
    const path = `${customerId}/avatar.${ext}`;
    const bin = Buffer.from(data.data_base64, "base64");

    // Remove prior variants so the proxy resolves deterministically.
    const { data: existing } = await supabaseAdmin.storage
      .from("customer-avatars")
      .list(customerId, { limit: 20 });
    const stale = (existing ?? [])
      .filter((f) => f.name.startsWith("avatar."))
      .map((f) => `${customerId}/${f.name}`);
    if (stale.length) await supabaseAdmin.storage.from("customer-avatars").remove(stale);

    const { error: upErr } = await supabaseAdmin.storage
      .from("customer-avatars")
      .upload(path, bin, { contentType: data.content_type, upsert: true });
    if (upErr) throw new Error(upErr.message);

    const url = `/api/public/customer-avatar/${customerId}?v=${Date.now()}`;
    const { error: updErr } = await supabaseAdmin
      .from("bank_customers")
      .update({ profile_picture_url: url })
      .eq("id", customerId);
    if (updErr) throw new Error(updErr.message);

    return { url };
  });

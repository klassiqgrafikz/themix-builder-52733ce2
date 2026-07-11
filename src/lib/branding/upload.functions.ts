// Branding upload: proxies file uploads to the private `bank-branding` bucket
// and exposes a stable public URL served by /api/public/branding/$draftId/$kind.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePlatformAuth } from "@/integrations/supabase/platform-auth-middleware";

const KIND = z.enum(["login_logo", "dashboard_logo"]);
export type BrandingKind = z.infer<typeof KIND>;

// Client sends base64 (dataURL prefix stripped) + mime + kind + draftId.
const uploadSchema = z.object({
  draft_id: z.string().uuid(),
  kind: KIND,
  content_type: z.string().min(3).max(120),
  data_base64: z.string().min(4).max(20_000_000), // ~15 MB after base64
  extension: z.string().trim().min(1).max(8),
});

export const uploadBrandingAsset = createServerFn({ method: "POST" })
  .middleware([requirePlatformAuth])
  .inputValidator((d: z.input<typeof uploadSchema>) => uploadSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ url: string }> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    // Verify draft ownership.
    const { data: draft, error: dErr } = await sb
      .from("bb_bank_drafts")
      .select("id, owner_id")
      .eq("id", data.draft_id)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!draft || draft.owner_id !== context.userId) throw new Error("Not authorized for this draft");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Decode base64 to Uint8Array (Buffer available under nodejs_compat).
    const bin = Buffer.from(data.data_base64, "base64");
    const ext = data.extension.replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 6) || "bin";
    const path = `${data.draft_id}/${data.kind}.${ext}`;

    // Wipe prior variants for this kind so subsequent proxy resolution is deterministic.
    const { data: existing } = await supabaseAdmin.storage
      .from("bank-branding")
      .list(data.draft_id, { limit: 20 });
    const stale = (existing ?? [])
      .filter((f) => f.name.startsWith(`${data.kind}.`))
      .map((f) => `${data.draft_id}/${f.name}`);
    if (stale.length) await supabaseAdmin.storage.from("bank-branding").remove(stale);

    const { error: upErr } = await supabaseAdmin.storage
      .from("bank-branding")
      .upload(path, bin, { contentType: data.content_type, upsert: true });
    if (upErr) throw new Error(upErr.message);

    return { url: `/api/public/branding/${data.draft_id}/${data.kind}?v=${Date.now()}` };
  });

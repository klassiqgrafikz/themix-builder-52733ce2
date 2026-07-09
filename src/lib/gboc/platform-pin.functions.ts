// Platform PIN — protects administration surfaces (Blueprint Library, Bank
// Management, Products, GBOC, Reports, Rendering Engine, Platform Settings).
// Default PIN 0499 (seeded by migration). Stored as a hex sha256 hash plus
// the plaintext (so an admin can reveal the current PIN). No CBE / auth /
// tenant logic is touched.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "node:crypto";

const DEFAULT_PIN = "0499";

function hash(pin: string): string {
  return createHash("sha256").update(pin, "utf8").digest("hex");
}

async function loadRow() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("gboc_platform_settings")
    .select("platform_pin_hash, platform_pin_plain")
    .eq("id", 1)
    .maybeSingle();
  return data as { platform_pin_hash: string | null; platform_pin_plain: string | null } | null;
}

/** Public — anyone with the PIN can unlock the admin shell. */
export const verifyPlatformPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) =>
    z.object({ pin: z.string().trim().min(4).max(12).regex(/^\d+$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const row = await loadRow();
    const expected = row?.platform_pin_hash ?? hash(DEFAULT_PIN);
    return { ok: hash(data.pin) === expected };
  });

/** Authenticated admin — reveal the current plaintext PIN. */
export const getPlatformPin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ pin: string }> => {
    const row = await loadRow();
    return { pin: row?.platform_pin_plain ?? DEFAULT_PIN };
  });

/** Authenticated admin — set a new PIN (min 4 digits). */
export const updatePlatformPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { pin: string }) =>
    z.object({ pin: z.string().trim().min(4).max(12).regex(/^\d+$/, "PIN must be digits only") }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from("gboc_platform_settings")
      .update({
        platform_pin_hash: hash(data.pin),
        platform_pin_plain: data.pin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

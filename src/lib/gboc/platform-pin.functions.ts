// Platform PIN — protects administration surfaces (Blueprint Library, Bank
// Management, Products, GBOC, Reports, Rendering Engine, Platform Settings).
// Default PIN 0499 (seeded by migration). Stored as a hex sha256 hash plus
// the plaintext (so an admin can reveal the current PIN). No CBE / auth /
// tenant logic is touched.
//
// After a successful PIN check, the server mints a real Supabase session for
// a shared platform-admin account and returns the tokens. The client installs
// them with `supabase.auth.setSession(...)` so subsequent server-fn RPCs carry
// a valid bearer token and `requireSupabaseAuth` succeeds. There is no
// separate email/password login for operators.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createHash } from "node:crypto";

const DEFAULT_PIN = "0499";
const ADMIN_EMAIL = "platform-admin@themixweb.internal";

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

type AdminSession = { access_token: string; refresh_token: string };
type VerifyResult = { ok: false } | { ok: true; session: AdminSession };

/**
 * Ensure a shared platform-admin auth user exists with the configured
 * password. Idempotent: creates the user on first call, resets the password
 * on subsequent calls so it always matches the server env var.
 *
 * Uses a dedicated `@supabase/supabase-js` client for the Auth Admin API so
 * the service-role bearer is preserved end-to-end (the generated
 * `supabaseAdmin` wrapper strips the Authorization header when the key is a
 * new `sb_secret_*` value, which the Auth Admin API rejects).
 */
async function ensurePlatformAdmin(password: string): Promise<void> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Supabase service-role env not configured");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  }).auth.admin;

  const created = await admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { role: "platform_admin" },
  });
  if (!created.error) return;

  let page = 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let match: any = null;
  for (let i = 0; i < 20 && !match; i += 1) {
    const list = await admin.listUsers({ page, perPage: 200 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users = (list.data?.users ?? []) as any[];
    match = users.find((u) => u.email === ADMIN_EMAIL) ?? null;
    if (users.length < 200) break;
    page += 1;
  }
  if (!match) {
    throw new Error(
      created.error?.message
        ? `Unable to provision platform admin: ${created.error.message}`
        : "Unable to provision platform admin",
    );
  }
  const upd = await admin.updateUserById(match.id, {
    password,
    email_confirm: true,
  });
  if (upd.error) throw new Error(upd.error.message);
}

async function mintAdminSession(password: string): Promise<AdminSession> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase env not configured");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await sb.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password,
  });
  if (error || !data.session) {
    throw new Error(error?.message ?? "Platform admin sign-in failed");
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

/**
 * Public — anyone with the correct PIN unlocks the admin shell. When the PIN
 * matches, mint a real Supabase session for the shared platform-admin
 * account and return it so the client can install it.
 */
export const verifyPlatformPin = createServerFn({ method: "POST" })
  .inputValidator((d: { pin: string }) =>
    z.object({ pin: z.string().trim().min(4).max(12).regex(/^\d+$/) }).parse(d),
  )
  .handler(async ({ data }): Promise<VerifyResult> => {
    const row = await loadRow();
    const expected = row?.platform_pin_hash ?? hash(DEFAULT_PIN);
    if (hash(data.pin) !== expected) return { ok: false };

    const password = process.env.PLATFORM_ADMIN_PASSWORD;
    if (!password) {
      throw new Error("PLATFORM_ADMIN_PASSWORD is not configured");
    }

    // Try minting a session first; only pay the ensure/reset cost if the
    // shared admin account is missing or its password drifted.
    try {
      const session = await mintAdminSession(password);
      return { ok: true, session };
    } catch {
      await ensurePlatformAdmin(password);
      const session = await mintAdminSession(password);
      return { ok: true, session };
    }
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

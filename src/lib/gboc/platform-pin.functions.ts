// Platform PIN — protects administration surfaces (Blueprint Library, Bank
// Management, Products, GBOC, Reports, Rendering Engine, Platform Settings).
// Default PIN 0499 (seeded by migration). Stored as a hex sha256 hash plus
// the plaintext (so an admin can reveal the current PIN). No CBE / auth /
// tenant logic is touched.
//
// After a successful PIN check, the server mints a real Supabase session for
// a shared platform-admin account and returns the tokens. The client installs
// them with `supabase.auth.setSession(...)` so subsequent server-fn RPCs carry
// a valid bearer token and `requirePlatformAuth` succeeds. There is no
// separate email/password login for operators.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requirePlatformAuth } from "@/integrations/supabase/platform-auth-middleware";
import { createHash } from "node:crypto";

const DEFAULT_PIN = "0499";
// Platform admin credentials come from environment variables so the project
// stays portable across Supabase instances (Lovable Cloud, self-hosted, etc.).
// Configure these in your deployment environment (e.g. Vercel Project Settings
// → Environment Variables):
//   PLATFORM_ADMIN_EMAIL    — email of the shared platform-admin auth user
//   PLATFORM_ADMIN_PASSWORD — password for that user
// A sensible fallback email is used only when PLATFORM_ADMIN_EMAIL is unset,
// to keep local dev frictionless. Production MUST set both variables.
const FALLBACK_ADMIN_EMAIL = "themix-platform-admin-v1@themixweb.internal";

function getAdminEmail(): string {
  return process.env.PLATFORM_ADMIN_EMAIL?.trim() || FALLBACK_ADMIN_EMAIL;
}

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

async function createPublishableClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase env not configured");
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

/**
 * Ensure the shared platform-admin auth user exists. Returns:
 *  - "created"  — signUp succeeded and returned a user
 *  - "exists"   — signUp reported the user is already registered
 * Throws with the raw Supabase error message for anything else.
 */
async function ensurePlatformAdmin(password: string): Promise<"created" | "exists"> {
  const sb = await createPublishableClient();
  const email = getAdminEmail();
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { data: { role: "platform_admin" } },
  });
  console.log("[platform-pin] signUp result", {
    email,
    hasUser: Boolean(data?.user),
    userId: data?.user?.id ?? null,
    hasSession: Boolean(data?.session),
    error: error ? { message: error.message, status: error.status, code: (error as { code?: string }).code } : null,
  });
  if (!error) {
    if (data?.user) return "created";
    throw new Error(
      `signUp returned no user for ${email}. Likely cause: email confirmations are enabled on this Supabase project — disable "Confirm email" under Authentication → Providers → Email, or pre-create the admin user manually. (platform-pin.functions.ts:ensurePlatformAdmin)`,
    );
  }
  const msg = error.message.toLowerCase();
  if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
    return "exists";
  }
  throw new Error(
    `supabase.auth.signUp failed for ${email}: ${error.message} (status=${error.status ?? "?"}, code=${(error as { code?: string }).code ?? "?"}) at platform-pin.functions.ts:ensurePlatformAdmin`,
  );
}

type SignInFailure = { error: string; status?: number; code?: string };

async function trySignIn(password: string): Promise<AdminSession | SignInFailure> {
  const sb = await createPublishableClient();
  const email = getAdminEmail();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  console.log("[platform-pin] signInWithPassword result", {
    email,
    hasSession: Boolean(data?.session),
    userId: data?.user?.id ?? null,
    error: error ? { message: error.message, status: error.status, code: (error as { code?: string }).code } : null,
  });
  if (error || !data.session) {
    return {
      error: error?.message ?? "signInWithPassword returned no session",
      status: error?.status,
      code: (error as { code?: string } | null)?.code,
    };
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}

async function ensurePlatformAdminRole(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from("user_roles")
    .upsert({ user_id: userId, role: "platform_admin" }, { onConflict: "user_id,role" });
}

async function attachRole(session: AdminSession): Promise<AdminSession> {
  try {
    const payload = JSON.parse(
      Buffer.from(session.access_token.split(".")[1], "base64").toString("utf8"),
    ) as { sub?: string };
    if (payload.sub) await ensurePlatformAdminRole(payload.sub);
  } catch {
    // Non-fatal: role assignment can be retried on next unlock.
  }
  return session;
}

function isAdminSession(v: AdminSession | SignInFailure): v is AdminSession {
  return typeof (v as AdminSession).access_token === "string";
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

    // 1) Try signing in first — cheapest path when the admin already exists.
    const first = await trySignIn(password);
    if (isAdminSession(first)) {
      return { ok: true, session: await attachRole(first) };
    }

    // 2) Only bootstrap if signIn failed with "invalid credentials"
    //    (user does not exist yet). Any other error is surfaced verbatim.
    const looksMissing =
      first.status === 400 ||
      /invalid login credentials|invalid credentials|user not found/i.test(first.error);
    if (!looksMissing) {
      throw new Error(
        `supabase.auth.signInWithPassword failed for ${getAdminEmail()}: ${first.error} (status=${first.status ?? "?"}, code=${first.code ?? "?"}) at platform-pin.functions.ts:verifyPlatformPin`,
      );
    }

    // 3) Create the admin user. If signUp fails, stop and surface the error.
    const state = await ensurePlatformAdmin(password);
    console.log("[platform-pin] ensurePlatformAdmin state", { state });

    // 4) Sign in again — must succeed now, otherwise surface the exact error.
    const second = await trySignIn(password);
    if (!isAdminSession(second)) {
      throw new Error(
        `Platform admin account was ${state} but subsequent supabase.auth.signInWithPassword still failed for ${getAdminEmail()}: ${second.error} (status=${second.status ?? "?"}, code=${second.code ?? "?"}). Check that PLATFORM_ADMIN_PASSWORD matches the stored user's password and that email confirmations are disabled. (platform-pin.functions.ts:verifyPlatformPin)`,
      );
    }
    return { ok: true, session: await attachRole(second) };
  });


/** Authenticated admin — reveal the current plaintext PIN. */
export const getPlatformPin = createServerFn({ method: "GET" })
  .middleware([requirePlatformAuth])
  .handler(async (): Promise<{ pin: string }> => {
    const row = await loadRow();
    return { pin: row?.platform_pin_plain ?? DEFAULT_PIN };
  });

/** Authenticated admin — set a new PIN (min 4 digits). */
export const updatePlatformPin = createServerFn({ method: "POST" })
  .middleware([requirePlatformAuth])
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

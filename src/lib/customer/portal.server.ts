// Server-only helpers for the Customer Banking Platform.
// Kept in a *.server.ts file so it never ships to the client bundle.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return toHex(buf.buffer);
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const data = encoder.encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  const computed = await hashPassword(password, salt);
  // constant-time-ish compare
  if (computed.length !== hash.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) mismatch |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  return mismatch === 0;
}

/** Bank-scoped customer number, e.g. C-4F92A1. */
export function generateCustomerNumber(): string {
  return `C-${randomHex(4).toUpperCase()}`;
}

/** Bank-scoped account number formatted for the given country. */
export function generateAccountNumber(countryCode?: string | null): string {
  const cc = (countryCode ?? "").toUpperCase();
  const digits = (n: number) => {
    let s = "";
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < n; i++) s += (bytes[i] % 10).toString();
    return s;
  };
  const alnum = (n: number) => {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    let s = "";
    for (let i = 0; i < n; i++) s += alphabet[bytes[i] % alphabet.length];
    return s;
  };
  switch (cc) {
    case "US":
    case "CA":
      return digits(10);
    case "GB": {
      const sort = `${digits(2)}-${digits(2)}-${digits(2)}`;
      return `${sort} ${digits(8)}`;
    }
    case "NG":
    case "ZA":
    case "KE":
    case "GH":
      return digits(10);
    case "IN":
      return digits(11);
    case "AU":
    case "NZ":
      return `${digits(6)}-${digits(9)}`;
    case "DE":
    case "FR":
    case "ES":
    case "IT":
    case "NL":
    case "IE":
    case "PT":
    case "BE":
      // IBAN-style: 2 letters + 2 digits + 18 alnum (approx 22 chars total)
      return `${cc}${digits(2)}${alnum(18)}`;
    case "BR":
      return `${digits(4)}-${digits(1)} ${digits(8)}-${digits(1)}`;
    case "AE":
    case "SA":
      return `${cc}${digits(2)}${alnum(20)}`;
    default:
      return digits(12);
  }
}


export const COOKIE_PREFIX = "themix_customer_";

export type ParsedCookies = Record<string, string>;

export function parseCookies(header: string | null | undefined): ParsedCookies {
  const out: ParsedCookies = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return out;
}

export function cookieName(slug: string): string {
  return `${COOKIE_PREFIX}${slug}`;
}

export function buildSessionCookie(opts: {
  slug: string;
  token: string | null;
  maxAgeSeconds: number;
}): string {
  const name = cookieName(opts.slug);
  const value = opts.token ?? "";
  // Path is "/" so the cookie is sent to server-function endpoints (/_serverFn/*)
  // as well as the tenant subtree. Uniqueness is provided by the per-slug name.
  const attrs = [
    `${name}=${value}`,
    `Path=/`,
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ];
  if (opts.token) {
    attrs.push(`Max-Age=${opts.maxAgeSeconds}`);
  } else {
    attrs.push("Max-Age=0");
  }
  return attrs.join("; ");
}

/** Resolve a bank by either its short_slug or its long slug. Returns null if not found. */
export async function resolveBankBySlug(
  slug: string,
): Promise<{ id: string; owner_id: string; slug: string; short_slug: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .from("bb_bank_drafts")
    .select("id, owner_id, slug, short_slug")
    .or(`short_slug.eq.${slug},slug.eq.${slug}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    owner_id: data.owner_id,
    slug: data.slug!,
    short_slug: data.short_slug ?? null,
  };
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

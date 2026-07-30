import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withPlatformServiceRole } from "@/integrations/supabase/platform-service-middleware";
import { logActivity } from "@/lib/gboc/domain-activity";
import type {
  PorkbunDomainCheck,
  PorkbunDomainCreateResult,
  PorkbunRegistrant,
} from "./porkbun.types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DNS_TARGET = "themix-builder.lovable.app";
const PLATFORM_A_RECORDS = ["185.158.133.1"];
const VERIFICATION_PREFIX = "themix-verify";

const PORKBUN_API = "https://api.porkbun.com/api/json/v3";

function pbAuth() {
  return {
    apikey: process.env.PORKBUN_API_KEY ?? "",
    secretapikey: process.env.PORKBUN_SECRET_API_KEY ?? "",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function pbPost<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const url = `${PORKBUN_API}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...pbAuth(), ...body }),
  });
  const json = await res.json() as { status: string; message?: string; code?: string; [key: string]: unknown };
  if (json.status !== "SUCCESS") {
    const msg = json.message ?? json.code ?? "Porkbun API error";
    throw new Error(String(msg));
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Common TLDs to check
// ---------------------------------------------------------------------------
const COMMON_TLDS = ["com", "net", "io", "org", "co", "app", "dev", "bank", "finance", "money", "global"];

type CheckResponse = {
  status: string;
  response: {
    domain: string;
    avail: string;
    price: string;
    currency: string;
  };
};

type CreateResponse = {
  status: string;
  domain: string;
  orderId: number;
  cost: number;
  balance: number;
};

type PricingResponse = {
  status: string;
  pricing: Record<string, { registration: string; renewal: string; transfer: string }>;
};

type DnsCreateResponse = {
  status: string;
  id: number;
};

// ---------------------------------------------------------------------------
// Server Functions
// ---------------------------------------------------------------------------

/** Check credentials by pinging the Porkbun API */
export const pingPorkbun = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .handler(async (): Promise<{ ip: string }> => {
    const res = await pbPost<{ status: string; yourIp: string }>("/ping");
    return { ip: res.yourIp };
  });

/** Search domain availability across common TLDs */
export const checkPorkbunDomains = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { keyword: string; tlds?: string[] }) =>
    z.object({ keyword: z.string().min(1).max(100), tlds: z.array(z.string()).optional() }).parse(d),
  )
  .handler(async ({ data }): Promise<PorkbunDomainCheck[]> => {
    const tlds = data.tlds ?? COMMON_TLDS;
    const results: PorkbunDomainCheck[] = [];

    for (const tld of tlds) {
      const domain = `${data.keyword}.${tld}`;
      try {
        const res = await pbPost<CheckResponse>(`/domain/checkDomain/${domain}`);
        const avail = res.response.avail;
        const price = parseFloat(res.response.price);
        results.push({
          domain,
          tld,
          available: avail === "yes",
          price: Math.round(price * 100), // dollars → pennies
          costDisplay: `$${price.toFixed(2)}`,
        });
      } catch {
        // Domain not checkable for this TLD — skip silently
        results.push({
          domain, tld,
          available: false,
          price: 0,
          costDisplay: "—",
        });
      }
    }
    return results;
  });

/** Get pricing for TLDs from Porkbun */
export const getPorkbunPricing = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { tlds?: string[] }) => z.object({ tlds: z.array(z.string()).optional() }).parse(d))
  .handler(async ({ data }): Promise<Record<string, { registration: string; renewal: string }>> => {
    // The pricing endpoint is public (no auth needed for reads)
    const url = `${PORKBUN_API}/pricing/get`;
    const body: Record<string, unknown> = {};
    if (data.tlds?.length) body.tlds = data.tlds;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json() as PricingResponse;
    if (json.status !== "SUCCESS") throw new Error("Failed to get pricing");

    const out: Record<string, { registration: string; renewal: string }> = {};
    for (const [tld, p] of Object.entries(json.pricing)) {
      out[tld] = {
        registration: p.registration,
        renewal: p.renewal,
      };
    }
    return out;
  });

/** Register a domain via Porkbun and auto-configure DNS */
export const registerPorkbunDomain = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: {
    bank_id: string;
    domain: string;
    years: number;
    registrant: PorkbunRegistrant;
  }) =>
    z.object({
      bank_id: z.string().uuid(),
      domain: z.string().trim().toLowerCase(),
      years: z.number().int().min(1).max(10),
      registrant: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        address1: z.string().min(1),
        city: z.string().min(1),
        stateProvince: z.string().min(1),
        postalCode: z.string().min(1),
        country: z.string().length(2),
        phone: z.string().min(1),
        emailAddress: z.string().email(),
      }),
    }).parse(d),
  )
  .handler(async ({ context, data }): Promise<{ success: boolean; domain: string; error?: string }> => {
    const { domain, registrant, bank_id } = data;
    const [sld, tld] = domain.split(".");
    if (!sld || !tld) throw new Error(`Invalid domain: ${domain}`);

    // Step 1: Check availability + get exact price
    let check: CheckResponse;
    try {
      check = await pbPost<CheckResponse>(`/domain/checkDomain/${domain}`);
    } catch (e) {
      return { success: false, domain, error: `Failed to check domain: ${(e as Error).message}` };
    }
    if (check.response.avail !== "yes") {
      return { success: false, domain, error: `${domain} is not available for registration` };
    }

    const pricePennies = Math.round(parseFloat(check.response.price) * 100);
    if (pricePennies <= 0) {
      return { success: false, domain, error: "Invalid domain price returned" };
    }

    // Build contact params for the registration
    // Porkbun expects contacts as a nested object or individual fields
    const contactFields = [
      "registrant", "tech", "admin", "billing",
    ] as const;
    const contactParams: Record<string, unknown> = {};
    for (const prefix of contactFields) {
      contactParams[prefix] = {
        firstName: registrant.firstName,
        lastName: registrant.lastName,
        address1: registrant.address1,
        city: registrant.city,
        state: registrant.stateProvince,
        zip: registrant.postalCode,
        country: registrant.country,
        phone: registrant.phone,
        email: registrant.emailAddress,
      };
    }

    // Step 2: Register the domain
    let createRes: CreateResponse;
    try {
      createRes = await pbPost<CreateResponse>(`/domain/create/${domain}`, {
        cost: pricePennies,
        agreeToTerms: "yes",
        ...contactParams,
      });
    } catch (e) {
      return { success: false, domain, error: `Registration failed: ${(e as Error).message}` };
    }

    // Step 3: Auto-configure DNS
    const verificationToken = crypto.randomUUID().replace(/-/g, "");
    const dnsOk = await setPorkbunDns(domain, verificationToken);
    if (!dnsOk) {
      await logActivity(context.supabase as never, {
        bank_id,
        domain,
        action: "domain_registered",
        result: "warn",
        message: `Registered ${domain} (order ${createRes.orderId}) but DNS auto-configuration failed. Configure DNS manually.`,
        actor_id: context.userId,
      });
      return { success: true, domain, error: "Registered but DNS auto-config failed" };
    }

    // Step 4: Upsert into bank_custom_domains
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + data.years * 365 * 24 * 60 * 60 * 1000).toISOString();
    const { error: upsertErr } = await context.supabase
      .from("bank_custom_domains")
      .upsert({
        bank_id,
        domain,
        is_primary: true,
        status: "connected",
        dns_status: "verified",
        ssl_status: "pending",
        verification_token: verificationToken,
        last_verified_at: now,
        connected_since: now,
        registrant_info: registrant,
        registered_via: "porkbun",
        registration_expires_at: expiresAt,
        auto_dns: true,
      }, { onConflict: "bank_id" });

    if (upsertErr) {
      return { success: true, domain, error: `Domain registered but DB save failed: ${upsertErr.message}` };
    }

    await logActivity(context.supabase as never, {
      bank_id,
      domain,
      action: "domain_registered",
      result: "info",
      message: `Registered ${domain} via Porkbun (order ${createRes.orderId}). DNS auto-configured.`,
      actor_id: context.userId,
    });

    return { success: true, domain };
  });

/** Set DNS records on Porkbun for a domain */
async function setPorkbunDns(domain: string, verificationToken: string): Promise<boolean> {
  const [sld, tld] = domain.split(".");
  if (!sld || !tld) return false;

  const labels = domain.split(".").filter(Boolean);
  const isApex = labels.length <= 2;

  const records: Array<{ name: string; type: string; content: string; ttl: string }> = [];

  if (isApex) {
    records.push({ name: "", type: "A", content: PLATFORM_A_RECORDS[0], ttl: "600" });
    records.push({ name: "www", type: "CNAME", content: DNS_TARGET, ttl: "600" });
  } else {
    records.push({ name: "", type: "CNAME", content: DNS_TARGET, ttl: "600" });
  }
  records.push({ name: "_themix", type: "TXT", content: `${VERIFICATION_PREFIX}=${verificationToken}`, ttl: "600" });

  try {
    for (const r of records) {
      await pbPost<DnsCreateResponse>(`/dns/create/${domain}`, {
        name: r.name,
        type: r.type,
        content: r.content,
        ttl: r.ttl,
      });
    }
    return true;
  } catch {
    return false;
  }
}

/** (Re)configure DNS records for an existing domain */
export const configurePorkbunDns = createServerFn({ method: "POST" })
  .middleware([withPlatformServiceRole])
  .inputValidator((d: { bank_id: string }) => z.object({ bank_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }): Promise<{ success: boolean; error?: string }> => {
    const { data: row } = await context.supabase
      .from("bank_custom_domains")
      .select("domain, verification_token")
      .eq("bank_id", data.bank_id)
      .maybeSingle() as never;
    const r = row as { domain: string | null; verification_token: string | null } | null;
    if (!r?.domain) throw new Error("No domain configured for this bank");
    const token = r.verification_token ?? crypto.randomUUID().replace(/-/g, "");
    const ok = await setPorkbunDns(r.domain, token);
    if (!ok) throw new Error("Failed to configure DNS on Porkbun");
    await logActivity(context.supabase as never, {
      bank_id: data.bank_id,
      domain: r.domain,
      action: "dns_updated",
      result: "info",
      message: `DNS records reconfigured for ${r.domain}.`,
      actor_id: context.userId,
    });
    return { success: true };
  });

/** Price estimate lookup for display before checking */
export const TLD_PRICE_ESTIMATES: Record<string, number> = {
  com: 10.98, net: 12.98, org: 11.98, io: 42.98, co: 12.98,
  app: 14.98, dev: 14.98, bank: 75.00, finance: 15.98,
  money: 15.98, global: 42.98,
};

export { type PorkbunDomainCheck, type PorkbunRegistrant };

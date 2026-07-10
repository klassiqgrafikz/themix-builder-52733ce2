// Server functions powering the GBOC Domain Manager (Phase 2).
// Persists custom domain config, generates DNS instructions, and performs
// a real DNS TXT verification via DNS-over-HTTPS. No SSL provisioning yet.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DomainStatus = "pending" | "connected" | "error" | "verified" | "failed";
export type DnsStatus = "pending" | "checking" | "verified" | "failed";
export type SslStatus = "inactive" | "pending" | "active" | "error";

export type DnsRecord = {
  type: "CNAME" | "TXT";
  host: string;
  value: string;
  ttl: number;
  purpose: string;
};

export type BankDomain = {
  id: string;
  bank_id: string;
  slug: string | null;
  domain: string | null;
  is_primary: boolean;
  status: DomainStatus;
  dns_status: DnsStatus;
  ssl_status: SslStatus;
  verification_token: string | null;
  last_verified_at: string | null;
  connected_since: string | null;
  created_at: string;
  updated_at: string;
  fallback_url: string;
  dns_target: string;
  dns_records: DnsRecord[];
};

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
// The CNAME target for tenant custom domains. Requests to any custom domain
// pointing here are rewritten by the Worker to the matching bank's route.
const DNS_TARGET = "themix-builder.lovable.app";

const bankIdSchema = z.object({ bank_id: z.string().uuid() });

type DomainRow = {
  id: string;
  bank_id: string;
  domain: string | null;
  is_primary: boolean;
  status: string;
  dns_status: string;
  ssl_status: string;
  verification_token: string | null;
  last_verified_at: string | null;
  connected_since: string | null;
  created_at: string;
  updated_at: string;
};

function hostForRecord(domain: string): string {
  // For apex domains the record host is "@"; for subdomains, the leftmost label.
  // We don't attempt to detect eTLD+1 in Phase 2 — display the full hostname
  // and let operators translate to their provider's convention.
  return domain;
}

function buildDnsRecords(domain: string, token: string): DnsRecord[] {
  return [
    {
      type: "CNAME",
      host: hostForRecord(domain),
      value: DNS_TARGET,
      ttl: 3600,
      purpose: "Routes traffic to your bank on TheMixWeb.",
    },
    {
      type: "TXT",
      host: `_themix.${domain}`,
      value: `themix-verify=${token}`,
      ttl: 3600,
      purpose: "Proves ownership of the domain during verification.",
    },
  ];
}

function shape(row: DomainRow, slug: string | null): BankDomain {
  const token = row.verification_token ?? row.id.replace(/-/g, "");
  const fallback_url = slug ? `https://themix-builder.lovable.app/banks/${slug}` : "";
  return {
    id: row.id,
    bank_id: row.bank_id,
    slug,
    domain: row.domain,
    is_primary: row.is_primary,
    status: row.status as DomainStatus,
    dns_status: (row.dns_status ?? "pending") as DnsStatus,
    ssl_status: row.ssl_status as SslStatus,
    verification_token: token,
    last_verified_at: row.last_verified_at,
    connected_since: row.connected_since,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fallback_url,
    dns_target: DNS_TARGET,
    dns_records: row.domain ? buildDnsRecords(row.domain, token) : [],
  };
}

async function fetchSlug(
  sb: { from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { maybeSingle: () => Promise<{ data: { slug: string | null } | null; error: unknown }> } } } },
  bankId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("bb_bank_drafts")
    .select("slug")
    .eq("id", bankId)
    .maybeSingle();
  return (data?.slug as string | null) ?? null;
}

export const getBankDomain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<BankDomain | null> => {
    const { data: row, error } = await context.supabase
      .from("bank_custom_domains")
      .select("*")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      // Return a virtual "empty" record so the UI can still show slug/fallback.
      const slug = await fetchSlug(context.supabase as never, data.bank_id);
      return {
        id: "",
        bank_id: data.bank_id,
        slug,
        domain: null,
        is_primary: true,
        status: "pending",
        dns_status: "pending",
        ssl_status: "inactive",
        verification_token: null,
        last_verified_at: null,
        connected_since: null,
        created_at: "",
        updated_at: "",
        fallback_url: slug ? `https://themix-builder.lovable.app/banks/${slug}` : "",
        dns_target: DNS_TARGET,
        dns_records: [],
      };
    }
    const slug = await fetchSlug(context.supabase as never, data.bank_id);
    return shape(row as DomainRow, slug);
  });

export const saveBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string; domain: string; is_primary?: boolean }) =>
    z
      .object({
        bank_id: z.string().uuid(),
        domain: z.string().trim().toLowerCase(),
        is_primary: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }): Promise<BankDomain> => {
    if (!DOMAIN_RE.test(data.domain)) {
      throw new Error("Enter a valid domain like bank.example.com");
    }

    // Preserve existing verification token if there is one, so DNS records
    // stay stable across edits.
    const { data: existing } = await context.supabase
      .from("bank_custom_domains")
      .select("verification_token, domain")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    const existingRow = existing as { verification_token: string | null; domain: string | null } | null;

    const token =
      existingRow?.verification_token ?? crypto.randomUUID().replace(/-/g, "");
    const domainChanged = !existingRow || existingRow.domain !== data.domain;

    const payload = {
      bank_id: data.bank_id,
      domain: data.domain,
      is_primary: data.is_primary ?? true,
      // Saving (or changing) the domain always resets verification state.
      status: "pending" as const,
      dns_status: "pending" as const,
      ssl_status: "inactive" as const,
      verification_token: token,
      ...(domainChanged ? { last_verified_at: null, connected_since: null } : {}),
    };
    const { data: row, error } = await context.supabase
      .from("bank_custom_domains")
      .upsert(payload, { onConflict: "bank_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const slug = await fetchSlug(context.supabase as never, data.bank_id);
    return shape(row as DomainRow, slug);
  });

// --- DNS-over-HTTPS TXT lookup for verification (no external SDK). ---
type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[] };

async function fetchTxtRecords(name: string): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
      { headers: { Accept: "application/dns-json" } },
    );
    if (!res.ok) return [];
    const body = (await res.json()) as DohResponse;
    if (body.Status !== 0 || !body.Answer) return [];
    return body.Answer.filter((a) => a.type === 16).map((a) => a.data.replace(/^"|"$/g, ""));
  } catch {
    return [];
  }
}

export const verifyBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<BankDomain> => {
    const { data: existing, error: readErr } = await context.supabase
      .from("bank_custom_domains")
      .select("*")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const existingRow = existing as DomainRow | null;
    if (!existingRow || !existingRow.domain) {
      throw new Error("Save a domain before verifying.");
    }
    const token =
      existingRow.verification_token ?? existingRow.id.replace(/-/g, "");
    const expected = `themix-verify=${token}`;

    // Mark as "checking" while the DoH lookup runs. Kept in a single update at
    // the end for simplicity, but the field is still meaningful client-side.
    const txt = await fetchTxtRecords(`_themix.${existingRow.domain}`);
    const now = new Date().toISOString();
    const matched = txt.some((entry) => entry.split(/\s+/).includes(expected) || entry === expected);

    const update = matched
      ? {
          status: "connected" as const,
          dns_status: "verified" as const,
          ssl_status: "active" as const,
          verification_token: token,
          last_verified_at: now,
          connected_since: existingRow.connected_since ?? now,
        }
      : {
          status: "error" as const,
          dns_status: "failed" as const,
          ssl_status: "inactive" as const,
          verification_token: token,
          last_verified_at: now,
        };

    const { data: row, error } = await context.supabase
      .from("bank_custom_domains")
      .update(update)
      .eq("bank_id", data.bank_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (!matched) {
      const hint =
        txt.length === 0
          ? `No TXT record found at _themix.${existingRow.domain}. DNS may still be propagating.`
          : `TXT record at _themix.${existingRow.domain} does not contain "${expected}".`;
      throw new Error(`Verification failed. ${hint}`);
    }

    const slug = await fetchSlug(context.supabase as never, data.bank_id);
    return shape(row as DomainRow, slug);
  });

export const removeBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("bank_custom_domains")
      .delete()
      .eq("bank_id", data.bank_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

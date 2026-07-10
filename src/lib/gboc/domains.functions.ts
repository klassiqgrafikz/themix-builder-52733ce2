// Server functions powering the GBOC Domain Manager.
// Persists custom-domain config, generates DNS instructions for apex or
// subdomains, and performs live DNS + reachability diagnostics via
// DNS-over-HTTPS and HEAD requests. No SSL provisioning yet.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logActivity } from "@/lib/gboc/domain-activity";

export type DomainStatus = "pending" | "connected" | "error" | "verified" | "failed";
export type DnsStatus =
  | "pending"
  | "checking"
  | "verified"
  | "failed"
  | "not_configured"
  | "propagating"
  | "incorrect";
export type SslStatus =
  | "inactive"
  | "pending"
  | "requesting"
  | "issuing"
  | "active"
  | "expired"
  | "error";

export type DomainKind = "apex" | "subdomain";

export type DnsRecord = {
  type: "CNAME" | "TXT" | "A";
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
  domain_kind: DomainKind | null;
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
  dns_a_records: string[];
  dns_records: DnsRecord[];
};

export type DiagnosticStatus = "pass" | "fail" | "warn" | "pending" | "skipped";

export type DiagnosticCheck = {
  key: string;
  label: string;
  status: DiagnosticStatus;
  message: string;
  expected?: string[];
  found?: string[];
};

export type DomainDiagnostics = {
  domain: string;
  domain_kind: DomainKind;
  overall: "verified" | "failed" | "propagating";
  checked_at: string;
  checks: DiagnosticCheck[];
  meta: {
    resolved_a: string[];
    resolved_cname: string[];
    txt_records: string[];
    ttl: number | null;
    http_status: number | null;
    https_status: number | null;
    response_time_ms: number | null;
    routing_active: boolean;
    propagation_percent: number;
  };
};

// --- Constants ---------------------------------------------------------------
const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const DNS_TARGET = "themix-builder.lovable.app";
// Platform edge IPs for apex A-record setup. Update here when infrastructure
// changes; the UI reads these to render instructions.
const PLATFORM_A_RECORDS = ["185.158.133.1"];
// Small PSL-lite: two-label public suffixes that should still be treated as
// apex when the domain uses them (e.g. example.co.uk is apex, foo.example.co.uk
// is a subdomain). Not exhaustive — good enough for common ccTLDs.
const TWO_LABEL_TLDS = new Set([
  "co.uk","org.uk","gov.uk","ac.uk","co.jp","or.jp","ne.jp","com.au","net.au",
  "org.au","com.br","com.mx","co.nz","co.za","co.in","co.kr","com.sg","com.hk",
  "com.tr","com.tw","com.cn","com.ar","com.co",
]);

// --- Utilities ---------------------------------------------------------------
function classifyDomain(domain: string): DomainKind {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return "apex";
  const lastTwo = labels.slice(-2).join(".");
  if (TWO_LABEL_TLDS.has(lastTwo) && labels.length === 3) return "apex";
  return "subdomain";
}

function subdomainLabel(domain: string): string {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  return labels[0] ?? domain;
}

function buildDnsRecords(domain: string, token: string): DnsRecord[] {
  const kind = classifyDomain(domain);
  const txt: DnsRecord = {
    type: "TXT",
    host: `_themix.${domain}`,
    value: `themix-verify=${token}`,
    ttl: 3600,
    purpose: "Proves ownership of the domain during verification.",
  };
  if (kind === "apex") {
    return [
      ...PLATFORM_A_RECORDS.map<DnsRecord>((ip) => ({
        type: "A",
        host: "@",
        value: ip,
        ttl: 3600,
        purpose: "Points the apex domain to TheMixWeb's edge.",
      })),
      txt,
    ];
  }
  return [
    {
      type: "CNAME",
      host: subdomainLabel(domain),
      value: DNS_TARGET,
      ttl: 3600,
      purpose: "Routes the subdomain to your bank on TheMixWeb.",
    },
    txt,
  ];
}

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

function shape(row: DomainRow, slug: string | null): BankDomain {
  const token = row.verification_token ?? row.id.replace(/-/g, "");
  const fallback_url = slug ? `https://themix-builder.lovable.app/banks/${slug}` : "";
  return {
    id: row.id,
    bank_id: row.bank_id,
    slug,
    domain: row.domain,
    domain_kind: row.domain ? classifyDomain(row.domain) : null,
    is_primary: row.is_primary,
    status: row.status as DomainStatus,
    dns_status: (row.dns_status ?? "pending") as DnsStatus,
    verification_token: token,
    ssl_status: row.ssl_status as SslStatus,
    last_verified_at: row.last_verified_at,
    connected_since: row.connected_since,
    created_at: row.created_at,
    updated_at: row.updated_at,
    fallback_url,
    dns_target: DNS_TARGET,
    dns_a_records: PLATFORM_A_RECORDS,
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

// --- Schemas ----------------------------------------------------------------
const bankIdSchema = z.object({ bank_id: z.string().uuid() });

// --- Read -------------------------------------------------------------------
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
    const slug = await fetchSlug(context.supabase as never, data.bank_id);
    if (!row) {
      return {
        id: "",
        bank_id: data.bank_id,
        slug,
        domain: null,
        domain_kind: null,
        is_primary: true,
        status: "pending",
        dns_status: "not_configured",
        ssl_status: "inactive",
        verification_token: null,
        last_verified_at: null,
        connected_since: null,
        created_at: "",
        updated_at: "",
        fallback_url: slug ? `https://themix-builder.lovable.app/banks/${slug}` : "",
        dns_target: DNS_TARGET,
        dns_a_records: PLATFORM_A_RECORDS,
        dns_records: [],
      };
    }
    return shape(row as DomainRow, slug);
  });

// --- Save -------------------------------------------------------------------
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
    const domain = data.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
    if (!DOMAIN_RE.test(domain)) {
      throw new Error("Enter a valid domain like bank.example.com");
    }

    // Reject duplicates already connected to another bank.
    const { data: dup } = await context.supabase
      .from("bank_custom_domains")
      .select("bank_id")
      .eq("domain", domain)
      .maybeSingle();
    const dupRow = dup as { bank_id: string } | null;
    if (dupRow && dupRow.bank_id !== data.bank_id) {
      throw new Error(
        `"${domain}" is already connected to another bank on this platform.`,
      );
    }

    const { data: existing } = await context.supabase
      .from("bank_custom_domains")
      .select("verification_token, domain")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    const existingRow = existing as { verification_token: string | null; domain: string | null } | null;

    const token =
      existingRow?.verification_token ?? crypto.randomUUID().replace(/-/g, "");
    const domainChanged = !existingRow || existingRow.domain !== domain;

    const payload = {
      bank_id: data.bank_id,
      domain,
      is_primary: data.is_primary ?? true,
      status: "pending" as const,
      dns_status: "pending" as const,
      ssl_status: "pending" as const,
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
    await logActivity(context.supabase, {
      bank_id: data.bank_id,
      domain,
      action: domainChanged ? "domain_added" : "domain_updated",
      result: "info",
      message: domainChanged
        ? `Custom domain ${domain} configured.`
        : `Domain settings updated for ${domain}.`,
      actor_id: context.userId,
    });
    return shape(row as DomainRow, slug);
  });

// --- DNS lookups over DoH ---------------------------------------------------
type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[] };

async function dohLookup(
  name: string,
  type: "A" | "TXT" | "CNAME",
): Promise<{ answers: DohAnswer[]; ttl: number | null }> {
  try {
    // Add cache-buster so successive Force Recheck calls hit fresh resolvers.
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}&_=${Date.now()}`;
    const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
    if (!res.ok) return { answers: [], ttl: null };
    const body = (await res.json()) as DohResponse;
    if (body.Status !== 0 || !body.Answer) return { answers: [], ttl: null };
    const typeCode = type === "A" ? 1 : type === "CNAME" ? 5 : 16;
    const answers = body.Answer.filter((a) => a.type === typeCode);
    const ttl = answers.length ? Math.min(...answers.map((a) => a.TTL)) : null;
    return { answers, ttl };
  } catch {
    return { answers: [], ttl: null };
  }
}

async function httpProbe(url: string): Promise<{ status: number | null; ms: number | null }> {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual" });
    return { status: res.status, ms: Date.now() - started };
  } catch {
    return { status: null, ms: null };
  }
}

// --- Diagnostics ------------------------------------------------------------
async function runDiagnostics(
  domain: string,
  token: string,
  expectedSlug: string | null,
): Promise<DomainDiagnostics> {
  const kind = classifyDomain(domain);
  const checks: DiagnosticCheck[] = [];
  const expectedTxt = `themix-verify=${token}`;

  // TXT
  const txtRes = await dohLookup(`_themix.${domain}`, "TXT");
  const txtValues = txtRes.answers.map((a) => a.data.replace(/^"|"$/g, ""));
  const txtOk = txtValues.some((v) => v.split(/\s+/).includes(expectedTxt) || v === expectedTxt);
  checks.push({
    key: "txt",
    label: "TXT verification",
    status: txtOk ? "pass" : "fail",
    message: txtOk
      ? `Verification token found at _themix.${domain}.`
      : txtValues.length
        ? `TXT record at _themix.${domain} does not contain the expected token.`
        : `No TXT record found at _themix.${domain}. DNS may still be propagating.`,
    expected: [expectedTxt],
    found: txtValues,
  });

  // CNAME (subdomain) or A (apex)
  let resolvedA: string[] = [];
  let resolvedCname: string[] = [];
  let ttl: number | null = txtRes.ttl;

  if (kind === "subdomain") {
    const cnameRes = await dohLookup(domain, "CNAME");
    resolvedCname = cnameRes.answers.map((a) => a.data.replace(/\.$/, "").toLowerCase());
    ttl = ttl ?? cnameRes.ttl;
    const cnameOk = resolvedCname.some((v) => v === DNS_TARGET.toLowerCase());
    checks.push({
      key: "cname",
      label: "CNAME target",
      status: cnameOk ? "pass" : resolvedCname.length ? "fail" : "pending",
      message: cnameOk
        ? `CNAME correctly points to ${DNS_TARGET}.`
        : resolvedCname.length
          ? `CNAME points to ${resolvedCname.join(", ")}. Expected ${DNS_TARGET}.`
          : `No CNAME record found for ${domain}. DNS may still be propagating.`,
      expected: [DNS_TARGET],
      found: resolvedCname,
    });
    // Also resolve A (via CNAME chain) for reachability info.
    const aRes = await dohLookup(domain, "A");
    resolvedA = aRes.answers.map((a) => a.data);
  } else {
    const aRes = await dohLookup(domain, "A");
    resolvedA = aRes.answers.map((a) => a.data);
    ttl = ttl ?? aRes.ttl;
    const expected = new Set(PLATFORM_A_RECORDS);
    const matches = resolvedA.filter((ip) => expected.has(ip));
    const wrong = resolvedA.filter((ip) => !expected.has(ip));
    const aOk = resolvedA.length > 0 && wrong.length === 0;
    checks.push({
      key: "a",
      label: "A records",
      status: aOk
        ? "pass"
        : resolvedA.length === 0
          ? "pending"
          : matches.length > 0
            ? "warn"
            : "fail",
      message: aOk
        ? `A record correctly points to ${resolvedA.join(", ")}.`
        : resolvedA.length === 0
          ? `No A record found for ${domain}. DNS may still be propagating.`
          : `A record points to ${resolvedA.join(", ")}. Expected ${PLATFORM_A_RECORDS.join(", ")}.`,
      expected: PLATFORM_A_RECORDS,
      found: resolvedA,
    });
  }

  // HTTP / HTTPS reachability
  const [httpRes, httpsRes] = await Promise.all([
    httpProbe(`http://${domain}/`),
    httpProbe(`https://${domain}/`),
  ]);
  checks.push({
    key: "https",
    label: "HTTPS reachability",
    status:
      httpsRes.status && httpsRes.status < 500
        ? "pass"
        : httpsRes.status === null
          ? "pending"
          : "fail",
    message:
      httpsRes.status === null
        ? "HTTPS request did not complete. Certificate may still be issuing."
        : `HTTPS responded with status ${httpsRes.status} in ${httpsRes.ms}ms.`,
    found: httpsRes.status ? [String(httpsRes.status)] : [],
  });
  checks.push({
    key: "http",
    label: "HTTP reachability",
    status:
      httpRes.status && httpRes.status < 500
        ? "pass"
        : httpRes.status === null
          ? "pending"
          : "fail",
    message:
      httpRes.status === null
        ? "HTTP request did not complete."
        : `HTTP responded with status ${httpRes.status} in ${httpRes.ms}ms.`,
    found: httpRes.status ? [String(httpRes.status)] : [],
  });

  // Routing: hit HTTPS and confirm the response body/headers correspond to
  // this bank's tenant. We use a lightweight GET on the fallback slug marker.
  let routingActive = false;
  if (httpsRes.status && httpsRes.status < 500) {
    try {
      const probe = await fetch(`https://${domain}/`, {
        method: "GET",
        redirect: "follow",
        headers: { "user-agent": "themix-domain-verifier/1.0" },
      });
      const text = await probe.text();
      routingActive = expectedSlug
        ? text.includes(`/banks/${expectedSlug}`) || text.includes(expectedSlug)
        : probe.status < 400;
    } catch {
      routingActive = false;
    }
  }
  checks.push({
    key: "routing",
    label: "Bank routing",
    status: routingActive ? "pass" : httpsRes.status ? "warn" : "pending",
    message: routingActive
      ? `Domain resolves to /banks/${expectedSlug ?? "…"}.`
      : httpsRes.status
        ? "DNS is correct but bank-specific routing is not yet active."
        : "Waiting for HTTPS to become reachable before checking routing.",
  });

  // Propagation percentage — heuristic: pass=100 / (pass+fail+warn+pending).
  const total = checks.length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const propagation = total ? Math.round((passed / total) * 100) : 0;

  const critical = kind === "apex" ? ["txt", "a"] : ["txt", "cname"];
  const criticalOk = critical.every((k) => checks.find((c) => c.key === k)?.status === "pass");
  const anyFail = checks.some((c) => c.status === "fail");
  const overall: DomainDiagnostics["overall"] = criticalOk
    ? "verified"
    : anyFail
      ? "failed"
      : "propagating";

  return {
    domain,
    domain_kind: kind,
    overall,
    checked_at: new Date().toISOString(),
    checks,
    meta: {
      resolved_a: resolvedA,
      resolved_cname: resolvedCname,
      txt_records: txtValues,
      ttl,
      http_status: httpRes.status,
      https_status: httpsRes.status,
      response_time_ms: httpsRes.ms ?? httpRes.ms,
      routing_active: routingActive,
      propagation_percent: propagation,
    },
  };
}

// --- Diagnose (read-only, does not update DB) -------------------------------
export const diagnoseBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<DomainDiagnostics | null> => {
    const { data: existing, error } = await context.supabase
      .from("bank_custom_domains")
      .select("*")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const row = existing as DomainRow | null;
    if (!row || !row.domain) return null;
    const token = row.verification_token ?? row.id.replace(/-/g, "");
    const slug = await fetchSlug(context.supabase as never, data.bank_id);
    return runDiagnostics(row.domain, token, slug);
  });

// --- Verify (runs diagnostics and persists resulting state) -----------------
export const verifyBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ domain: BankDomain; diagnostics: DomainDiagnostics }> => {
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
    const token = existingRow.verification_token ?? existingRow.id.replace(/-/g, "");
    const slug = await fetchSlug(context.supabase as never, data.bank_id);
    const diagnostics = await runDiagnostics(existingRow.domain, token, slug);
    const now = new Date().toISOString();
    const verified = diagnostics.overall === "verified";

    const update = verified
      ? {
          status: "connected" as const,
          dns_status: "verified" as const,
          ssl_status: (diagnostics.meta.https_status && diagnostics.meta.https_status < 500
            ? "active"
            : "issuing") as SslStatus,
          verification_token: token,
          last_verified_at: now,
          connected_since: existingRow.connected_since ?? now,
        }
      : diagnostics.overall === "propagating"
        ? {
            status: "pending" as const,
            dns_status: "propagating" as const,
            ssl_status: "pending" as SslStatus,
            verification_token: token,
            last_verified_at: now,
          }
        : {
            status: "error" as const,
            dns_status: "incorrect" as const,
            ssl_status: "inactive" as SslStatus,
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
    return { domain: shape(row as DomainRow, slug), diagnostics };
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

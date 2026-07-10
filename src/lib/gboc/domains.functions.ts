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
  host_fqdn?: string;
  host_note?: string;
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

export type DnsLogEntry = {
  resolver: string;
  resolver_url: string;
  hostname: string;
  type: "A" | "TXT" | "CNAME" | "NS";
  status: "ok" | "nxdomain" | "servfail" | "network_error" | "http_error";
  status_code: number | null;
  http_status: number | null;
  ttl: number | null;
  raw: string;
  parsed: string[];
  latency_ms: number;
  error?: string;
};

export type ResolverSummary = {
  hostname: string;
  type: "A" | "TXT" | "CNAME";
  per_resolver: Array<{
    resolver: string;
    parsed: string[];
    status: DnsLogEntry["status"];
    ttl: number | null;
  }>;
  agreement: "unanimous" | "partial" | "disagreement" | "none";
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
    resolver_results: ResolverSummary[];
    dns_logs: DnsLogEntry[];
    next_retry_at: string | null;
    failure_reason: string | null;
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
  // Most DNS UIs (Namecheap, GoDaddy, Cloudflare, Hostinger, Porkbun,
  // DigitalOcean, Squarespace) expect the "short" host and append the zone
  // automatically. Route53 / Google Cloud DNS / Azure DNS accept either.
  // We display the short form and also expose the FQDN as an alternative.
  const txt: DnsRecord = {
    type: "TXT",
    host: "_themix",
    host_fqdn: `_themix.${domain}`,
    host_note:
      `Enter "_themix" in the Host/Name field. If your DNS provider requires the fully-qualified name, use "_themix.${domain}" instead. Never enter both.`,
    value: `themix-verify=${token}`,
    ttl: 3600,
    purpose: "Proves ownership of the domain during verification.",
  };
  if (kind === "apex") {
    return [
      ...PLATFORM_A_RECORDS.map<DnsRecord>((ip) => ({
        type: "A",
        host: "@",
        host_fqdn: domain,
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
      host_fqdn: domain,
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
// --- Multi-resolver DNS-over-HTTPS ------------------------------------------
// Query multiple public DoH resolvers in parallel so a stale cache or single
// resolver outage cannot break verification. Every query is logged with the
// raw response so operators can diagnose provider/DNSSEC/propagation issues.
type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[]; Comment?: string };

const RESOLVERS: Array<{ id: string; name: string; url: string }> = [
  { id: "cloudflare", name: "Cloudflare (1.1.1.1)", url: "https://cloudflare-dns.com/dns-query" },
  { id: "google", name: "Google (8.8.8.8)", url: "https://dns.google/resolve" },
  { id: "quad9", name: "Quad9 (9.9.9.9)", url: "https://dns.quad9.net:5053/dns-query" },
];

const TYPE_CODE = { A: 1, CNAME: 5, TXT: 16, NS: 2 } as const;

function normalizeTxt(raw: string): string {
  // Cloudflare returns TXT strings quoted, sometimes as multiple quoted parts
  // ("part1" "part2") that per RFC 6763 concatenate without a separator.
  // Google returns them unquoted. Some resolvers escape backslashes. Normalize
  // to a single flat string so equality checks are provider-agnostic.
  let s = raw.trim();
  // If the whole string is a quoted list, concatenate quoted parts.
  if (s.startsWith('"')) {
    const parts = [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) =>
      m[1].replace(/\\(.)/g, "$1"),
    );
    if (parts.length) s = parts.join("");
  }
  return s;
}

async function queryResolver(
  resolver: (typeof RESOLVERS)[number],
  hostname: string,
  type: keyof typeof TYPE_CODE,
): Promise<DnsLogEntry> {
  const started = Date.now();
  const url = `${resolver.url}?name=${encodeURIComponent(hostname)}&type=${type}&_=${started}`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/dns-json" } });
    const text = await res.text();
    const latency_ms = Date.now() - started;
    if (!res.ok) {
      return {
        resolver: resolver.name, resolver_url: resolver.url, hostname, type,
        status: "http_error", status_code: null, http_status: res.status,
        ttl: null, raw: text.slice(0, 2000), parsed: [], latency_ms,
        error: `HTTP ${res.status}`,
      };
    }
    let body: DohResponse;
    try { body = JSON.parse(text) as DohResponse; }
    catch (e) {
      return {
        resolver: resolver.name, resolver_url: resolver.url, hostname, type,
        status: "network_error", status_code: null, http_status: res.status,
        ttl: null, raw: text.slice(0, 2000), parsed: [], latency_ms,
        error: (e as Error).message,
      };
    }
    const code = TYPE_CODE[type];
    const answers = (body.Answer ?? []).filter((a) => a.type === code);
    const parsed = answers.map((a) =>
      type === "TXT" ? normalizeTxt(a.data) :
      type === "CNAME" || type === "NS" ? a.data.replace(/\.$/, "").toLowerCase() :
      a.data,
    );
    const ttl = answers.length ? Math.min(...answers.map((a) => a.TTL)) : null;
    const status: DnsLogEntry["status"] =
      body.Status === 0 ? "ok" :
      body.Status === 3 ? "nxdomain" :
      body.Status === 2 ? "servfail" : "network_error";
    return {
      resolver: resolver.name, resolver_url: resolver.url, hostname, type,
      status, status_code: body.Status, http_status: res.status, ttl,
      raw: JSON.stringify(body).slice(0, 4000), parsed, latency_ms,
      error: body.Comment,
    };
  } catch (e) {
    return {
      resolver: resolver.name, resolver_url: resolver.url, hostname, type,
      status: "network_error", status_code: null, http_status: null, ttl: null,
      raw: "", parsed: [], latency_ms: Date.now() - started,
      error: (e as Error).message,
    };
  }
}

type MultiLookup = {
  logs: DnsLogEntry[];
  summary: ResolverSummary;
  union: string[]; // any resolver saw this value
  intersection: string[]; // all successful resolvers agree
  successful: number;
  ttl: number | null;
};

async function multiLookup(
  hostname: string,
  type: "A" | "TXT" | "CNAME",
): Promise<MultiLookup> {
  const logs = await Promise.all(RESOLVERS.map((r) => queryResolver(r, hostname, type)));
  const successful = logs.filter((l) => l.status === "ok");
  const per_resolver = logs.map((l) => ({
    resolver: l.resolver, parsed: l.parsed, status: l.status, ttl: l.ttl,
  }));
  const setsOk = successful.map((l) => new Set(l.parsed));
  const union = Array.from(new Set(successful.flatMap((l) => l.parsed)));
  const intersection = setsOk.length
    ? Array.from(setsOk.reduce((acc, s) => new Set([...acc].filter((v) => s.has(v)))))
    : [];
  const withData = successful.filter((l) => l.parsed.length > 0).length;
  const agreement: ResolverSummary["agreement"] =
    successful.length === 0 ? "none" :
    withData === 0 ? "none" :
    intersection.length > 0 && withData === successful.length ? "unanimous" :
    intersection.length > 0 ? "partial" : "disagreement";
  const ttl = successful.map((l) => l.ttl).filter((t): t is number => t != null);
  return {
    logs,
    summary: { hostname, type, per_resolver, agreement },
    union, intersection,
    successful: successful.length,
    ttl: ttl.length ? Math.min(...ttl) : null,
  };
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
  const allLogs: DnsLogEntry[] = [];
  const resolverResults: ResolverSummary[] = [];
  const failureReasons: string[] = [];

  const summarizeResolvers = (m: MultiLookup): string => {
    const bits = m.summary.per_resolver.map((r) =>
      `${r.resolver}: ${r.status}${r.parsed.length ? ` [${r.parsed.join(", ")}]` : ""}`,
    );
    return bits.join(" · ");
  };

  // --- TXT verification (multi-hostname + multi-resolver) -------------------
  // Providers disagree on Host format: Namecheap wants "_themix", Route53
  // accepts either, and users occasionally publish the token under the apex
  // or a doubled hostname ("_themix.example.com.example.com"). We look in
  // every RFC-valid location and accept the record wherever it appears.
  const txtCanonical = `_themix.${domain}`;
  const txtCandidates = Array.from(
    new Set([
      txtCanonical,
      // User pasted the FQDN into a provider that auto-appends the zone.
      `_themix.${domain}.${domain}`,
      // Some users publish the token on the apex itself.
      domain,
    ]),
  );

  const txtLookups = await Promise.all(
    txtCandidates.map((h) => multiLookup(h, "TXT")),
  );
  const txt = txtLookups[0]; // canonical — used as the "primary" summary
  for (const l of txtLookups) allLogs.push(...l.logs);
  resolverResults.push(txt.summary);

  const txtMatch = (v: string): boolean => {
    // Normalize: strip surrounding whitespace, collapse quoted parts, and
    // ignore optional whitespace or provider-inserted separators.
    const clean = v.replace(/"/g, "").replace(/\s+/g, "");
    if (clean === expectedTxt) return true;
    // Some providers wrap multiple TXT strings with ";" or ",".
    return clean.split(/[,;]/).some((part) => part.trim() === expectedTxt);
  };

  // Which resolvers, across which candidate hostnames, saw the token?
  const resolverHits = new Map<string, string>(); // resolver -> hostname that matched
  const wrongHostnameHits: string[] = [];
  for (let i = 0; i < txtLookups.length; i++) {
    const l = txtLookups[i];
    const host = txtCandidates[i];
    for (const r of l.summary.per_resolver) {
      if (r.parsed.some(txtMatch)) {
        if (!resolverHits.has(r.resolver)) resolverHits.set(r.resolver, host);
        if (host !== txtCanonical) wrongHostnameHits.push(host);
      }
    }
  }
  const canonicalHits = [...resolverHits.entries()].filter(
    ([, host]) => host === txtCanonical,
  );
  const anyHits = resolverHits.size;
  const txtValuesUnion = Array.from(
    new Set(txtLookups.flatMap((l) => l.union)),
  );
  const anyNx = txt.logs.every((l) => l.status === "nxdomain");
  const allNetErr = txt.successful === 0;

  // Confidence scoring — if authoritative DNS (any recursive resolver
  // successfully returned the token at the canonical hostname), accept it.
  // We do NOT require unanimity across resolvers; propagation lag on a
  // single resolver must not block verification.
  let txtStatus: DiagnosticStatus = "pass";
  let txtMessage = `Verification token confirmed at ${txtCanonical}.`;
  const txtOk = canonicalHits.length > 0;
  if (!txtOk) {
    if (anyHits > 0 && wrongHostnameHits.length > 0) {
      // Smart suggestion: token found at the wrong hostname.
      const wrong = Array.from(new Set(wrongHostnameHits))[0];
      txtStatus = "fail";
      const hint = wrong === `_themix.${domain}.${domain}`
        ? `Your DNS provider auto-appended the zone. Set the Host to "_themix" (without ".${domain}").`
        : wrong === domain
          ? `Move the TXT record to the "_themix" subrecord instead of the apex.`
          : `Move the TXT record to "${txtCanonical}".`;
      txtMessage = `TXT record found under "${wrong}" but the platform expects "${txtCanonical}". ${hint}`;
      failureReasons.push("txt_wrong_hostname");
    } else if (txtValuesUnion.length > 0) {
      txtStatus = "fail";
      txtMessage = `TXT record at ${txtCanonical} exists but the value does not match. Expected "${expectedTxt}", found "${txtValuesUnion.join('", "')}". Update the TXT value and re-verify.`;
      failureReasons.push("txt_value_mismatch");
    } else if (allNetErr) {
      txtStatus = "pending";
      txtMessage = `Could not reach any DNS resolver for ${txtCanonical}. Retrying automatically.`;
      failureReasons.push("resolvers_unreachable");
    } else if (anyNx) {
      txtStatus = "fail";
      txtMessage = `No TXT record found at ${txtCanonical}. Add the TXT record shown below and wait for propagation.`;
      failureReasons.push("txt_missing");
    } else {
      txtStatus = "pending";
      txtMessage = `No TXT record found at ${txtCanonical} yet. DNS may still be propagating (${summarizeResolvers(txt)}).`;
      failureReasons.push("txt_propagating");
    }
  } else if (canonicalHits.length < txt.successful) {
    // Passed on some resolvers but not all — still a pass under confidence
    // scoring, but surface the propagation detail for transparency.
    txtMessage = `Verification token confirmed at ${txtCanonical} on ${canonicalHits.map(([r]) => r).join(", ")}. Other resolvers are still catching up — no action required.`;
  }
  checks.push({
    key: "txt",
    label: "TXT verification",
    status: txtStatus,
    message: txtMessage,
    expected: [expectedTxt],
    found: txtValuesUnion,
  });


  // --- CNAME (subdomain) or A (apex) ----------------------------------------
  let resolvedA: string[] = [];
  let resolvedCname: string[] = [];
  let ttl: number | null = txt.ttl;

  if (kind === "subdomain") {
    const cname = await multiLookup(domain, "CNAME");
    allLogs.push(...cname.logs);
    resolverResults.push(cname.summary);
    resolvedCname = cname.union;
    ttl = ttl ?? cname.ttl;
    const target = DNS_TARGET.toLowerCase();
    const resolversOk = cname.summary.per_resolver.filter((r) =>
      r.parsed.some((v) => v === target),
    );
    const cnameOk = resolversOk.length === cname.successful && cname.successful > 0;
    const cnamePartial = resolversOk.length > 0 && !cnameOk;
    let cnStatus: DiagnosticStatus = "pass";
    let cnMsg = `CNAME correctly points to ${DNS_TARGET} on all ${cname.successful} resolvers.`;
    if (!cnameOk) {
      if (cnamePartial) {
        cnStatus = "warn";
        cnMsg = `CNAME is propagating: ${resolversOk.map((r) => r.resolver).join(", ")} return ${DNS_TARGET}; others still cache the old value (${summarizeResolvers(cname)}).`;
        failureReasons.push("cname_propagating");
      } else if (resolvedCname.length > 0) {
        cnStatus = "fail";
        cnMsg = `CNAME points to ${resolvedCname.join(", ")}. Expected ${DNS_TARGET}. Update the CNAME target at your DNS provider.`;
        failureReasons.push("cname_wrong_target");
      } else if (cname.successful === 0) {
        cnStatus = "pending";
        cnMsg = `Could not reach any DNS resolver for ${domain}. Retrying.`;
        failureReasons.push("resolvers_unreachable");
      } else {
        cnStatus = "pending";
        cnMsg = `No CNAME record found for ${domain} yet. DNS may still be propagating. Resolver detail: ${summarizeResolvers(cname)}.`;
        failureReasons.push("cname_missing");
      }
    }
    checks.push({
      key: "cname", label: "CNAME target",
      status: cnStatus, message: cnMsg,
      expected: [DNS_TARGET], found: resolvedCname,
    });
    // Chase A for reachability, but do not gate on it.
    const aChase = await multiLookup(domain, "A");
    allLogs.push(...aChase.logs);
    resolvedA = aChase.union;
  } else {
    const a = await multiLookup(domain, "A");
    allLogs.push(...a.logs);
    resolverResults.push(a.summary);
    resolvedA = a.union;
    ttl = ttl ?? a.ttl;
    const expected = new Set(PLATFORM_A_RECORDS);
    const resolversOk = a.summary.per_resolver.filter(
      (r) => r.parsed.length > 0 && r.parsed.every((ip) => expected.has(ip)),
    );
    const aOk = resolversOk.length === a.successful && a.successful > 0 && resolvedA.length > 0;
    const aPartial = resolversOk.length > 0 && !aOk;
    const wrong = resolvedA.filter((ip) => !expected.has(ip));
    let aStatus: DiagnosticStatus = "pass";
    let aMsg = `A record correctly points to ${resolvedA.join(", ")} on all ${a.successful} resolvers.`;
    if (!aOk) {
      if (aPartial) {
        aStatus = "warn";
        aMsg = `A record is propagating: ${resolversOk.map((r) => r.resolver).join(", ")} are correct; others still return old values (${summarizeResolvers(a)}).`;
        failureReasons.push("a_propagating");
      } else if (wrong.length > 0) {
        aStatus = "fail";
        aMsg = `A record points to ${resolvedA.join(", ")}. Expected ${PLATFORM_A_RECORDS.join(", ")}. Remove old A records and add the ones shown below.`;
        failureReasons.push("a_wrong_target");
      } else if (a.successful === 0) {
        aStatus = "pending";
        aMsg = `Could not reach any DNS resolver for ${domain}. Retrying.`;
        failureReasons.push("resolvers_unreachable");
      } else {
        aStatus = "pending";
        aMsg = `No A record found for ${domain} yet. DNS may still be propagating. Resolver detail: ${summarizeResolvers(a)}.`;
        failureReasons.push("a_missing");
      }
    }
    checks.push({
      key: "a", label: "A records",
      status: aStatus, message: aMsg,
      expected: PLATFORM_A_RECORDS, found: resolvedA,
    });
  }

  // --- HTTP / HTTPS reachability --------------------------------------------
  const [httpRes, httpsRes] = await Promise.all([
    httpProbe(`http://${domain}/`),
    httpProbe(`https://${domain}/`),
  ]);
  checks.push({
    key: "https", label: "HTTPS reachability",
    status:
      httpsRes.status && httpsRes.status < 500 ? "pass" :
      httpsRes.status === null ? "pending" : "fail",
    message: httpsRes.status === null
      ? "HTTPS request did not complete. Certificate may still be issuing."
      : `HTTPS responded with status ${httpsRes.status} in ${httpsRes.ms}ms.`,
    found: httpsRes.status ? [String(httpsRes.status)] : [],
  });
  checks.push({
    key: "http", label: "HTTP reachability",
    status:
      httpRes.status && httpRes.status < 500 ? "pass" :
      httpRes.status === null ? "pending" : "fail",
    message: httpRes.status === null
      ? "HTTP request did not complete."
      : `HTTP responded with status ${httpRes.status} in ${httpRes.ms}ms.`,
    found: httpRes.status ? [String(httpRes.status)] : [],
  });

  // --- Routing check ---------------------------------------------------------
  let routingActive = false;
  if (httpsRes.status && httpsRes.status < 500) {
    try {
      const probe = await fetch(`https://${domain}/`, {
        method: "GET", redirect: "follow",
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
    key: "routing", label: "Bank routing",
    status: routingActive ? "pass" : httpsRes.status ? "warn" : "pending",
    message: routingActive
      ? `Domain resolves to /banks/${expectedSlug ?? "…"}.`
      : httpsRes.status
        ? "DNS is correct but bank-specific routing is not yet active."
        : "Waiting for HTTPS to become reachable before checking routing.",
  });

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

  const nextRetryMs = overall === "propagating" ? 60_000 : overall === "failed" ? 300_000 : null;

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
      resolver_results: resolverResults,
      dns_logs: allLogs,
      next_retry_at: nextRetryMs ? new Date(Date.now() + nextRetryMs).toISOString() : null,
      failure_reason: failureReasons[0] ?? null,
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

    const action =
      diagnostics.overall === "verified"
        ? "verification_passed"
        : diagnostics.overall === "propagating"
          ? "verification_propagating"
          : "verification_failed";
    const result =
      diagnostics.overall === "verified"
        ? "success"
        : diagnostics.overall === "propagating"
          ? "info"
          : "error";
    const failMsgs = diagnostics.checks
      .filter((c) => c.status === "fail")
      .map((c) => `${c.label}: ${c.message}`)
      .join(" ");
    await logActivity(context.supabase, {
      bank_id: data.bank_id,
      domain: existingRow.domain,
      action,
      result,
      message:
        diagnostics.overall === "verified"
          ? `Verified ${existingRow.domain}. Propagation ${diagnostics.meta.propagation_percent}%.`
          : diagnostics.overall === "propagating"
            ? `Still propagating (${diagnostics.meta.propagation_percent}%).`
            : failMsgs || "Verification failed.",
      actor_id: context.userId,
    });
    return { domain: shape(row as DomainRow, slug), diagnostics };
  });

export const removeBankDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { bank_id: string }) => bankIdSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { data: existing } = await context.supabase
      .from("bank_custom_domains")
      .select("domain")
      .eq("bank_id", data.bank_id)
      .maybeSingle();
    const domain = (existing as { domain: string | null } | null)?.domain ?? null;
    const { error } = await context.supabase
      .from("bank_custom_domains")
      .delete()
      .eq("bank_id", data.bank_id);
    if (error) throw new Error(error.message);
    await logActivity(context.supabase, {
      bank_id: data.bank_id,
      domain,
      action: "domain_removed",
      result: "warning",
      message: domain ? `Removed custom domain ${domain}.` : "Removed custom domain.",
      actor_id: context.userId,
    });
    return { ok: true };
  });

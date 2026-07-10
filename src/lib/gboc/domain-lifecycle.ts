// Client-side deterministic lifecycle for the Domain Setup Wizard.
//
// Derives a single lifecycle stage from the existing BankDomain row +
// DomainDiagnostics so the UI can drive automatic progression, milestone
// notifications, and a Vercel/Netlify-style progress timeline WITHOUT any
// schema changes. Also owns the smart-retry cadence and the localStorage
// resume-key so background polling survives a page refresh.

import type { BankDomain, DomainDiagnostics } from "@/lib/gboc/domains.functions";

export type LifecycleStage =
  | "draft"
  | "waiting_dns"
  | "dns_detected"
  | "txt_verified"
  | "routing_ready"
  | "ssl_requested"
  | "ssl_provisioning"
  | "ssl_active"
  | "connected"
  | "warning"
  | "failed"
  | "timed_out";

export const LIFECYCLE_ORDER: LifecycleStage[] = [
  "draft",
  "waiting_dns",
  "dns_detected",
  "txt_verified",
  "routing_ready",
  "ssl_requested",
  "ssl_provisioning",
  "ssl_active",
  "connected",
];

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  draft: "Draft",
  waiting_dns: "Waiting for DNS",
  dns_detected: "DNS Detected",
  txt_verified: "TXT Verified",
  routing_ready: "Routing Ready",
  ssl_requested: "SSL Requested",
  ssl_provisioning: "SSL Provisioning",
  ssl_active: "SSL Active",
  connected: "Connected",
  warning: "Warning",
  failed: "Failed",
  timed_out: "Verification Timed Out",
};

// Timeline items shown to the user. Order matches automatic progression.
export const TIMELINE_ITEMS: Array<{ key: string; label: string; stage: LifecycleStage }> = [
  { key: "domain_added", label: "Domain Added", stage: "waiting_dns" },
  { key: "dns_records", label: "DNS Records Found", stage: "dns_detected" },
  { key: "txt", label: "TXT Verified", stage: "txt_verified" },
  { key: "routing", label: "Routing Enabled", stage: "routing_ready" },
  { key: "ssl_requested", label: "SSL Certificate Requested", stage: "ssl_requested" },
  { key: "ssl_provisioning", label: "SSL Provisioning", stage: "ssl_provisioning" },
  { key: "https", label: "HTTPS Active", stage: "ssl_active" },
  { key: "connected", label: "Domain Connected", stage: "connected" },
];

function checkStatus(d: DomainDiagnostics | null, keys: string[]) {
  if (!d) return null;
  const found = d.checks.find((c) => keys.includes(c.key));
  return found?.status ?? null;
}

/** Deterministic derivation — the only source of truth for wizard UI state. */
export function deriveStage(
  row: BankDomain | null,
  diagnostics: DomainDiagnostics | null,
  timedOut: boolean,
): LifecycleStage {
  if (!row?.domain) return "draft";
  if (timedOut && row.status !== "connected") return "timed_out";

  const ssl = row.ssl_status;
  const connected = row.status === "connected" && row.dns_status === "verified";
  if (connected && ssl === "active") return "connected";
  if (connected) return "ssl_active";

  if (!diagnostics) {
    return row.last_verified_at ? "waiting_dns" : "waiting_dns";
  }

  if (diagnostics.overall === "failed") return "failed";

  const txt = checkStatus(diagnostics, ["txt"]);
  const target = checkStatus(diagnostics, ["a", "cname"]);
  const https = checkStatus(diagnostics, ["https"]);
  const routing = checkStatus(diagnostics, ["routing"]);

  if (txt === "pass" && target === "pass" && routing === "pass" && https === "pass") {
    if (ssl === "active") return "connected";
    if (ssl === "issuing" || ssl === "requesting") return "ssl_provisioning";
    return "ssl_requested";
  }
  if (txt === "pass" && target === "pass" && routing === "pass") return "routing_ready";
  if (txt === "pass" && target === "pass") return "routing_ready";
  if (txt === "pass") return "txt_verified";
  if (target === "pass" || (diagnostics.meta.propagation_percent ?? 0) > 0) return "dns_detected";
  return "waiting_dns";
}

export function stageIsTerminal(stage: LifecycleStage): boolean {
  return stage === "connected" || stage === "failed" || stage === "timed_out";
}

// --- Smart-retry cadence ----------------------------------------------------
export const LIFECYCLE_TIMEOUT_MS = 48 * 60 * 60_000; // 48h hard stop

/** Returns delay-until-next-retry in ms, or null if we should stop. */
export function nextRetryDelayMs(startMs: number, now: number = Date.now()): number | null {
  const elapsed = now - startMs;
  if (elapsed >= LIFECYCLE_TIMEOUT_MS) return null;
  if (elapsed < 60 * 60_000) return 60_000; // < 1h → every 60s
  if (elapsed < 7 * 60 * 60_000) return 5 * 60_000; // 1–7h → every 5min
  return 30 * 60_000; // after → every 30min
}

/** Interval between passive health-checks once Connected (1 hour). */
export const HEALTH_CHECK_INTERVAL_MS = 60 * 60_000;

// --- Resume-after-refresh persistence ---------------------------------------
const STORAGE_KEY = "themix.domain-lifecycle.v1";

type PersistedState = Record<string, { startedAt: number; domain: string }>;

function readStore(): PersistedState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : {};
  } catch {
    return {};
  }
}

function writeStore(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

export function getPersistedStart(bankId: string, domain: string | null): number | null {
  if (!domain) return null;
  const entry = readStore()[bankId];
  if (!entry || entry.domain !== domain) return null;
  return entry.startedAt;
}

export function persistStart(bankId: string, domain: string, startedAt: number): void {
  const store = readStore();
  store[bankId] = { startedAt, domain };
  writeStore(store);
}

export function clearPersistedStart(bankId: string): void {
  const store = readStore();
  if (bankId in store) {
    delete store[bankId];
    writeStore(store);
  }
}

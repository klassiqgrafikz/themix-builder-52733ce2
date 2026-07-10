// Shared helper for writing to the bank_domain_activity log. Callable from
// within any server function handler; keep this file free of server-only
// imports so it stays safe to import from `.functions.ts` modules.
export type DomainActivityAction =
  | "domain_added"
  | "domain_updated"
  | "domain_removed"
  | "verification_started"
  | "verification_passed"
  | "verification_failed"
  | "verification_propagating"
  | "manual_recheck"
  | "ssl_requested"
  | "ssl_issued"
  | "ssl_renewed"
  | "routing_enabled"
  | "routing_disabled";

export type DomainActivityResult = "info" | "success" | "warning" | "error";

type MinimalSupabase = {
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

export async function logActivity(
  supabase: MinimalSupabase,
  entry: {
    bank_id: string;
    domain: string | null;
    action: DomainActivityAction | string;
    result: DomainActivityResult | string;
    message?: string | null;
    actor_id?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("bank_domain_activity").insert({
      bank_id: entry.bank_id,
      domain: entry.domain,
      action: entry.action,
      result: entry.result,
      message: entry.message ?? null,
      actor_id: entry.actor_id ?? null,
    });
  } catch (err) {
    // Activity logging must never block the primary action.
    console.error("[domain-activity] insert failed", err);
  }
}

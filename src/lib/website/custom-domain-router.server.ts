// Resolves an incoming custom domain host to the matching bank slug so the
// Worker can rewrite the URL to /banks/<slug>. Uses the service-role client
// (server-only) and a short in-memory cache to avoid a DB roundtrip per
// request. Only verified/connected domains are honored.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type CacheEntry = { slug: string | null; expires: number };
const CACHE_TTL_MS = 60_000;
const NEGATIVE_TTL_MS = 15_000;
const cache = new Map<string, CacheEntry>();

export async function resolveCustomDomainSlug(hostname: string): Promise<string | null> {
  const host = hostname.toLowerCase();
  const now = Date.now();
  const cached = cache.get(host);
  if (cached && cached.expires > now) return cached.slug;

  let slug: string | null = null;
  try {
    const { data } = await supabaseAdmin
      .from("bank_custom_domains")
      .select("bank_id, bb_bank_drafts(slug)")
      .eq("domain", host)
      .eq("status", "connected")
      .maybeSingle();
    const draft = (data as { bb_bank_drafts: { slug: string | null } | null } | null)
      ?.bb_bank_drafts;
    slug = draft?.slug ?? null;
  } catch (err) {
    console.error("[custom-domain-router] lookup failed", err);
    slug = null;
  }

  cache.set(host, {
    slug,
    expires: now + (slug ? CACHE_TTL_MS : NEGATIVE_TTL_MS),
  });
  return slug;
}

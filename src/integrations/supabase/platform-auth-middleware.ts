// Centralized auth middleware for PLATFORM MANAGEMENT server functions
// (Global Admin, GBOC, Bank Management, Domain Manager, Branding,
// Dashboard Designer, Product Catalog, Blueprint Library).
//
// Behavior:
// - Default: identical to `requireSupabaseAuth` (Supabase bearer required).
// - When env `DEV_PIN_BYPASS === "true"`: skip Supabase Auth entirely and
//   inject a service-role Supabase client + sentinel userId/claims into
//   context. This is a TEMPORARY migration aid — remove by unsetting the
//   env var. Never use this middleware for customer-facing surfaces
//   (customer login/portal/transactions/accounts/cards/notifications or
//   public banking pages).
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";

// Reused sentinel so bypassed handlers have a stable, non-null userId.
export const DEV_BYPASS_USER_ID = "00000000-0000-0000-0000-000000000000";

const bypassMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { supabaseAdmin } = await import("./client.server");
    return next({
      context: {
        supabase: supabaseAdmin,
        userId: DEV_BYPASS_USER_ID,
        claims: { sub: DEV_BYPASS_USER_ID, role: "platform_admin", dev_bypass: true },
      },
    });
  },
);

export const requirePlatformAuth =
  process.env.DEV_PIN_BYPASS === "true" ? bypassMiddleware : requireSupabaseAuth;

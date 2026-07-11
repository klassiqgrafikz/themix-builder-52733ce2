// Platform management middleware — single-owner mode.
//
// This installation runs without operator authentication. Every
// platform-management server function (Global Admin, GBOC, Bank
// Management, Domain Manager, Branding, Dashboard Designer, Product
// Catalog, Blueprint Library, Website Generator) executes with the
// service-role Supabase client.
//
// DO NOT use this middleware for customer-facing surfaces (customer
// login/portal/transactions/accounts/cards/notifications or public
// banking pages) — those must continue to use `requireSupabaseAuth`.
import { createMiddleware } from "@tanstack/react-start";

// Stable sentinel so handlers that read `context.userId` keep working.
export const PLATFORM_OWNER_USER_ID = "00000000-0000-0000-0000-000000000000";

export const withPlatformServiceRole = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { supabaseAdmin } = await import("./client.server");
    return next({
      context: {
        supabase: supabaseAdmin,
        userId: PLATFORM_OWNER_USER_ID,
        claims: { sub: PLATFORM_OWNER_USER_ID, role: "platform_owner" },
      },
    });
  },
);

// Shared cookie-authenticated session resolver for customer server functions.
// Kept alongside `portal.server.ts` so it never ships to the client bundle.
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  cookieName,
  parseCookies,
  resolveBankBySlug,
} from "./portal.server";

export type CustomerSessionCtx = {
  bank: { id: string; slug: string; owner_id: string };
  customer: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
};

export async function requireCustomerSession(slug: string): Promise<CustomerSessionCtx> {
  const bank = await resolveBankBySlug(slug);
  if (!bank) throw new Error("Bank not found");
  const cookies = parseCookies(getRequestHeader("cookie"));
  const token = cookies[cookieName(slug)];
  if (!token) throw new Error("Not signed in");
  const { data: session } = await supabaseAdmin
    .from("bank_customer_sessions")
    .select("customer_id, bank_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!session || session.bank_id !== bank.id) throw new Error("Not signed in");
  if (new Date(session.expires_at).getTime() < Date.now()) throw new Error("Session expired");
  const { data: customer } = await supabaseAdmin
    .from("bank_customers")
    .select("id, email, first_name, last_name")
    .eq("id", session.customer_id)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found");
  return { bank, customer };
}

export async function optionalCustomerSession(
  slug: string,
): Promise<CustomerSessionCtx | null> {
  try {
    return await requireCustomerSession(slug);
  } catch {
    return null;
  }
}

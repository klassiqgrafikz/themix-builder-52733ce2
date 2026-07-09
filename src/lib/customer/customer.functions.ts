import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import type { CustomerAccount, CustomerProfile, CustomerSession, LoginEvent } from "./types";

// ---- shared shapes ----

const ACCOUNT_TYPE_ENUM = z.enum([
  "personal",
  "savings",
  "current",
  "business",
  "joint",
  "student",
]);

const registerSchema = z.object({
  slug: z.string().min(1),
  account_type: ACCOUNT_TYPE_ENUM.default("personal"),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  date_of_birth: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  email: z.string().trim().email().max(180),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  postal_code: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  nationality: z.string().trim().max(80).optional().nullable(),
  id_document_type: z.string().trim().max(60).optional().nullable(),
  id_document_number: z.string().trim().max(80).optional().nullable(),
  id_document_country: z.string().trim().max(80).optional().nullable(),
  employment_status: z.string().trim().max(60).optional().nullable(),
  employer_name: z.string().trim().max(160).optional().nullable(),
  job_title: z.string().trim().max(120).optional().nullable(),
  annual_income: z.number().nonnegative().optional().nullable(),
  next_of_kin_name: z.string().trim().max(160).optional().nullable(),
  next_of_kin_relationship: z.string().trim().max(80).optional().nullable(),
  next_of_kin_phone: z.string().trim().max(40).optional().nullable(),
  next_of_kin_email: z.string().trim().email().max(180).optional().nullable().or(z.literal("")),
  password: z.string().min(8).max(120),
  confirm_password: z.string().min(8).max(120),
});


const loginSchema = z.object({
  slug: z.string().min(1),
  email: z.string().trim().email().max(180),
  password: z.string().min(1).max(120),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shape = (row: any): CustomerProfile => ({
  id: row.id,
  bank_id: row.bank_id,
  customer_number: row.customer_number,
  first_name: row.first_name,
  last_name: row.last_name,
  date_of_birth: row.date_of_birth ?? null,
  gender: row.gender ?? null,
  email: row.email,
  phone: row.phone ?? null,
  address: row.address ?? null,
  country: row.country ?? null,
  nationality: row.nationality ?? null,
  email_verified: !!row.email_verified,
  status: row.status,
  profile_picture_url: row.profile_picture_url ?? null,
  notification_prefs: (row.notification_prefs ?? {}) as CustomerProfile["notification_prefs"],
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shapeAccount = (row: any): CustomerAccount => ({
  id: row.id,
  customer_id: row.customer_id,
  bank_id: row.bank_id,
  account_number: row.account_number,
  account_name: row.account_name,
  currency: row.currency,
  account_type: row.account_type,
  status: row.status,
  current_balance: Number(row.current_balance),
  available_balance: Number(row.available_balance),
  created_at: row.created_at,
  updated_at: row.updated_at,
  iban: row.iban ?? null,
  swift_bic: row.swift_bic ?? null,
  routing_number: row.routing_number ?? null,
  sort_code: row.sort_code ?? null,
  bsb: row.bsb ?? null,
  transit_number: row.transit_number ?? null,
  institution_number: row.institution_number ?? null,
});

// ---- register ----

export const registerCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof registerSchema>) => registerSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; customer_number: string; account_number: string }> => {
      if (data.password !== data.confirm_password) {
        throw new Error("Passwords do not match");
      }
      const {
        resolveBankBySlug,
        randomHex,
        hashPassword,
        generateCustomerNumber,
        generateAccountNumber,
      } = await import("./portal.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { getPublishedBank } = await import("@/lib/website/registry.functions");

      const bank = await resolveBankBySlug(data.slug);
      if (!bank) throw new Error("Bank not found");

      // Check email uniqueness within this tenant.
      const { data: existing } = await supabaseAdmin
        .from("bank_customers")
        .select("id")
        .eq("bank_id", bank.id)
        .ilike("email", data.email)
        .maybeSingle();
      if (existing) throw new Error("An account with this email already exists at this bank.");

      const salt = randomHex(16);
      const password_hash = await hashPassword(data.password, salt);
      const customer_number = generateCustomerNumber();

      // Determine country + currency from the published manifest for account formatting.
      const publishedInfo = await getPublishedBank({ data: { slug: data.slug } }).catch(() => null);
      const currency = publishedInfo?.manifest.bank.currency ?? "USD";
      const bankCountry = publishedInfo?.manifest.bank.country_code ?? null;

      const accountType = data.account_type ?? "personal";
      const accountLabels: Record<string, string> = {
        personal: "Personal Account",
        savings: "Savings Account",
        current: "Current Account",
        business: "Business Account",
        joint: "Joint Account",
        student: "Student Account",
      };

      const { data: inserted, error } = await supabaseAdmin
        .from("bank_customers")
        .insert({
          bank_id: bank.id,
          customer_number,
          first_name: data.first_name,
          last_name: data.last_name,
          date_of_birth: data.date_of_birth || null,
          gender: data.gender || null,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          postal_code: data.postal_code || null,
          country: data.country || null,
          nationality: data.nationality || null,
          id_document_type: data.id_document_type || null,
          id_document_number: data.id_document_number || null,
          id_document_country: data.id_document_country || null,
          employment_status: data.employment_status || null,
          employer_name: data.employer_name || null,
          job_title: data.job_title || null,
          annual_income: data.annual_income ?? null,
          next_of_kin_name: data.next_of_kin_name || null,
          next_of_kin_relationship: data.next_of_kin_relationship || null,
          next_of_kin_phone: data.next_of_kin_phone || null,
          next_of_kin_email: data.next_of_kin_email || null,
          account_type_preference: accountType,
          password_salt: salt,
          password_hash,
          email_verification_token: randomHex(16),
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error(error?.message ?? "Registration failed");

      // Auto-generate default account, formatted for the bank's country.
      const account_number = generateAccountNumber(bankCountry);
      const { error: accErr } = await supabaseAdmin.from("bank_customer_accounts").insert({
        customer_id: inserted.id,
        bank_id: bank.id,
        account_number,
        account_name: `${data.first_name} ${data.last_name} — ${accountLabels[accountType]}`,
        currency,
        account_type: accountType,
        status: "active",
      });
      if (accErr) throw new Error(accErr.message);

      // Welcome email simulation: store a customer notification so the dashboard
      // shows the welcome message on first login.
      const bankName = publishedInfo?.manifest.bank.name ?? "your bank";
      await supabaseAdmin.from("bank_notifications").insert({
        bank_id: bank.id,
        customer_id: inserted.id,
        kind: "welcome_email",
        title: `Welcome to ${bankName}`,
        body:
          `Hi ${data.first_name},\n\n` +
          `Your ${accountLabels[accountType].toLowerCase()} has been created successfully. ` +
          `Your customer number is ${customer_number} and your account number is ${account_number}. ` +
          `Please sign in to activate your account and explore your dashboard.`,
        metadata: {
          simulated_email: true,
          customer_number,
          account_number,
          account_type: accountType,
        },
      });

      await supabaseAdmin.from("bank_customer_login_history").insert({
        customer_id: inserted.id,
        bank_id: bank.id,
        event: "registered",
      });

      return { ok: true, customer_number, account_number };
    },
  );


// ---- login ----

export const loginCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof loginSchema>) => loginSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const {
      resolveBankBySlug,
      randomHex,
      verifyPassword,
      buildSessionCookie,
      SESSION_TTL_SECONDS,
    } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bank = await resolveBankBySlug(data.slug);
    if (!bank) throw new Error("Bank not found");

    const { data: customer, error } = await supabaseAdmin
      .from("bank_customers")
      .select("*")
      .eq("bank_id", bank.id)
      .ilike("email", data.email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!customer) throw new Error("Invalid email or password");
    if (customer.status !== "active") throw new Error("This account is not active");

    const ok = await verifyPassword(data.password, customer.password_salt, customer.password_hash);
    if (!ok) {
      await supabaseAdmin.from("bank_customer_login_history").insert({
        customer_id: customer.id,
        bank_id: bank.id,
        event: "login_failed",
      });
      throw new Error("Invalid email or password");
    }

    const token = randomHex(32);
    const expires = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await supabaseAdmin.from("bank_customer_sessions").insert({
      token,
      customer_id: customer.id,
      bank_id: bank.id,
      expires_at: expires.toISOString(),
    });
    await supabaseAdmin.from("bank_customer_login_history").insert({
      customer_id: customer.id,
      bank_id: bank.id,
      event: "login_success",
    });

    setResponseHeader(
      "Set-Cookie",
      buildSessionCookie({ slug: data.slug, token, maxAgeSeconds: SESSION_TTL_SECONDS }),
    );
    return { ok: true };
  });

// ---- logout ----

export const logoutCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { parseCookies, cookieName, buildSessionCookie } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cookies = parseCookies(getRequestHeader("cookie"));
    const token = cookies[cookieName(data.slug)];
    if (token) {
      await supabaseAdmin.from("bank_customer_sessions").delete().eq("token", token);
    }
    setResponseHeader(
      "Set-Cookie",
      buildSessionCookie({ slug: data.slug, token: null, maxAgeSeconds: 0 }),
    );
    return { ok: true };
  });

// ---- session ----

export const getCurrentCustomer = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<CustomerSession | null> => {
    const { parseCookies, cookieName, resolveBankBySlug } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bank = await resolveBankBySlug(data.slug);
    if (!bank) return null;

    const cookies = parseCookies(getRequestHeader("cookie"));
    const token = cookies[cookieName(data.slug)];
    if (!token) return null;

    const { data: session } = await supabaseAdmin
      .from("bank_customer_sessions")
      .select("customer_id, bank_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!session) return null;
    if (session.bank_id !== bank.id) return null; // strict tenant isolation
    if (new Date(session.expires_at).getTime() < Date.now()) return null;

    const { data: customerRow } = await supabaseAdmin
      .from("bank_customers")
      .select("*")
      .eq("id", session.customer_id)
      .maybeSingle();
    if (!customerRow) return null;

    const { data: accountRows } = await supabaseAdmin
      .from("bank_customer_accounts")
      .select("*")
      .eq("customer_id", customerRow.id)
      .order("created_at", { ascending: true });

    return {
      customer: shape(customerRow),
      accounts: (accountRows ?? []).map(shapeAccount),
    };
  });

// ---- profile update ----

const updateProfileSchema = z.object({
  slug: z.string().min(1),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(400).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  nationality: z.string().trim().max(80).optional().nullable(),
  profile_picture_url: z.string().url().max(500).optional().nullable(),
  notification_prefs: z.record(z.string(), z.unknown()).optional(),
});

export const updateCustomerProfile = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof updateProfileSchema>) => updateProfileSchema.parse(d))
  .handler(async ({ data }): Promise<CustomerProfile> => {
    const { parseCookies, cookieName, resolveBankBySlug } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const bank = await resolveBankBySlug(data.slug);
    if (!bank) throw new Error("Bank not found");
    const cookies = parseCookies(getRequestHeader("cookie"));
    const token = cookies[cookieName(data.slug)];
    if (!token) throw new Error("Not signed in");

    const { data: session } = await supabaseAdmin
      .from("bank_customer_sessions")
      .select("customer_id, bank_id, expires_at")
      .eq("token", token)
      .maybeSingle();
    if (!session || session.bank_id !== bank.id) throw new Error("Not signed in");
    if (new Date(session.expires_at).getTime() < Date.now()) throw new Error("Session expired");

    const patch: Record<string, unknown> = {};
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.address !== undefined) patch.address = data.address;
    if (data.country !== undefined) patch.country = data.country;
    if (data.nationality !== undefined) patch.nationality = data.nationality;
    if (data.profile_picture_url !== undefined) patch.profile_picture_url = data.profile_picture_url;
    if (data.notification_prefs !== undefined) patch.notification_prefs = data.notification_prefs;

    const { data: row, error } = await supabaseAdmin
      .from("bank_customers")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", session.customer_id)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Update failed");
    return shape(row);
  });

// ---- forgot / reset password (simulation) ----

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; email: string }) =>
    z.object({ slug: z.string().min(1), email: z.string().trim().email() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ ok: true; token: string | null }> => {
    const { resolveBankBySlug, randomHex } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bank = await resolveBankBySlug(data.slug);
    if (!bank) throw new Error("Bank not found");
    const { data: customer } = await supabaseAdmin
      .from("bank_customers")
      .select("id")
      .eq("bank_id", bank.id)
      .ilike("email", data.email)
      .maybeSingle();
    if (!customer) return { ok: true, token: null };
    const token = randomHex(24);
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await supabaseAdmin
      .from("bank_customers")
      .update({ password_reset_token: token, password_reset_expires_at: expires.toISOString() })
      .eq("id", customer.id);
    // Simulation only: return token so the UI can show a reset link.
    return { ok: true, token };
  });

const resetSchema = z.object({
  slug: z.string().min(1),
  token: z.string().min(1),
  password: z.string().min(8).max(120),
});

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((d: z.input<typeof resetSchema>) => resetSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { resolveBankBySlug, randomHex, hashPassword } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bank = await resolveBankBySlug(data.slug);
    if (!bank) throw new Error("Bank not found");
    const { data: customer } = await supabaseAdmin
      .from("bank_customers")
      .select("id, password_reset_expires_at")
      .eq("bank_id", bank.id)
      .eq("password_reset_token", data.token)
      .maybeSingle();
    if (!customer) throw new Error("Invalid or expired reset token");
    if (
      !customer.password_reset_expires_at ||
      new Date(customer.password_reset_expires_at).getTime() < Date.now()
    ) {
      throw new Error("Reset token expired");
    }
    const salt = randomHex(16);
    const password_hash = await hashPassword(data.password, salt);
    await supabaseAdmin
      .from("bank_customers")
      .update({
        password_salt: salt,
        password_hash,
        password_reset_token: null,
        password_reset_expires_at: null,
      })
      .eq("id", customer.id);
    return { ok: true };
  });

// ---- email verification (simulation) ----

export const simulateVerifyEmail = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { parseCookies, cookieName, resolveBankBySlug } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bank = await resolveBankBySlug(data.slug);
    if (!bank) throw new Error("Bank not found");
    const cookies = parseCookies(getRequestHeader("cookie"));
    const token = cookies[cookieName(data.slug)];
    if (!token) throw new Error("Not signed in");
    const { data: session } = await supabaseAdmin
      .from("bank_customer_sessions")
      .select("customer_id, bank_id")
      .eq("token", token)
      .maybeSingle();
    if (!session || session.bank_id !== bank.id) throw new Error("Not signed in");
    await supabaseAdmin
      .from("bank_customers")
      .update({ email_verified: true, email_verification_token: null })
      .eq("id", session.customer_id);
    await supabaseAdmin.from("bank_customer_login_history").insert({
      customer_id: session.customer_id,
      bank_id: bank.id,
      event: "email_verified",
    });
    return { ok: true };
  });

// ---- login history ----

export const getLoginHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data }): Promise<LoginEvent[]> => {
    const { parseCookies, cookieName, resolveBankBySlug } = await import("./portal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bank = await resolveBankBySlug(data.slug);
    if (!bank) return [];
    const cookies = parseCookies(getRequestHeader("cookie"));
    const token = cookies[cookieName(data.slug)];
    if (!token) return [];
    const { data: session } = await supabaseAdmin
      .from("bank_customer_sessions")
      .select("customer_id, bank_id")
      .eq("token", token)
      .maybeSingle();
    if (!session || session.bank_id !== bank.id) return [];
    const { data: historyRows } = await supabaseAdmin
      .from("bank_customer_login_history")
      .select("id, event, ip, user_agent, at")
      .eq("customer_id", session.customer_id)
      .order("at", { ascending: false })
      .limit(20);
    return (historyRows ?? []) as LoginEvent[];
  });

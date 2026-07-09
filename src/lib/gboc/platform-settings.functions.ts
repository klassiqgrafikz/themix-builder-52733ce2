// GBOC platform settings (single-row config controlled from the operations center).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";


export type ChatProvider =
  | "none"
  | "tawk"
  | "crisp"
  | "smartsupp"
  | "whatsapp"
  | "telegram";

export type ChatConfig = {
  // Tawk.to
  tawk_property_id?: string;
  tawk_widget_id?: string;
  tawk_link?: string;
  // Crisp
  crisp_website_id?: string;
  crisp_link?: string;
  // Smartsupp
  smartsupp_api_key?: string;
  smartsupp_link?: string;
  // WhatsApp
  whatsapp_number?: string;
  whatsapp_link?: string;
  whatsapp_greeting?: string;
  // Telegram
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  telegram_group_link?: string;
};

export type PlatformSettings = {
  live_chat_enabled: boolean;
  support_email: string | null;
  support_phone: string | null;
  chat_provider: ChatProvider;
  chat_config: ChatConfig;
  updated_at: string;
};

const chatConfigSchema = z
  .object({
    tawk_property_id: z.string().trim().max(120).optional(),
    tawk_widget_id: z.string().trim().max(120).optional(),
    tawk_link: z.string().trim().max(400).optional(),
    crisp_website_id: z.string().trim().max(120).optional(),
    crisp_link: z.string().trim().max(400).optional(),
    smartsupp_api_key: z.string().trim().max(200).optional(),
    smartsupp_link: z.string().trim().max(400).optional(),
    whatsapp_number: z.string().trim().max(40).optional(),
    whatsapp_link: z.string().trim().max(400).optional(),
    whatsapp_greeting: z.string().trim().max(400).optional(),
    telegram_bot_token: z.string().trim().max(200).optional(),
    telegram_chat_id: z.string().trim().max(120).optional(),
    telegram_group_link: z.string().trim().max(400).optional(),
  })
  .default({});

const providerSchema = z.enum([
  "none",
  "tawk",
  "crisp",
  "smartsupp",
  "whatsapp",
  "telegram",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readSettings(row: any): PlatformSettings {
  const s = (row?.settings ?? {}) as Record<string, unknown>;
  const provider = providerSchema.safeParse(s.chat_provider);
  const cfg = chatConfigSchema.safeParse(s.chat_config ?? {});
  return {
    live_chat_enabled: !!row?.live_chat_enabled,
    support_email: row?.support_email ?? null,
    support_phone: row?.support_phone ?? null,
    chat_provider: provider.success ? provider.data : "none",
    chat_config: cfg.success ? cfg.data : {},
    updated_at: row?.updated_at ?? new Date().toISOString(),
  };
}

export const getPlatformSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformSettings> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("gboc_platform_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return readSettings(data);
  },
);

const updateSchema = z.object({
  live_chat_enabled: z.boolean().optional(),
  support_email: z.string().email().max(200).optional().nullable(),
  support_phone: z.string().max(40).optional().nullable(),
  chat_provider: providerSchema.optional(),
  chat_config: chatConfigSchema.optional(),
});




export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof updateSchema>) => updateSchema.parse(d))
  .handler(async ({ data, context }): Promise<PlatformSettings> => {
    const supabaseAdmin = context.supabase;


    // read current settings JSON for merge
    const { data: current } = await supabaseAdmin
      .from("gboc_platform_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    const currentSettings = (current?.settings ?? {}) as Record<string, unknown>;
    const nextSettings: Record<string, unknown> = { ...currentSettings };
    if (data.chat_provider !== undefined) nextSettings.chat_provider = data.chat_provider;
    if (data.chat_config !== undefined) nextSettings.chat_config = data.chat_config;

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      settings: nextSettings,
    };
    if (data.live_chat_enabled !== undefined) patch.live_chat_enabled = data.live_chat_enabled;
    if (data.support_email !== undefined) patch.support_email = data.support_email;
    if (data.support_phone !== undefined) patch.support_phone = data.support_phone;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await supabaseAdmin
      .from("gboc_platform_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ id: 1, ...(patch as any) }, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) return readSettings(row);
    // Fallback: re-read the row if the write returned no representation.
    const { data: fresh, error: readErr } = await supabaseAdmin
      .from("gboc_platform_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    return readSettings(fresh);
  });


// GBOC platform settings (single-row config controlled from the operations center).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlatformSettings = {
  live_chat_enabled: boolean;
  support_email: string | null;
  support_phone: string | null;
  updated_at: string;
};

export const getPlatformSettings = createServerFn({ method: "GET" }).handler(
  async (): Promise<PlatformSettings> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("gboc_platform_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    return {
      live_chat_enabled: !!data?.live_chat_enabled,
      support_email: data?.support_email ?? null,
      support_phone: data?.support_phone ?? null,
      updated_at: data?.updated_at ?? new Date().toISOString(),
    };
  },
);

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      live_chat_enabled?: boolean;
      support_email?: string | null;
      support_phone?: string | null;
    }) =>
      z
        .object({
          live_chat_enabled: z.boolean().optional(),
          support_email: z.string().email().max(200).optional().nullable(),
          support_phone: z.string().max(40).optional().nullable(),
        })
        .parse(d),
  )
  .handler(async ({ data }): Promise<PlatformSettings> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.live_chat_enabled !== undefined) patch.live_chat_enabled = data.live_chat_enabled;
    if (data.support_email !== undefined) patch.support_email = data.support_email;
    if (data.support_phone !== undefined) patch.support_phone = data.support_phone;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await supabaseAdmin
      .from("gboc_platform_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", 1)
      .select("*")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Update failed");
    return {
      live_chat_enabled: !!row.live_chat_enabled,
      support_email: row.support_email,
      support_phone: row.support_phone,
      updated_at: row.updated_at,
    };
  });

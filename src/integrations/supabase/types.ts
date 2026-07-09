export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bb_bank_drafts: {
        Row: {
          admin_controls: Json
          branding: Json
          country_code: string | null
          created_at: string
          current_step: number
          features: Json
          id: string
          identity: Json
          manifest: Json
          mode: string
          navigation: Json
          owner_id: string
          published_at: string | null
          render_logs: Json
          render_status: string
          rendered_at: string | null
          simulation: Json
          slug: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          admin_controls?: Json
          branding?: Json
          country_code?: string | null
          created_at?: string
          current_step?: number
          features?: Json
          id?: string
          identity?: Json
          manifest?: Json
          mode?: string
          navigation?: Json
          owner_id: string
          published_at?: string | null
          render_logs?: Json
          render_status?: string
          rendered_at?: string | null
          simulation?: Json
          slug?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_controls?: Json
          branding?: Json
          country_code?: string | null
          created_at?: string
          current_step?: number
          features?: Json
          id?: string
          identity?: Json
          manifest?: Json
          mode?: string
          navigation?: Json
          owner_id?: string
          published_at?: string | null
          render_logs?: Json
          render_status?: string
          rendered_at?: string | null
          simulation?: Json
          slug?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_bank_drafts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "bb_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_blueprint_categories: {
        Row: {
          description: string
          icon: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          description: string
          icon: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          description?: string
          icon?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      bb_countries: {
        Row: {
          code: string
          currency: string
          default_language: string
          flag_emoji: string
          name: string
          region: string
          timezone: string
        }
        Insert: {
          code: string
          currency: string
          default_language: string
          flag_emoji: string
          name: string
          region: string
          timezone: string
        }
        Update: {
          code?: string
          currency?: string
          default_language?: string
          flag_emoji?: string
          name?: string
          region?: string
          timezone?: string
        }
        Relationships: []
      }
      bb_modules: {
        Row: {
          default_pages: Json
          description: string
          group_name: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          default_pages?: Json
          description: string
          group_name: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          default_pages?: Json
          description?: string
          group_name?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      bb_templates: {
        Row: {
          accent_color: string
          blueprint_category: string | null
          category: string
          country_code: string
          created_at: string
          currency: string
          description: string
          features: Json
          id: string
          is_premium: boolean
          language: string
          mobile_support: boolean
          name: string
          pages: Json
          popularity: number
          primary_color: string
          recommended: boolean
          region: string
          secondary_color: string
          supported_modules: string[]
          theme: string
          updated_at: string
          version: string
        }
        Insert: {
          accent_color: string
          blueprint_category?: string | null
          category: string
          country_code: string
          created_at?: string
          currency: string
          description: string
          features?: Json
          id?: string
          is_premium?: boolean
          language: string
          mobile_support?: boolean
          name: string
          pages?: Json
          popularity?: number
          primary_color: string
          recommended?: boolean
          region: string
          secondary_color: string
          supported_modules?: string[]
          theme?: string
          updated_at?: string
          version?: string
        }
        Update: {
          accent_color?: string
          blueprint_category?: string | null
          category?: string
          country_code?: string
          created_at?: string
          currency?: string
          description?: string
          features?: Json
          id?: string
          is_premium?: boolean
          language?: string
          mobile_support?: boolean
          name?: string
          pages?: Json
          popularity?: number
          primary_color?: string
          recommended?: boolean
          region?: string
          secondary_color?: string
          supported_modules?: string[]
          theme?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_templates_blueprint_category_fkey"
            columns: ["blueprint_category"]
            isOneToOne: false
            referencedRelation: "bb_blueprint_categories"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "bb_templates_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "bb_countries"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

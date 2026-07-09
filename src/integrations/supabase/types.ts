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
      bank_account_restrictions: {
        Row: {
          account_id: string
          active: boolean
          bank_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          end_at: string | null
          id: string
          reason: string
          reference: string | null
          start_at: string | null
          types: string[]
          updated_at: string
        }
        Insert: {
          account_id: string
          active?: boolean
          bank_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          end_at?: string | null
          id?: string
          reason?: string
          reference?: string | null
          start_at?: string | null
          types?: string[]
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          bank_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          end_at?: string | null
          id?: string
          reason?: string
          reference?: string | null
          start_at?: string | null
          types?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_restrictions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_restrictions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_restrictions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_audit_logs: {
        Row: {
          account_id: string | null
          action: string
          actor_email: string | null
          actor_id: string | null
          bank_id: string
          created_at: string
          customer_id: string | null
          id: string
          metadata: Json
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
          reference: string | null
        }
        Insert: {
          account_id?: string | null
          action: string
          actor_email?: string | null
          actor_id?: string | null
          bank_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          metadata?: Json
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
          reference?: string | null
        }
        Update: {
          account_id?: string | null
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          bank_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          metadata?: Json
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_audit_logs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_audit_logs_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_audit_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_customer_accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: string
          available_balance: number
          bank_id: string
          closed_at: string | null
          created_at: string
          currency: string
          current_balance: number
          customer_id: string
          frozen_at: string | null
          id: string
          pending_balance: number
          restriction_summary: Json
          status: string
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          account_type?: string
          available_balance?: number
          bank_id: string
          closed_at?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          customer_id: string
          frozen_at?: string | null
          id?: string
          pending_balance?: number
          restriction_summary?: Json
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: string
          available_balance?: number
          bank_id?: string
          closed_at?: string | null
          created_at?: string
          currency?: string
          current_balance?: number
          customer_id?: string
          frozen_at?: string | null
          id?: string
          pending_balance?: number
          restriction_summary?: Json
          status?: string
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_customer_accounts_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_customer_accounts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_customer_login_history: {
        Row: {
          at: string
          bank_id: string
          customer_id: string
          event: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          at?: string
          bank_id: string
          customer_id: string
          event: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          at?: string
          bank_id?: string
          customer_id?: string
          event?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_customer_login_history_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_customer_login_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_customer_sessions: {
        Row: {
          bank_id: string
          created_at: string
          customer_id: string
          expires_at: string
          ip: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          bank_id: string
          created_at?: string
          customer_id: string
          expires_at: string
          ip?: string | null
          token: string
          user_agent?: string | null
        }
        Update: {
          bank_id?: string
          created_at?: string
          customer_id?: string
          expires_at?: string
          ip?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_customer_sessions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_customers: {
        Row: {
          address: string | null
          bank_id: string
          country: string | null
          created_at: string
          customer_number: string
          date_of_birth: string | null
          email: string
          email_verification_token: string | null
          email_verified: boolean
          first_name: string
          gender: string | null
          id: string
          last_name: string
          nationality: string | null
          notification_prefs: Json
          password_hash: string
          password_reset_expires_at: string | null
          password_reset_token: string | null
          password_salt: string
          phone: string | null
          profile_picture_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_id: string
          country?: string | null
          created_at?: string
          customer_number: string
          date_of_birth?: string | null
          email: string
          email_verification_token?: string | null
          email_verified?: boolean
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          nationality?: string | null
          notification_prefs?: Json
          password_hash: string
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          password_salt: string
          phone?: string | null
          profile_picture_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_id?: string
          country?: string | null
          created_at?: string
          customer_number?: string
          date_of_birth?: string | null
          email?: string
          email_verification_token?: string | null
          email_verified?: boolean
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          nationality?: string | null
          notification_prefs?: Json
          password_hash?: string
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          password_salt?: string
          phone?: string | null
          profile_picture_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_customers_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_ledger_entries: {
        Row: {
          account_id: string
          amount: number
          available_after: number
          balance_after: number
          bank_id: string
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          description: string | null
          direction: string
          entry_type: string
          event_type: string | null
          id: string
          metadata: Json
          reference: string | null
          status: string
          transaction_id: string | null
        }
        Insert: {
          account_id: string
          amount: number
          available_after: number
          balance_after: number
          bank_id: string
          created_at?: string
          created_by?: string | null
          currency: string
          customer_id: string
          description?: string | null
          direction: string
          entry_type: string
          event_type?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          status?: string
          transaction_id?: string | null
        }
        Update: {
          account_id?: string
          amount?: number
          available_after?: number
          balance_after?: number
          bank_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          description?: string | null
          direction?: string
          entry_type?: string
          event_type?: string | null
          id?: string
          metadata?: Json
          reference?: string | null
          status?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      bank_notifications: {
        Row: {
          bank_id: string
          body: string
          created_at: string
          customer_id: string
          id: string
          kind: string
          metadata: Json
          read_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bank_id: string
          body?: string
          created_at?: string
          customer_id: string
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bank_id?: string
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_notifications_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          account_id: string
          amount: number
          available_after: number
          balance_after: number
          bank_id: string
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          description: string
          direction: string
          id: string
          kind: string
          metadata: Json
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          available_after: number
          balance_after: number
          bank_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency: string
          customer_id: string
          description?: string
          direction: string
          id?: string
          kind: string
          metadata?: Json
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          available_after?: number
          balance_after?: number
          bank_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          description?: string
          direction?: string
          id?: string
          kind?: string
          metadata?: Json
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bank_customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "bank_customers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bp_bank_products: {
        Row: {
          created_at: string
          display_label: string | null
          draft_id: string
          enabled: boolean
          product_code: string
          sort_order: number
          updated_at: string
          visibility: string
        }
        Insert: {
          created_at?: string
          display_label?: string | null
          draft_id: string
          enabled?: boolean
          product_code: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Update: {
          created_at?: string
          display_label?: string | null
          draft_id?: string
          enabled?: boolean
          product_code?: string
          sort_order?: number
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_bank_products_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "bb_bank_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_bank_products_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "bp_products"
            referencedColumns: ["code"]
          },
        ]
      }
      bp_blueprint_products: {
        Row: {
          blueprint_id: string
          created_at: string
          product_code: string
          sort_order: number
        }
        Insert: {
          blueprint_id: string
          created_at?: string
          product_code: string
          sort_order?: number
        }
        Update: {
          blueprint_id?: string
          created_at?: string
          product_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "bp_blueprint_products_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "bb_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bp_blueprint_products_product_code_fkey"
            columns: ["product_code"]
            isOneToOne: false
            referencedRelation: "bp_products"
            referencedColumns: ["code"]
          },
        ]
      }
      bp_product_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      bp_products: {
        Row: {
          category_slug: string
          code: string
          created_at: string
          default_visible: boolean
          description: string
          eligibility: Json
          icon: string
          id: string
          name: string
          sort_order: number
          status: string
          supported_countries: string[]
          supported_currencies: string[]
          updated_at: string
          visibility: string
        }
        Insert: {
          category_slug: string
          code: string
          created_at?: string
          default_visible?: boolean
          description?: string
          eligibility?: Json
          icon?: string
          id?: string
          name: string
          sort_order?: number
          status?: string
          supported_countries?: string[]
          supported_currencies?: string[]
          updated_at?: string
          visibility?: string
        }
        Update: {
          category_slug?: string
          code?: string
          created_at?: string
          default_visible?: boolean
          description?: string
          eligibility?: Json
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          status?: string
          supported_countries?: string[]
          supported_currencies?: string[]
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "bp_products_category_slug_fkey"
            columns: ["category_slug"]
            isOneToOne: false
            referencedRelation: "bp_product_categories"
            referencedColumns: ["slug"]
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

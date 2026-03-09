/**
 * Database types for Supabase
 * Auto-generated from Supabase project schema (YOUR_SUPABASE_PROJECT_REF)
 * Last regenerated: 2026-02-16
 *
 * To regenerate: Use Supabase MCP `generate_typescript_types` with project_id `YOUR_SUPABASE_PROJECT_REF`
 *
 * NOTE: Each table MUST include a `Relationships` key (even if empty [])
 * for @supabase/postgrest-js v2.90+ type inference to work.
 * Without it, all query results resolve to `never`.
 */

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          job_id: string | null
          transaction_id: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          job_id?: string | null
          transaction_id?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          job_id?: string | null
          transaction_id?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      job_outputs: {
        Row: {
          content_type: string | null
          created_at: string | null
          dimensions: string | null
          file_size_bytes: number | null
          filename: string
          job_id: string
          marketplace: string
          output_id: string
          output_url: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          dimensions?: string | null
          file_size_bytes?: number | null
          filename: string
          job_id: string
          marketplace: string
          output_id?: string
          output_url: string
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          dimensions?: string | null
          file_size_bytes?: number | null
          filename?: string
          job_id?: string
          marketplace?: string
          output_id?: string
          output_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_outputs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      jobs: {
        Row: {
          ai_prompt: string | null
          classification_confidence: number | null
          classification_details: Json | null
          completed_at: string | null
          cost_usd: number | null
          created_at: string
          enhancements: Json | null
          error_message: string | null
          job_id: string
          marketplaces: Json | null
          output_image_url: string | null
          output_image_urls: Json | null
          preset_id: string | null
          preset_name: string | null
          processing_time_seconds: number | null
          product_image_url: string
          product_name: string
          product_type: string
          reference_image_url: string | null
          status: string
          updated_at: string
          user_id: string
          workflow_id: string | null
        }
        Insert: {
          ai_prompt?: string | null
          classification_confidence?: number | null
          classification_details?: Json | null
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          enhancements?: Json | null
          error_message?: string | null
          job_id?: string
          marketplaces?: Json | null
          output_image_url?: string | null
          output_image_urls?: Json | null
          preset_id?: string | null
          preset_name?: string | null
          processing_time_seconds?: number | null
          product_image_url: string
          product_name: string
          product_type: string
          reference_image_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workflow_id?: string | null
        }
        Update: {
          ai_prompt?: string | null
          classification_confidence?: number | null
          classification_details?: Json | null
          completed_at?: string | null
          cost_usd?: number | null
          created_at?: string
          enhancements?: Json | null
          error_message?: string | null
          job_id?: string
          marketplaces?: Json | null
          output_image_url?: string | null
          output_image_urls?: Json | null
          preset_id?: string | null
          preset_name?: string | null
          processing_time_seconds?: number | null
          product_image_url?: string
          product_name?: string
          product_type?: string
          reference_image_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workflow_id?: string | null
        }
        Relationships: []
      }
      lifeguard_incidents: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          category: string
          cpu_usage_percent: number | null
          created_at: string | null
          environment: string | null
          error_code: string | null
          error_message: string
          error_stack: string | null
          id: string
          ip_address: unknown
          job_id: string | null
          memory_usage_mb: number | null
          prevention_steps: string[] | null
          related_incidents: string[] | null
          request_body: Json | null
          request_headers: Json | null
          request_method: string | null
          request_path: string | null
          resolution_notes: string | null
          resolved: boolean | null
          resolved_at: string | null
          response_time_ms: number | null
          root_cause_analysis: string | null
          server_region: string | null
          severity: string
          slack_notification_sent_at: string | null
          slack_notified: boolean | null
          slack_thread_ts: string | null
          suggested_fix: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category: string
          cpu_usage_percent?: number | null
          created_at?: string | null
          environment?: string | null
          error_code?: string | null
          error_message: string
          error_stack?: string | null
          id?: string
          ip_address?: unknown
          job_id?: string | null
          memory_usage_mb?: number | null
          prevention_steps?: string[] | null
          related_incidents?: string[] | null
          request_body?: Json | null
          request_headers?: Json | null
          request_method?: string | null
          request_path?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          response_time_ms?: number | null
          root_cause_analysis?: string | null
          server_region?: string | null
          severity: string
          slack_notification_sent_at?: string | null
          slack_notified?: boolean | null
          slack_thread_ts?: string | null
          suggested_fix?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          category?: string
          cpu_usage_percent?: number | null
          created_at?: string | null
          environment?: string | null
          error_code?: string | null
          error_message?: string
          error_stack?: string | null
          id?: string
          ip_address?: unknown
          job_id?: string | null
          memory_usage_mb?: number | null
          prevention_steps?: string[] | null
          related_incidents?: string[] | null
          request_body?: Json | null
          request_headers?: Json | null
          request_method?: string | null
          request_path?: string | null
          resolution_notes?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          response_time_ms?: number | null
          root_cause_analysis?: string | null
          server_region?: string | null
          severity?: string
          slack_notification_sent_at?: string | null
          slack_notified?: boolean | null
          slack_thread_ts?: string | null
          suggested_fix?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      presets: {
        Row: {
          category: string
          created_at: string
          description: string | null
          is_public: boolean
          name: string
          preset_config: Json
          preset_id: string
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          is_public?: boolean
          name: string
          preset_config?: Json
          preset_id?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          is_public?: boolean
          name?: string
          preset_config?: Json
          preset_id?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presets_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          credits_balance: number
          display_name: string | null
          email: string
          instagram_url: string | null
          signup_ip: string | null
          signup_user_agent: string | null
          subscription_tier: string
          tiktok_url: string | null
          trust_score: number
          twitter_url: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          display_name?: string | null
          email: string
          instagram_url?: string | null
          signup_ip?: string | null
          signup_user_agent?: string | null
          subscription_tier?: string
          tiktok_url?: string | null
          trust_score?: number
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          display_name?: string | null
          email?: string
          instagram_url?: string | null
          signup_ip?: string | null
          signup_user_agent?: string | null
          subscription_tier?: string
          tiktok_url?: string | null
          trust_score?: number
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      training_data: {
        Row: {
          approved_for_training: boolean | null
          category: string
          created_at: string | null
          id: string
          input_image_url: string
          metadata: Json | null
          output_image_url: string
          prompt_used: string | null
          user_rating: number | null
          workflow_id: string
        }
        Insert: {
          approved_for_training?: boolean | null
          category: string
          created_at?: string | null
          id?: string
          input_image_url: string
          metadata?: Json | null
          output_image_url: string
          prompt_used?: string | null
          user_rating?: number | null
          workflow_id: string
        }
        Update: {
          approved_for_training?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          input_image_url?: string
          metadata?: Json | null
          output_image_url?: string
          prompt_used?: string | null
          user_rating?: number | null
          workflow_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          preset_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preset_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preset_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["preset_id"]
          },
        ]
      }
      api_call_log: {
        Row: {
          id: string
          job_id: string | null
          provider: string
          operation: string
          cost_usd: number
          duration_ms: number
          status: string
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id?: string | null
          provider: string
          operation: string
          cost_usd?: number
          duration_ms?: number
          status?: string
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string | null
          provider?: string
          operation?: string
          cost_usd?: number
          duration_ms?: number
          status?: string
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_call_log_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      user_follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "user_follows_following_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      preset_reports: {
        Row: {
          id: string
          reporter_id: string
          preset_id: string
          reason: string
          created_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          preset_id: string
          reason: string
          created_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          preset_id?: string
          reason?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_reports_reporter_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "preset_reports_preset_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["preset_id"]
          },
        ]
      }
      preset_usage: {
        Row: {
          id: string
          preset_id: string
          user_id: string
          job_id: string
          used_at: string
        }
        Insert: {
          id?: string
          preset_id: string
          user_id: string
          job_id: string
          used_at?: string
        }
        Update: {
          id?: string
          preset_id?: string
          user_id?: string
          job_id?: string
          used_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "preset_usage_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "presets"
            referencedColumns: ["preset_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      deduct_credits: {
        Args: { p_amount: number; p_job_id: string | null; p_user_id: string }
        Returns: undefined
      }
      get_lifeguard_stats: {
        Args: { time_window_hours?: number }
        Returns: {
          avg_resolution_time_hours: number
          critical_count: number
          error_count: number
          total_incidents: number
          unresolved_count: number
          warning_count: number
        }[]
      }
      grant_credits: {
        Args: { p_user_id: string; p_amount: number; p_stripe_session_id: string }
        Returns: undefined
      }
      refund_credits: {
        Args: { p_user_id: string; p_amount: number; p_job_id: string | null }
        Returns: undefined
      }
      get_creator_royalty_stats: {
        Args: { p_user_id: string }
        Returns: {
          total_earned: number
          this_month: number
          monthly_cap: number
        }[]
      }
      transfer_preset_royalty: {
        Args: { p_user_id: string; p_preset_id: string; p_job_id: string }
        Returns: undefined
      }
      increment_preset_usage: {
        Args: { p_preset_id: string }
        Returns: undefined
      }
      get_capacity_metrics: {
        Args: { p_lookback_days?: number }
        Returns: Json
      }
      calculate_trust_score: {
        Args: { p_user_id: string }
        Returns: number
      }
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

/**
 * Job Quality Metadata
 * Stored in jobs.metadata JSONB field for quality tracking
 */
export interface JobQualityMetadata {
	/** Overall quality score (0-1) from background removal pipeline */
	quality_score?: number;

	/** Detailed quality metrics */
	quality_metrics?: {
		edgeQuality?: number;
		segmentationQuality?: number;
		artifactFreeScore?: number;
	};

	/** Model used for background removal */
	model_used?: string;

	/** Number of retry attempts */
	retry_count?: number;

	/** Product type used for routing */
	product_type?: string;

	/** Processing time in milliseconds */
	processing_time?: number;
}

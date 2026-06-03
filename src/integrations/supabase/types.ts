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
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_ai_settings: {
        Row: {
          analysis_sensitivity: string
          audio_weight: number
          confidence_threshold: number
          high_risk_threshold: number
          id: string
          moderation_enabled: boolean
          text_weight: number
          updated_at: string
          updated_by: string | null
          video_weight: number
          watch_threshold: number
        }
        Insert: {
          analysis_sensitivity?: string
          audio_weight?: number
          confidence_threshold?: number
          high_risk_threshold?: number
          id?: string
          moderation_enabled?: boolean
          text_weight?: number
          updated_at?: string
          updated_by?: string | null
          video_weight?: number
          watch_threshold?: number
        }
        Update: {
          analysis_sensitivity?: string
          audio_weight?: number
          confidence_threshold?: number
          high_risk_threshold?: number
          id?: string
          moderation_enabled?: boolean
          text_weight?: number
          updated_at?: string
          updated_by?: string | null
          video_weight?: number
          watch_threshold?: number
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          summary: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          summary: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          summary?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      depression_tests: {
        Row: {
          created_at: string
          id: string
          status: string
          text_answers: Json
          user_id: string
          video_path: string | null
          voice_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          text_answers?: Json
          user_id: string
          video_path?: string | null
          voice_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          text_answers?: Json
          user_id?: string
          video_path?: string | null
          voice_path?: string | null
        }
        Relationships: []
      }
      model_predictions: {
        Row: {
          assessment_id: string
          confidence: number
          created_at: string
          explanation: string | null
          id: string
          modality_gates: Json
          modality_outputs: Json
          model_version: string
          phq_score: number
          prediction_source: string
          raw_prediction: Json
          severity: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          confidence: number
          created_at?: string
          explanation?: string | null
          id?: string
          modality_gates?: Json
          modality_outputs?: Json
          model_version: string
          phq_score: number
          prediction_source: string
          raw_prediction?: Json
          severity: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          confidence?: number
          created_at?: string
          explanation?: string | null
          id?: string
          modality_gates?: Json
          modality_outputs?: Json
          model_version?: string
          phq_score?: number
          prediction_source?: string
          raw_prediction?: Json
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_predictions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "depression_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      logs: {
        Row: {
          action: string | null
          log_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action?: string | null
          log_id?: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string | null
          log_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_user_review_statuses: {
        Row: {
          admin_note: string | null
          priority: string
          review_status: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          priority?: string
          review_status?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          priority?: string
          review_status?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_risk_alert_reviews: {
        Row: {
          admin_note: string | null
          alert_status: string
          assessment_id: string
          priority: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_note?: string | null
          alert_status?: string
          assessment_id: string
          priority?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_note?: string | null
          alert_status?: string
          assessment_id?: string
          priority?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      mood_entries: {
        Row: {
          created_at: string
          energy: number | null
          entry_date: string
          id: string
          mood: number
          note: string | null
          sleep_quality: number | null
          tags: string[] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number | null
          entry_date?: string
          id?: string
          mood: number
          note?: string | null
          sleep_quality?: number | null
          tags?: string[] | null
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number | null
          entry_date?: string
          id?: string
          mood?: number
          note?: string | null
          sleep_quality?: number | null
          tags?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      mental_health_professionals: {
        Row: {
          address: string | null
          city: string
          created_at: string
          created_by: string | null
          featured: boolean
          id: string
          is_published: boolean
          location: string
          map_url: string | null
          name: string
          phone: string | null
          role: string
          slug: string
          source_label: string | null
          source_url: string | null
          specialization: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          address?: string | null
          city: string
          created_at?: string
          created_by?: string | null
          featured?: boolean
          id?: string
          is_published?: boolean
          location: string
          map_url?: string | null
          name: string
          phone?: string | null
          role: string
          slug: string
          source_label?: string | null
          source_url?: string | null
          specialization: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          created_by?: string | null
          featured?: boolean
          id?: string
          is_published?: boolean
          location?: string
          map_url?: string | null
          name?: string
          phone?: string | null
          role?: string
          slug?: string
          source_label?: string | null
          source_url?: string | null
          specialization?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      resource_bookmarks: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookmarks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_progress: {
        Row: {
          id: string
          last_viewed: string
          progress: number
          resource_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_viewed?: string
          progress?: number
          resource_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_viewed?: string
          progress?: number
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_progress_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          category: string | null
          content_body: string | null
          content_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration: string | null
          estimated_duration: string | null
          external_url: string | null
          featured: boolean
          id: string
          is_published: boolean
          mood_category: string | null
          source_platform: string | null
          tags: string[]
          thumbnail_url: string | null
          title: string
          topic: string | null
          type: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content_body?: string | null
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          estimated_duration?: string | null
          external_url?: string | null
          featured?: boolean
          id?: string
          is_published?: boolean
          mood_category?: string | null
          source_platform?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content_body?: string | null
          content_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          estimated_duration?: string | null
          external_url?: string | null
          featured?: boolean
          id?: string
          is_published?: boolean
          mood_category?: string | null
          source_platform?: string | null
          tags?: string[]
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      meditation_streaks: {
        Row: {
          completed_sessions: number
          last_completed_at: string | null
          last_completed_date: string | null
          streak_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_sessions?: number
          last_completed_at?: string | null
          last_completed_date?: string | null
          streak_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_sessions?: number
          last_completed_at?: string | null
          last_completed_date?: string | null
          streak_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_activity_history: {
        Row: {
          activity_type: string
          completed_at: string
          created_at: string
          duration_seconds: number
          id: string
          metadata: Json
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          metadata?: Json
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          metadata?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          admin_reply: string | null
          assigned_to: string | null
          created_at: string
          id: string
          message: string
          request_type: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          updated_by: string | null
          urgency: string
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          message: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          updated_by?: string | null
          urgency?: string
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          assigned_to?: string | null
          created_at?: string
          id?: string
          message?: string
          request_type?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          updated_by?: string | null
          urgency?: string
          user_id?: string
        }
        Relationships: []
      }
      support_recommendation_events: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          recommendation_type: string
          source: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          recommendation_type: string
          source?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          recommendation_type?: string
          source?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      support_routines: {
        Row: {
          active: boolean
          activities: string[]
          created_at: string
          id: string
          preferred_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          activities?: string[]
          created_at?: string
          id?: string
          preferred_time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          activities?: string[]
          created_at?: string
          id?: string
          preferred_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      results: {
        Row: {
          analyzed_at: string
          depression_level: string | null
          face_emotion: string | null
          recommendation: string | null
          result_id: string
          text_sentiment: string | null
          user_id: string
          voice_emotion: string | null
        }
        Insert: {
          analyzed_at?: string
          depression_level?: string | null
          face_emotion?: string | null
          recommendation?: string | null
          result_id?: string
          text_sentiment?: string | null
          user_id: string
          voice_emotion?: string | null
        }
        Update: {
          analyzed_at?: string
          depression_level?: string | null
          face_emotion?: string | null
          recommendation?: string | null
          result_id?: string
          text_sentiment?: string | null
          user_id?: string
          voice_emotion?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          end_time: string | null
          session_id: string
          start_time: string | null
          user_id: string
        }
        Insert: {
          end_time?: string | null
          session_id?: string
          start_time?: string | null
          user_id: string
        }
        Update: {
          end_time?: string | null
          session_id?: string
          start_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assessment_wellness_score: {
        Args: { _answers: Json }
        Returns: number
      }
      get_admin_ai_settings: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_audit_logs: {
        Args: { _entity_type?: string; _limit?: number }
        Returns: {
          action: string
          admin_email: string | null
          admin_id: string
          admin_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          log_id: string
          metadata: Json
          summary: string
        }[]
      }
      get_admin_assessment_analytics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_overview: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_risk_alerts: {
        Args: { _limit?: number; _status?: string }
        Returns: {
          admin_note: string | null
          alert_status: string
          answer_count: number
          assessment_id: string
          created_at: string
          email: string | null
          name: string | null
          priority: string
          risk_level: string
          updated_at: string | null
          user_id: string
          video_captured: boolean
          voice_captured: boolean
          wellness_score: number
        }[]
      }
      get_admin_mood_analytics: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_support_request_stats: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      get_admin_support_requests: {
        Args: { _limit?: number; _search?: string; _status?: string }
        Returns: {
          admin_reply: string | null
          assigned_to: string | null
          completed_tests: number
          created_at: string
          email: string | null
          latest_mood: number | null
          latest_wellness_score: number | null
          message: string
          mood_entries: number
          name: string | null
          request_id: string
          request_type: string
          status: string
          subject: string
          updated_at: string
          urgency: string
          user_id: string
        }[]
      }
      get_admin_user_detail: {
        Args: { _user_id: string }
        Returns: Json
      }
      get_admin_user_summaries: {
        Args: { _limit?: number; _search?: string }
        Returns: {
          account_status: string
          completed_tests: number
          email: string | null
          joined_at: string
          latest_activity: string | null
          mood_entries: number
          name: string | null
          risk_level: string
          support_sessions: number
          user_id: string
        }[]
      }
      get_current_user_access_status: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      set_admin_user_review_status: {
        Args: {
          _admin_note?: string | null
          _priority?: string
          _review_status: string
          _user_id: string
        }
        Returns: Json
      }
      set_admin_ai_settings: {
        Args: {
          _analysis_sensitivity?: string
          _audio_weight: number
          _confidence_threshold: number
          _high_risk_threshold: number
          _moderation_enabled?: boolean
          _text_weight: number
          _video_weight: number
          _watch_threshold: number
        }
        Returns: Json
      }
      record_admin_audit_log: {
        Args: {
          _action: string
          _entity_id?: string | null
          _entity_type: string
          _metadata?: Json
          _summary: string
        }
        Returns: Json
      }
      set_admin_risk_alert_status: {
        Args: {
          _admin_note?: string | null
          _alert_status: string
          _assessment_id: string
          _priority?: string
        }
        Returns: Json
      }
      set_admin_support_request_status: {
        Args: {
          _admin_reply?: string | null
          _request_id: string
          _status: string
          _urgency?: string
        }
        Returns: Json
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
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

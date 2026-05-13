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

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
      coin_packs: {
        Row: {
          coins: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          price_cents: number
          sort_order: number
          stripe_price_id: string | null
        }
        Insert: {
          coins: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          price_cents: number
          sort_order?: number
          stripe_price_id?: string | null
        }
        Update: {
          coins?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          price_cents?: number
          sort_order?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_profiles_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_profiles_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_sends: {
        Row: {
          coin_total: number
          created_at: string
          gift_id: string
          host_id: string
          id: string
          quantity: number
          sender_id: string
          stream_id: string
        }
        Insert: {
          coin_total: number
          created_at?: string
          gift_id: string
          host_id: string
          id?: string
          quantity: number
          sender_id: string
          stream_id: string
        }
        Update: {
          coin_total?: number
          created_at?: string
          gift_id?: string
          host_id?: string
          id?: string
          quantity?: number
          sender_id?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_sends_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_sends_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts_catalog: {
        Row: {
          animation: string
          coin_cost: number
          created_at: string
          glyph: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          animation?: string
          coin_cost: number
          created_at?: string
          glyph: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          animation?: string
          coin_cost?: number
          created_at?: string
          glyph?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      live_bans: {
        Row: {
          banned_by: string
          created_at: string
          reason: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          reason?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          reason?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_bans_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_pinned: boolean
          stream_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          stream_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_comments_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_hearts: {
        Row: {
          count: number
          created_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_hearts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_moderators: {
        Row: {
          created_at: string
          granted_by: string
          stream_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by: string
          stream_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_moderators_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_notifications: {
        Row: {
          created_at: string
          follower_id: string
          host_id: string
          id: string
          read_at: string | null
          stream_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          host_id: string
          id?: string
          read_at?: string | null
          stream_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          host_id?: string
          id?: string
          read_at?: string | null
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_notifications_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reported_user_id: string
          reporter_id: string
          stream_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reported_user_id: string
          reporter_id: string
          stream_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reports_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      live_streams: {
        Row: {
          agora_channel: string
          created_at: string
          ended_at: string | null
          gifts_total_coins: number
          host_id: string
          id: string
          likes_count: number
          started_at: string
          status: Database["public"]["Enums"]["live_status"]
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          viewer_count: number
          viewer_peak: number
        }
        Insert: {
          agora_channel: string
          created_at?: string
          ended_at?: string | null
          gifts_total_coins?: number
          host_id: string
          id?: string
          likes_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          viewer_count?: number
          viewer_peak?: number
        }
        Update: {
          agora_channel?: string
          created_at?: string
          ended_at?: string | null
          gifts_total_coins?: number
          host_id?: string
          id?: string
          likes_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["live_status"]
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          viewer_count?: number
          viewer_peak?: number
        }
        Relationships: []
      }
      live_viewers: {
        Row: {
          joined_at: string
          left_at: string | null
          stream_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          left_at?: string | null
          stream_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          left_at?: string | null
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_viewers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "live_streams"
            referencedColumns: ["id"]
          },
        ]
      }
      not_interested: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "not_interested_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_messages_from: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_private: boolean
          language: string
          notify_comments: boolean
          notify_follows: boolean
          notify_likes: boolean
          push_enabled: boolean
          updated_at: string
          username: string
          verified: boolean
        }
        Insert: {
          allow_messages_from?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_private?: boolean
          language?: string
          notify_comments?: boolean
          notify_follows?: boolean
          notify_likes?: boolean
          push_enabled?: boolean
          updated_at?: string
          username: string
          verified?: boolean
        }
        Update: {
          allow_messages_from?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_private?: boolean
          language?: string
          notify_comments?: boolean
          notify_follows?: boolean
          notify_likes?: boolean
          push_enabled?: boolean
          updated_at?: string
          username?: string
          verified?: boolean
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      reposts: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reposts_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      saves: {
        Row: {
          created_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saves_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          created_at: string
          destination: string
          id: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          id?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          caption: string | null
          created_at: string
          hashtags: string[] | null
          id: string
          location: string | null
          thumbnail_url: string | null
          user_id: string
          video_url: string
          views_count: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          location?: string | null
          thumbnail_url?: string | null
          user_id: string
          video_url: string
          views_count?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          hashtags?: string[] | null
          id?: string
          location?: string | null
          thumbnail_url?: string | null
          user_id?: string
          video_url?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "videos_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          created_at: string
          delta_coins: number
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          memo: string | null
          ref_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          delta_coins: number
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          memo?: string | null
          ref_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          delta_coins?: number
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          memo?: string | null
          ref_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          coin_balance: number
          earned_coins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coin_balance?: number
          earned_coins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coin_balance?: number
          earned_coins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_cents: number
          coins: number
          created_at: string
          currency: string
          destination: string | null
          id: string
          method: string | null
          processed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          amount_cents: number
          coins: number
          created_at?: string
          currency?: string
          destination?: string | null
          id?: string
          method?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          amount_cents?: number
          coins?: number
          created_at?: string
          currency?: string
          destination?: string | null
          id?: string
          method?: string | null
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      end_live: { Args: { _stream_id: string }; Returns: undefined }
      ensure_wallet: { Args: { _user_id: string }; Returns: undefined }
      get_share_counts: {
        Args: { video_ids: string[] }
        Returns: {
          count: number
          video_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_live_staff: {
        Args: { _stream_id: string; _user_id: string }
        Returns: boolean
      }
      join_live: { Args: { _stream_id: string }; Returns: undefined }
      leave_live: { Args: { _stream_id: string }; Returns: undefined }
      record_heart_batch: {
        Args: { _count: number; _stream_id: string }
        Returns: undefined
      }
      send_gift: {
        Args: { _gift_id: string; _quantity: number; _stream_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      ledger_kind:
        | "purchase"
        | "gift_sent"
        | "gift_received"
        | "withdrawal"
        | "adjustment"
      live_status: "scheduled" | "live" | "ended"
      withdrawal_status: "pending" | "approved" | "rejected" | "paid"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      ledger_kind: [
        "purchase",
        "gift_sent",
        "gift_received",
        "withdrawal",
        "adjustment",
      ],
      live_status: ["scheduled", "live", "ended"],
      withdrawal_status: ["pending", "approved", "rejected", "paid"],
    },
  },
} as const

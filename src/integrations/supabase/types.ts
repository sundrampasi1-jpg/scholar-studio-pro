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
      announcements: {
        Row: {
          body: string
          course_id: string | null
          created_at: string
          id: string
          title: string
        }
        Insert: {
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          about: string | null
          address: string | null
          app_name: string
          contact_email: string | null
          contact_phone: string | null
          favicon_url: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: boolean
          institute_name: string
          logo_url: string | null
          primary_color: string
          secondary_color: string
          social_facebook: string | null
          social_instagram: string | null
          social_telegram: string | null
          social_twitter: string | null
          social_youtube: string | null
          support_info: string | null
          tagline: string
          updated_at: string
        }
        Insert: {
          about?: string | null
          address?: string | null
          app_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          favicon_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: boolean
          institute_name?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_telegram?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          support_info?: string | null
          tagline?: string
          updated_at?: string
        }
        Update: {
          about?: string | null
          address?: string | null
          app_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          favicon_url?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: boolean
          institute_name?: string
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_telegram?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          support_info?: string | null
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      batches: {
        Row: {
          course_id: string
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          start_date: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_date?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          id: string
          name: string
          position: number
          subject_id: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          subject_id: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_percent: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_percent?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number
          used_count?: number
        }
        Relationships: []
      }
      courses: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_free: boolean
          is_published: boolean
          price: number
          thumbnail_url: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean
          is_published?: boolean
          price?: number
          thumbnail_url?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_free?: boolean
          is_published?: boolean
          price?: number
          thumbnail_url?: string | null
          title?: string
        }
        Relationships: []
      }
      doubt_replies: {
        Row: {
          body: string
          created_at: string
          doubt_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          doubt_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          doubt_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubt_replies_doubt_id_fkey"
            columns: ["doubt_id"]
            isOneToOne: false
            referencedRelation: "doubts"
            referencedColumns: ["id"]
          },
        ]
      }
      doubts: {
        Row: {
          body: string
          course_id: string | null
          created_at: string
          id: string
          image_url: string | null
          status: string
          subject: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          status?: string
          subject?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          course_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          status?: string
          subject?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "doubts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          batch_id: string | null
          course_id: string
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          batch_id?: string | null
          course_id: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          batch_id?: string | null
          course_id?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean
          course_id: string
          id: string
          last_viewed_at: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          course_id: string
          id?: string
          last_viewed_at?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed?: boolean
          course_id?: string
          id?: string
          last_viewed_at?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          chapter_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          is_published: boolean
          pdf_url: string | null
          position: number
          title: string
          video_url: string | null
        }
        Insert: {
          chapter_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          pdf_url?: string | null
          position?: number
          title: string
          video_url?: string | null
        }
        Update: {
          chapter_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_published?: boolean
          pdf_url?: string | null
          position?: number
          title?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      live_classes: {
        Row: {
          batch_id: string | null
          course_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          join_url: string | null
          recording_url: string | null
          scheduled_at: string
          teacher_id: string | null
          teacher_name: string | null
          title: string
        }
        Insert: {
          batch_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          join_url?: string | null
          recording_url?: string | null
          scheduled_at: string
          teacher_id?: string | null
          teacher_name?: string | null
          title: string
        }
        Update: {
          batch_id?: string | null
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          join_url?: string | null
          recording_url?: string | null
          scheduled_at?: string
          teacher_id?: string | null
          teacher_name?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_classes_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_classes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          allow_download: boolean
          chapter_id: string | null
          course_id: string | null
          created_at: string
          file_url: string
          id: string
          lesson_id: string | null
          subject_id: string | null
          title: string
        }
        Insert: {
          allow_download?: boolean
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          file_url: string
          id?: string
          lesson_id?: string | null
          subject_id?: string | null
          title: string
        }
        Update: {
          allow_download?: boolean
          chapter_id?: string | null
          course_id?: string | null
          created_at?: string
          file_url?: string
          id?: string
          lesson_id?: string | null
          subject_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          coupon_code: string | null
          course_id: string | null
          created_at: string
          discount: number
          id: string
          provider: string
          provider_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          coupon_code?: string | null
          course_id?: string | null
          created_at?: string
          discount?: number
          id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          coupon_code?: string | null
          course_id?: string | null
          created_at?: string
          discount?: number
          id?: string
          provider?: string
          provider_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          correct_option: string
          id: string
          marks: number
          option_a: string
          option_b: string
          option_c: string | null
          option_d: string | null
          position: number
          question_text: string
          solution: string | null
          test_id: string
        }
        Insert: {
          correct_option?: string
          id?: string
          marks?: number
          option_a: string
          option_b: string
          option_c?: string | null
          option_d?: string | null
          position?: number
          question_text: string
          solution?: string | null
          test_id: string
        }
        Update: {
          correct_option?: string
          id?: string
          marks?: number
          option_a?: string
          option_b?: string
          option_c?: string | null
          option_d?: string | null
          position?: number
          question_text?: string
          solution?: string | null
          test_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          reel_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          body: string
          created_at?: string
          id?: string
          reel_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_comments_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reel_likes: {
        Row: {
          created_at: string
          reel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reel_likes_reel_id_fkey"
            columns: ["reel_id"]
            isOneToOne: false
            referencedRelation: "reels"
            referencedColumns: ["id"]
          },
        ]
      }
      reels: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          title: string
          video_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
          video_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          title?: string
          video_url?: string
        }
        Relationships: []
      }
      subjects: {
        Row: {
          course_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          course_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          course_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          from_staff: boolean
          id: string
          sender_id: string
          student_id: string
        }
        Insert: {
          body: string
          created_at?: string
          from_staff?: boolean
          id?: string
          sender_id: string
          student_id: string
        }
        Update: {
          body?: string
          created_at?: string
          from_staff?: boolean
          id?: string
          sender_id?: string
          student_id?: string
        }
        Relationships: []
      }
      test_attempts: {
        Row: {
          answers: Json
          correct_count: number
          id: string
          score: number
          submitted_at: string
          test_id: string
          total: number
          user_id: string
          wrong_count: number
        }
        Insert: {
          answers?: Json
          correct_count?: number
          id?: string
          score?: number
          submitted_at?: string
          test_id: string
          total?: number
          user_id: string
          wrong_count?: number
        }
        Update: {
          answers?: Json
          correct_count?: number
          id?: string
          score?: number
          submitted_at?: string
          test_id?: string
          total?: number
          user_id?: string
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "test_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          course_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_published: boolean
          title: string
          total_marks: number
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          title: string
          total_marks?: number
        }
        Update: {
          course_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_published?: boolean
          title?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "tests_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "teacher", "student"],
    },
  },
} as const

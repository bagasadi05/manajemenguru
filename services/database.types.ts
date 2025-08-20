// This file is now populated with a schema based on the application's needs.
// You can generate this file using the Supabase CLI:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID > services/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      academic_records: {
        Row: {
          id: string;
          student_id: string;
          subject: string;
          score: number;
          notes: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          subject: string;
          score: number;
          notes: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          subject?: string;
          score?: number;
          notes?: string;
          user_id?: string;
          created_at?: string;
        };
      };
      communications: {
        Row: {
          id: string
          created_at: string
          student_id: string
          user_id: string
          message: string
          sender: "teacher" | "parent"
          is_read: boolean
        }
        Insert: {
          id?: string
          created_at?: string
          student_id: string
          user_id: string
          message: string
          sender: "teacher" | "parent"
          is_read?: boolean
        }
        Update: {
          is_read?: boolean
        }
      }
      quiz_points: {
        Row: {
          id: number;
          created_at: string;
          quiz_name: string;
          subject: string;
          points: number;
          max_points: number;
          quiz_date: string;
          student_id: string;
          user_id: string;
        };
        Insert: {
          id?: number;
          created_at?: string;
          quiz_name: string;
          subject: string;
          points: number;
          max_points: number;
          quiz_date: string;
          student_id: string;
          user_id: string;
        };
        Update: {
          id?: number;
          created_at?: string;
          quiz_name?: string;
          subject?: string;
          points?: number;
          max_points?: number;
          quiz_date?: string;
          student_id?: string;
          user_id?: string;
        };
      };
      attendance: {
        Row: {
          id: string
          student_id: string
          date: string
          status: "Hadir" | "Izin" | "Sakit" | "Alpha"
          notes: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          date: string
          status: "Hadir" | "Izin" | "Sakit" | "Alpha"
          notes?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          status?: "Hadir" | "Izin" | "Sakit" | "Alpha"
          notes?: string | null
          user_id?: string
          created_at?: string
        }
      }
      classes: {
        Row: { id: string; name: string; user_id: string; created_at: string; }
        Insert: { id?: string; name: string; user_id: string; created_at?: string; }
        Update: { id?: string; name?: string; user_id?: string; created_at?: string; }
      }
      students: {
        Row: { id: string; name: string; class_id: string; avatar_url: string; user_id: string; created_at: string; gender: "Laki-laki" | "Perempuan"; access_code: string | null }
        Insert: { id?: string; name: string; class_id: string; avatar_url: string; user_id: string; created_at?: string; gender: "Laki-laki" | "Perempuan"; access_code?: string | null }
        Update: { id?: string; name?: string; class_id?: string; avatar_url?: string; user_id?: string; created_at?: string; gender?: "Laki-laki" | "Perempuan"; access_code?: string | null }
      }
      reports: {
        Row: {
          id: string
          student_id: string
          date: string
          title: string
          notes: string
          attachment_url: string | null
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          date: string
          title: string
          notes: string
          attachment_url?: string | null
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          title?: string
          notes?: string
          attachment_url?: string | null
          user_id?: string
          created_at?: string
        }
      }
      schedules: {
        Row: {
          id: string
          day: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat"
          start_time: string
          end_time: string
          subject: string
          class_id: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          day: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat"
          start_time: string
          end_time: string
          subject: string
          class_id: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          day?: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat"
          start_time?: string
          end_time?: string
          subject?: string
          class_id?: string
          user_id?: string
          created_at?: string
        }
      }
      violations: {
        Row: {
          id: string
          student_id: string
          date: string
          description: string
          points: number
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          date: string
          description: string
          points: number
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          student_id?: string
          date?: string
          description?: string
          points?: number
          user_id?: string
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          due_date: string | null;
          status: "todo" | "in_progress" | "done";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          due_date?: string | null;
          status?: "todo" | "in_progress" | "done";
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          due_date?: string | null;
          status?: "todo" | "in_progress" | "done";
          created_at?: string;
        };
      };
    }
    Views: { [_ in never]: never }
    Functions: {
      delete_user_account: {
        Args: Record<string, unknown>
        Returns: undefined
      }
      get_daily_attendance_summary: {
        Args: {
          for_date: string
        }
        Returns: {
          present_percentage: number
          permission_percentage: number
          sick_percentage: number
          absent_percentage: number
        }[]
      }
      get_student_portal_data: {
        Args: {
          student_id_param: string;
          access_code_param: string;
        };
        Returns: {
          student: {
            id: string;
            name: string;
            avatar_url: string;
            classes: { name: string };
          };
          reports: { id: string; date: string; title: string; notes: string }[];
          attendanceRecords: { id: string; date: string; status: string, notes: string | null }[];
          academicRecords: { id: string; subject: string; score: number; notes: string; created_at: string }[];
          violations: { id: string; date: string; description: string; points: number }[];
          quizPoints: { id: number; quiz_date: string; subject: string; quiz_name: string }[];
        };
      };
      get_weekly_attendance_summary: {
        Args: Record<string, unknown>
        Returns: {
          day: string
          present_percentage: number
        }[]
      }
      verify_access_code: {
        Args: {
          access_code_param: string
        }
        Returns: {
          id: string
          access_code: string
        }[]
      }
    }
    Enums: {
        "attendance_status": "Hadir" | "Izin" | "Sakit" | "Alpha"
        "day_of_week": "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat"
    }
    CompositeTypes: { [_ in never]: never }
  }
}
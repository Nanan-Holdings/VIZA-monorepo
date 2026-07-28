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
      action_plans: {
        Row: {
          created_at: string | null
          description: string | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string
          user_id: string
          storage_path: string
          title: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename: string
          user_id: string
          storage_path: string
          title: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string
          user_id?: string
          storage_path?: string
          title?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_log: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          has_error_details: boolean | null
          id: string
          metadata: Json | null
          provider: string
          records_affected: number | null
          resource_id: string | null
          resource_type: string | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          has_error_details?: boolean | null
          id?: string
          metadata?: Json | null
          provider: string
          records_affected?: number | null
          resource_id?: string | null
          resource_type?: string | null
          source: string
          status: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          has_error_details?: boolean | null
          id?: string
          metadata?: Json | null
          provider?: string
          records_affected?: number | null
          resource_id?: string | null
          resource_type?: string | null
          source?: string
          status?: string
        }
        Relationships: []
      }
      appointment_addresses: {
        Row: {
          city: string
          country: string
          created_at: string | null
          id: string
          lab_order_id: string
          name: string
          region: string
          street: string
          updated_at: string | null
        }
        Insert: {
          city: string
          country?: string
          created_at?: string | null
          id?: string
          lab_order_id: string
          name: string
          region: string
          street: string
          updated_at?: string | null
        }
        Update: {
          city?: string
          country?: string
          created_at?: string | null
          id?: string
          lab_order_id?: string
          name?: string
          region?: string
          street?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_addresses_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: true
            referencedRelation: "incomplete_lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_addresses_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: true
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slots: {
        Row: {
          booked_count: number
          capacity: number
          created_at: string | null
          date: string
          end_time: string
          id: string
          is_active: boolean
          nurse_id: string
          region: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          booked_count?: number
          capacity?: number
          created_at?: string | null
          date: string
          end_time: string
          id?: string
          is_active?: boolean
          nurse_id: string
          region?: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          booked_count?: number
          capacity?: number
          created_at?: string | null
          date?: string
          end_time?: string
          id?: string
          is_active?: boolean
          nurse_id?: string
          region?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cal_sync_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          users_created: number | null
          records_created: number | null
          records_synced: number | null
          records_updated: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          users_created?: number | null
          records_created?: number | null
          records_synced?: number | null
          records_updated?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          users_created?: number | null
          records_created?: number | null
          records_synced?: number | null
          records_updated?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          adherence_score: number | null
          channel: string
          completed_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          user_id: string
          prompt: string | null
          reminder_type: string | null
          response_json: Json | null
          scheduled_for: string
          session_id: string | null
          service_id: string | null
        }
        Insert: {
          adherence_score?: number | null
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          user_id: string
          prompt?: string | null
          reminder_type?: string | null
          response_json?: Json | null
          scheduled_for: string
          session_id?: string | null
          service_id?: string | null
        }
        Update: {
          adherence_score?: number | null
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          user_id?: string
          prompt?: string | null
          reminder_type?: string | null
          response_json?: Json | null
          scheduled_for?: string
          session_id?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      client_temp_access: {
        Row: {
          created_at: string | null
          created_by: string
          email: string
          expires_at: string
          id: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          email: string
          expires_at: string
          id?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          email?: string
          expires_at?: string
          id?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_temp_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_temp_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          cal_booking_uid: string | null
          cal_event_id: number | null
          cal_meeting_url: string | null
          cal_metadata: Json | null
          cancellation_reason: string | null
          cancellation_source: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          consultation_type: string | null
          created_at: string | null
          admin_id: string
          admin_notes: Json | null
          end_time: string
          id: string
          notes: string | null
          user_id: string

          reference_order_id: string | null
          reference_order_snapshot: Json | null
          start_time: string
          status: string
          transcript: Json | null
        }
        Insert: {
          cal_booking_uid?: string | null
          cal_event_id?: number | null
          cal_meeting_url?: string | null
          cal_metadata?: Json | null
          cancellation_reason?: string | null
          cancellation_source?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          consultation_type?: string | null
          created_at?: string | null
          admin_id: string
          admin_notes?: Json | null
          end_time: string
          id?: string
          notes?: string | null
          user_id: string

          reference_order_id?: string | null
          reference_order_snapshot?: Json | null
          start_time: string
          status?: string
          transcript?: Json | null
        }
        Update: {
          cal_booking_uid?: string | null
          cal_event_id?: number | null
          cal_meeting_url?: string | null
          cal_metadata?: Json | null
          cancellation_reason?: string | null
          cancellation_source?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          consultation_type?: string | null
          created_at?: string | null
          admin_id?: string
          admin_notes?: Json | null
          end_time?: string
          id?: string
          notes?: string | null
          user_id?: string

          reference_order_id?: string | null
          reference_order_snapshot?: Json | null
          start_time?: string
          status?: string
          transcript?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_reference_order_id_fkey"
            columns: ["reference_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_execution_log: {
        Row: {
          checkin_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          id: string
          job_name: string
          metadata: Json | null
          user_id: string | null
          session_id: string | null
          status: string
        }
        Insert: {
          checkin_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name: string
          metadata?: Json | null
          user_id?: string | null
          session_id?: string | null
          status: string
        }
        Update: {
          checkin_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          job_name?: string
          metadata?: Json | null
          user_id?: string | null
          session_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cron_execution_log_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cron_execution_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_items: {
        Row: {
          episode_id: string
          message_id: string
        }
        Insert: {
          episode_id: string
          message_id: string
        }
        Update: {
          episode_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episode_items_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          created_at: string | null
          id: string
          session_id: string
          summary: string
          summary_json: Json | null
          time_range: unknown
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          session_id: string
          summary: string
          summary_json?: Json | null
          time_range: unknown
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          session_id?: string
          summary?: string
          summary_json?: Json | null
          time_range?: unknown
          updated_at?: string | null
        }
        Relationships: []
      }
      escalations: {
        Row: {
          assigned_to: string | null
          context: Json | null
          created_at: string | null
          description: string
          escalation_type: string
          id: string
          message_id: string | null
          user_id: string
          resolution_notes: string | null
          resolved_at: string | null
          session_id: string | null
          severity: string
          status: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          context?: Json | null
          created_at?: string | null
          description: string
          escalation_type: string
          id?: string
          message_id?: string | null
          user_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          session_id?: string | null
          severity: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          context?: Json | null
          created_at?: string | null
          description?: string
          escalation_type?: string
          id?: string
          message_id?: string | null
          user_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          session_id?: string | null
          severity?: string
          status?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          goal_type: string
          id: string
          user_id: string
          reason: string | null
          start_date: string | null
          status: string
          target_date: string | null
          target_json: Json
          service_id: string | null
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          goal_type: string
          id?: string
          user_id: string
          reason?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          target_json: Json
          service_id?: string | null
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          goal_type?: string
          id?: string
          user_id?: string
          reason?: string | null
          start_date?: string | null
          status?: string
          target_date?: string | null
          target_json?: Json
          service_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_allowed_users: {
        Row: {
          added_at: string | null
          added_by: string | null
          email: string
          id: string
          is_active: boolean | null
          name: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          email: string
          id?: string
          is_active?: boolean | null
          name?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          email?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_allowed_users_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_audit_log: {
        Row: {
          id: string
          impersonator_email: string
          impersonator_user_id: string
          ip_address: string | null
          user_email: string
          user_id: string
          reason: string | null
          token_generated_at: string | null
          token_used_at: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          impersonator_email: string
          impersonator_user_id: string
          ip_address?: string | null
          user_email: string
          user_id: string
          reason?: string | null
          token_generated_at?: string | null
          token_used_at?: string | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          impersonator_email?: string
          impersonator_user_id?: string
          ip_address?: string | null
          user_email?: string
          user_id?: string
          reason?: string | null
          token_generated_at?: string | null
          token_used_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_audit_log_impersonator_fkey"
            columns: ["impersonator_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_audit_log_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      impersonation_tokens: {
        Row: {
          audit_log_id: string
          expires_at: string
          id: string
          user_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          audit_log_id: string
          expires_at: string
          id?: string
          user_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          audit_log_id?: string
          expires_at?: string
          id?: string
          user_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_tokens_audit_log_fkey"
            columns: ["audit_log_id"]
            isOneToOne: false
            referencedRelation: "impersonation_audit_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_tokens_user_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_aging_scores: {
        Row: {
          component_metrics: Json | null
          created_at: string | null
          id: string
          interpretation: string | null
          lab_order_id: string | null
          lab_report_id: string | null
          recommendations: Json | null
          score_category: string | null
          score_type: string
          score_value: number
        }
        Insert: {
          component_metrics?: Json | null
          created_at?: string | null
          id?: string
          interpretation?: string | null
          lab_order_id?: string | null
          lab_report_id?: string | null
          recommendations?: Json | null
          score_category?: string | null
          score_type: string
          score_value: number
        }
        Update: {
          component_metrics?: Json | null
          created_at?: string | null
          id?: string
          interpretation?: string | null
          lab_order_id?: string | null
          lab_report_id?: string | null
          recommendations?: Json | null
          score_category?: string | null
          score_type?: string
          score_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "lab_aging_scores_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "incomplete_lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_aging_scores_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_aging_scores_lab_report_id_fkey"
            columns: ["lab_report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_metric_definitions: {
        Row: {
          accepted_units: string[] | null
          category: string | null
          internal_significance: string | null
          code: string
          created_at: string | null
          display_order: number
          formula: string | null
          id: string
          interpretation: string | null
          is_active: boolean
          is_derived: boolean
          name: string
          role: string | null
          section_id: string | null
          short_name: string | null
          unit: string | null
          updated_at: string | null
          what_this_means_default: string | null
          what_you_can_do_default: string | null
        }
        Insert: {
          accepted_units?: string[] | null
          category?: string | null
          internal_significance?: string | null
          code: string
          created_at?: string | null
          display_order?: number
          formula?: string | null
          id?: string
          interpretation?: string | null
          is_active?: boolean
          is_derived?: boolean
          name: string
          role?: string | null
          section_id?: string | null
          short_name?: string | null
          unit?: string | null
          updated_at?: string | null
          what_this_means_default?: string | null
          what_you_can_do_default?: string | null
        }
        Update: {
          accepted_units?: string[] | null
          category?: string | null
          internal_significance?: string | null
          code?: string
          created_at?: string | null
          display_order?: number
          formula?: string | null
          id?: string
          interpretation?: string | null
          is_active?: boolean
          is_derived?: boolean
          name?: string
          role?: string | null
          section_id?: string | null
          short_name?: string | null
          unit?: string | null
          updated_at?: string | null
          what_this_means_default?: string | null
          what_you_can_do_default?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_metric_definitions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "lab_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_metric_definitions_backup_20260205: {
        Row: {
          accepted_units: string[] | null
          category: string | null
          internal_significance: string | null
          code: string | null
          created_at: string | null
          display_order: number | null
          formula: string | null
          id: string | null
          interpretation: string | null
          is_active: boolean | null
          is_derived: boolean | null
          name: string | null
          role: string | null
          section_id: string | null
          short_name: string | null
          unit: string | null
          updated_at: string | null
          what_this_means_default: string | null
          what_you_can_do_default: string | null
        }
        Insert: {
          accepted_units?: string[] | null
          category?: string | null
          internal_significance?: string | null
          code?: string | null
          created_at?: string | null
          display_order?: number | null
          formula?: string | null
          id?: string | null
          interpretation?: string | null
          is_active?: boolean | null
          is_derived?: boolean | null
          name?: string | null
          role?: string | null
          section_id?: string | null
          short_name?: string | null
          unit?: string | null
          updated_at?: string | null
          what_this_means_default?: string | null
          what_you_can_do_default?: string | null
        }
        Update: {
          accepted_units?: string[] | null
          category?: string | null
          internal_significance?: string | null
          code?: string | null
          created_at?: string | null
          display_order?: number | null
          formula?: string | null
          id?: string | null
          interpretation?: string | null
          is_active?: boolean | null
          is_derived?: boolean | null
          name?: string | null
          role?: string | null
          section_id?: string | null
          short_name?: string | null
          unit?: string | null
          updated_at?: string | null
          what_this_means_default?: string | null
          what_you_can_do_default?: string | null
        }
        Relationships: []
      }
      lab_orders: {
        Row: {
          appointment_date: string | null
          appointment_slot_id: string | null
          booking_status: string | null
          collected_at: string | null
          completed_at: string | null
          consultation_id: string | null
          created_at: string | null
          extraction_confidence: string | null
          extraction_method: string | null
          extraction_operation_id: string | null
          extraction_uploaded_at: string | null
          extraction_uploaded_by: string | null
          fasting_required: boolean | null
          id: string
          input_hash: string | null
          nurse_id: string | null
          panel_id: string
          user_id: string
          phenoage_completeness: number | null
          sample_type: string | null
          service_type: string | null
          source_pdf_gcs_path: string | null
          source_pdf_original_filename: string | null
          source_pdf_url: string | null
          status: string
          updated_at: string | null
          validation_status: string | null
          validation_warnings: Json | null
        }
        Insert: {
          appointment_date?: string | null
          appointment_slot_id?: string | null
          booking_status?: string | null
          collected_at?: string | null
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string | null
          extraction_confidence?: string | null
          extraction_method?: string | null
          extraction_operation_id?: string | null
          extraction_uploaded_at?: string | null
          extraction_uploaded_by?: string | null
          fasting_required?: boolean | null
          id?: string
          input_hash?: string | null
          nurse_id?: string | null
          panel_id: string
          user_id: string
          phenoage_completeness?: number | null
          sample_type?: string | null
          service_type?: string | null
          source_pdf_gcs_path?: string | null
          source_pdf_original_filename?: string | null
          source_pdf_url?: string | null
          status?: string
          updated_at?: string | null
          validation_status?: string | null
          validation_warnings?: Json | null
        }
        Update: {
          appointment_date?: string | null
          appointment_slot_id?: string | null
          booking_status?: string | null
          collected_at?: string | null
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string | null
          extraction_confidence?: string | null
          extraction_method?: string | null
          extraction_operation_id?: string | null
          extraction_uploaded_at?: string | null
          extraction_uploaded_by?: string | null
          fasting_required?: boolean | null
          id?: string
          input_hash?: string | null
          nurse_id?: string | null
          panel_id?: string
          user_id?: string
          phenoage_completeness?: number | null
          sample_type?: string | null
          service_type?: string | null
          source_pdf_gcs_path?: string | null
          source_pdf_original_filename?: string | null
          source_pdf_url?: string | null
          status?: string
          updated_at?: string | null
          validation_status?: string | null
          validation_warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_orders_appointment_slot_id_fkey"
            columns: ["appointment_slot_id"]
            isOneToOne: false
            referencedRelation: "appointment_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_nurse_id_fkey"
            columns: ["nurse_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "lab_test_panels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_panel_metrics: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_required: boolean
          metric_id: string
          panel_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_required?: boolean
          metric_id: string
          panel_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_required?: boolean
          metric_id?: string
          panel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_panel_metrics_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "lab_metric_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_panel_metrics_panel_id_fkey"
            columns: ["panel_id"]
            isOneToOne: false
            referencedRelation: "lab_test_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_pdf_extraction_context_blocks: {
        Row: {
          block_order: number
          criteria_rows: Json | null
          extraction_id: string
          id: string
          kind: string
          page_number: number
          scope: string
          scope_key: string | null
          text: string | null
        }
        Insert: {
          block_order: number
          criteria_rows?: Json | null
          extraction_id: string
          id?: string
          kind: string
          page_number?: number
          scope: string
          scope_key?: string | null
          text?: string | null
        }
        Update: {
          block_order?: number
          criteria_rows?: Json | null
          extraction_id?: string
          id?: string
          kind?: string
          page_number?: number
          scope?: string
          scope_key?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_pdf_extraction_context_blocks_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "lab_pdf_extractions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_pdf_extraction_rows: {
        Row: {
          analyte_label: string
          conv_ref_range_raw: string | null
          conv_result_raw: string | null
          conv_unit_raw: string | null
          extraction_id: string
          flag_raw: string | null
          id: string
          interpretation_label: string | null
          metric_code: string | null
          page_number: number
          result_type: string
          row_order: number
          si_ref_range_raw: string | null
          si_result_raw: string | null
          si_unit_raw: string | null
          value_numeric: number | null
          value_text: string | null
        }
        Insert: {
          analyte_label: string
          conv_ref_range_raw?: string | null
          conv_result_raw?: string | null
          conv_unit_raw?: string | null
          extraction_id: string
          flag_raw?: string | null
          id?: string
          interpretation_label?: string | null
          metric_code?: string | null
          page_number?: number
          result_type?: string
          row_order: number
          si_ref_range_raw?: string | null
          si_result_raw?: string | null
          si_unit_raw?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Update: {
          analyte_label?: string
          conv_ref_range_raw?: string | null
          conv_result_raw?: string | null
          conv_unit_raw?: string | null
          extraction_id?: string
          flag_raw?: string | null
          id?: string
          interpretation_label?: string | null
          metric_code?: string | null
          page_number?: number
          result_type?: string
          row_order?: number
          si_ref_range_raw?: string | null
          si_result_raw?: string | null
          si_unit_raw?: string | null
          value_numeric?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_pdf_extraction_rows_extraction_id_fkey"
            columns: ["extraction_id"]
            isOneToOne: false
            referencedRelation: "lab_pdf_extractions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_pdf_extractions: {
        Row: {
          created_at: string
          encounter_id: string | null
          extraction_confidence: string | null
          extraction_method: string
          id: string
          lab_order_id: string
          operation_id: string
          user_id: string
          source_pdf_gcs_path: string | null
          source_pdf_url: string | null
        }
        Insert: {
          created_at?: string
          encounter_id?: string | null
          extraction_confidence?: string | null
          extraction_method: string
          id?: string
          lab_order_id: string
          operation_id: string
          user_id: string
          source_pdf_gcs_path?: string | null
          source_pdf_url?: string | null
        }
        Update: {
          created_at?: string
          encounter_id?: string | null
          extraction_confidence?: string | null
          extraction_method?: string
          id?: string
          lab_order_id?: string
          operation_id?: string
          user_id?: string
          source_pdf_gcs_path?: string | null
          source_pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_pdf_extractions_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "incomplete_lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_pdf_extractions_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reference_ranges: {
        Row: {
          created_at: string | null
          id: string
          max_age_years: number
          metric_id: string
          min_age_years: number
          notes: string | null
          optimal_high: number | null
          optimal_low: number | null
          ref_high: number | null
          ref_low: number | null
          sex: string
          source: string | null
          status_borderline_label: string | null
          status_high_label: string | null
          status_optimal_label: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_age_years?: number
          metric_id: string
          min_age_years?: number
          notes?: string | null
          optimal_high?: number | null
          optimal_low?: number | null
          ref_high?: number | null
          ref_low?: number | null
          sex?: string
          source?: string | null
          status_borderline_label?: string | null
          status_high_label?: string | null
          status_optimal_label?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_age_years?: number
          metric_id?: string
          min_age_years?: number
          notes?: string | null
          optimal_high?: number | null
          optimal_low?: number | null
          ref_high?: number | null
          ref_low?: number | null
          sex?: string
          source?: string | null
          status_borderline_label?: string | null
          status_high_label?: string | null
          status_optimal_label?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_reference_ranges_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "lab_metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reference_ranges_backup_20260205: {
        Row: {
          created_at: string | null
          id: string | null
          max_age_years: number | null
          metric_id: string | null
          min_age_years: number | null
          notes: string | null
          optimal_high: number | null
          optimal_low: number | null
          ref_high: number | null
          ref_low: number | null
          sex: string | null
          source: string | null
          status_borderline_label: string | null
          status_high_label: string | null
          status_optimal_label: string | null
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          max_age_years?: number | null
          metric_id?: string | null
          min_age_years?: number | null
          notes?: string | null
          optimal_high?: number | null
          optimal_low?: number | null
          ref_high?: number | null
          ref_low?: number | null
          sex?: string | null
          source?: string | null
          status_borderline_label?: string | null
          status_high_label?: string | null
          status_optimal_label?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          max_age_years?: number | null
          metric_id?: string | null
          min_age_years?: number | null
          notes?: string | null
          optimal_high?: number | null
          optimal_low?: number | null
          ref_high?: number | null
          ref_low?: number | null
          sex?: string | null
          source?: string | null
          status_borderline_label?: string | null
          status_high_label?: string | null
          status_optimal_label?: string | null
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      lab_report_metrics: {
        Row: {
          calculation_details: Json | null
          created_at: string | null
          id: string
          lab_report_id: string
          metric_id: string
          optimal_high: number | null
          optimal_low: number | null
          prev_date: string | null
          prev_value: number | null
          ref_high: number | null
          ref_low: number | null
          section_code: string
          status_label: string
          status_severity: string
          trend_direction: string | null
          trend_magnitude: number | null
          unit: string | null
          value: number | null
          value_display: string
          what_this_means: string | null
          what_you_can_do: Json | null
        }
        Insert: {
          calculation_details?: Json | null
          created_at?: string | null
          id?: string
          lab_report_id: string
          metric_id: string
          optimal_high?: number | null
          optimal_low?: number | null
          prev_date?: string | null
          prev_value?: number | null
          ref_high?: number | null
          ref_low?: number | null
          section_code: string
          status_label: string
          status_severity: string
          trend_direction?: string | null
          trend_magnitude?: number | null
          unit?: string | null
          value?: number | null
          value_display: string
          what_this_means?: string | null
          what_you_can_do?: Json | null
        }
        Update: {
          calculation_details?: Json | null
          created_at?: string | null
          id?: string
          lab_report_id?: string
          metric_id?: string
          optimal_high?: number | null
          optimal_low?: number | null
          prev_date?: string | null
          prev_value?: number | null
          ref_high?: number | null
          ref_low?: number | null
          section_code?: string
          status_label?: string
          status_severity?: string
          trend_direction?: string | null
          trend_magnitude?: number | null
          unit?: string | null
          value?: number | null
          value_display?: string
          what_this_means?: string | null
          what_you_can_do?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_report_metrics_lab_report_id_fkey"
            columns: ["lab_report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_report_metrics_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "lab_metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reports: {
        Row: {
          clinician_message: string | null
          clinician_pdf_url: string | null
          consultation_id: string | null
          created_at: string | null
          generation_duration_ms: number | null
          grade: string | null
          id: string
          input_hash: string | null
          lab_order_id: string
          user_id: string
          user_notified_at: string | null
          user_pdf_url: string | null
          signed_at: string | null
          signed_by: string | null
          status: string
          structured_data: Json | null
          summary_counts: Json | null
          updated_at: string | null
        }
        Insert: {
          clinician_message?: string | null
          clinician_pdf_url?: string | null
          consultation_id?: string | null
          created_at?: string | null
          generation_duration_ms?: number | null
          grade?: string | null
          id?: string
          input_hash?: string | null
          lab_order_id: string
          user_id: string
          user_notified_at?: string | null
          user_pdf_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          structured_data?: Json | null
          summary_counts?: Json | null
          updated_at?: string | null
        }
        Update: {
          clinician_message?: string | null
          clinician_pdf_url?: string | null
          consultation_id?: string | null
          created_at?: string | null
          generation_duration_ms?: number | null
          grade?: string | null
          id?: string
          input_hash?: string | null
          lab_order_id?: string
          user_id?: string
          user_notified_at?: string | null
          user_pdf_url?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: string
          structured_data?: Json | null
          summary_counts?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "incomplete_lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string | null
          flags: string | null
          id: string
          is_abnormal: boolean | null
          lab_order_id: string
          metric_id: string
          notes: string | null
          result_type: string
          unit: string | null
          updated_at: string | null
          value: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string | null
          flags?: string | null
          id?: string
          is_abnormal?: boolean | null
          lab_order_id: string
          metric_id: string
          notes?: string | null
          result_type?: string
          unit?: string | null
          updated_at?: string | null
          value?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string | null
          flags?: string | null
          id?: string
          is_abnormal?: boolean | null
          lab_order_id?: string
          metric_id?: string
          notes?: string | null
          result_type?: string
          unit?: string | null
          updated_at?: string | null
          value?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "incomplete_lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "lab_metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_sections: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lab_test_panels: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sex: string
          tier: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sex: string
          tier: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sex?: string
          tier?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      manual_recommendations: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_custom_reason: boolean | null
          lab_order_id: string
          priority: string
          reason: string
          shopify_product_id: number
          shopify_variant_id: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_custom_reason?: boolean | null
          lab_order_id: string
          priority?: string
          reason: string
          shopify_product_id: number
          shopify_variant_id?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_custom_reason?: boolean | null
          lab_order_id?: string
          priority?: string
          reason?: string
          shopify_product_id?: number
          shopify_variant_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_recommendations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_recommendations_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "incomplete_lab_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_recommendations_lab_order_id_fkey"
            columns: ["lab_order_id"]
            isOneToOne: false
            referencedRelation: "lab_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      med_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_fts: unknown
          content_hash: string
          created_at: string | null
          document_id: string
          embedding_chunk: string | null
          embedding_context: string | null
          embedding_dim: number | null
          embedding_model: string | null
          id: number
          safety_tag: string | null
          section_title: string | null
          token_count: number | null
          updated_at: string | null
        }
        Insert: {
          chunk_index: number
          content: string
          content_fts?: unknown
          content_hash: string
          created_at?: string | null
          document_id: string
          embedding_chunk?: string | null
          embedding_context?: string | null
          embedding_dim?: number | null
          embedding_model?: string | null
          id?: number
          safety_tag?: string | null
          section_title?: string | null
          token_count?: number | null
          updated_at?: string | null
        }
        Update: {
          chunk_index?: number
          content?: string
          content_fts?: unknown
          content_hash?: string
          created_at?: string | null
          document_id?: string
          embedding_chunk?: string | null
          embedding_context?: string | null
          embedding_dim?: number | null
          embedding_model?: string | null
          id?: number
          safety_tag?: string | null
          section_title?: string | null
          token_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "med_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "med_documents"
            referencedColumns: ["document_id"]
          },
        ]
      }
      med_documents: {
        Row: {
          created_at: string | null
          document_id: string
          document_type: string
          embedding_dim: number | null
          embedding_model: string | null
          embedding_parent: string | null
          is_current: boolean
          document: string | null
          metadata: Json | null
          source_url: string
          status: string
          title: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
          version: number
        }
        Insert: {
          created_at?: string | null
          document_id: string
          document_type: string
          embedding_dim?: number | null
          embedding_model?: string | null
          embedding_parent?: string | null
          is_current?: boolean
          document?: string | null
          metadata?: Json | null
          source_url: string
          status?: string
          title?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: number
        }
        Update: {
          created_at?: string | null
          document_id?: string
          document_type?: string
          embedding_dim?: number | null
          embedding_model?: string | null
          embedding_parent?: string | null
          is_current?: boolean
          document?: string | null
          metadata?: Json | null
          source_url?: string
          status?: string
          title?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
          version?: number
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          dosage: string
          end_date: string | null
          id: string
          name: string
          schedule: string
          start_date: string
          service_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dosage: string
          end_date?: string | null
          id?: string
          name: string
          schedule: string
          start_date: string
          service_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dosage?: string
          end_date?: string | null
          id?: string
          name?: string
          schedule?: string
          start_date?: string
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          embedding: string | null
          id: number
          importance: number | null
          last_validated_at: string | null
          memory_type: string | null
          metadata: Json | null
          user_id: string
          session_id: string
          source_message_id: string | null
          superseded_at: string | null
          superseded_by_id: number | null
          text: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: number
          importance?: number | null
          last_validated_at?: string | null
          memory_type?: string | null
          metadata?: Json | null
          user_id: string
          session_id: string
          source_message_id?: string | null
          superseded_at?: string | null
          superseded_by_id?: number | null
          text: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          embedding?: string | null
          id?: number
          importance?: number | null
          last_validated_at?: string | null
          memory_type?: string | null
          metadata?: Json | null
          user_id?: string
          session_id?: string
          source_message_id?: string | null
          superseded_at?: string | null
          superseded_by_id?: number | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memories_superseded_by_id_fkey"
            columns: ["superseded_by_id"]
            isOneToOne: false
            referencedRelation: "memories"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          intent: string | null
          meta: Json | null
          risk_level: string | null
          sender_type: string
          session_id: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          intent?: string | null
          meta?: Json | null
          risk_level?: string | null
          sender_type: string
          session_id: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          intent?: string | null
          meta?: Json | null
          risk_level?: string | null
          sender_type?: string
          session_id?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          achieved_at: string | null
          created_at: string | null
          due_date: string | null
          goal_id: string
          id: string
          label: string
          notes: string | null
          target_value: Json | null
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string | null
          due_date?: string | null
          goal_id: string
          id?: string
          label: string
          notes?: string | null
          target_value?: Json | null
        }
        Update: {
          achieved_at?: string | null
          created_at?: string | null
          due_date?: string | null
          goal_id?: string
          id?: string
          label?: string
          notes?: string | null
          target_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          admin_approval_status: string | null
          admin_approved_at: string | null
          admin_approved_by: string | null
          consultation_id: string | null
          created_at: string | null
          fulfillment_hold_status: string | null
          fulfillment_order_id: string | null
          id: string
          order_data: Json
          order_source: string | null
          parent_order_id: string | null
          user_id: string | null
          shopify_order_id: string
          status: string
          synced_at: string | null
        }
        Insert: {
          admin_approval_status?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          consultation_id?: string | null
          created_at?: string | null
          fulfillment_hold_status?: string | null
          fulfillment_order_id?: string | null
          id?: string
          order_data: Json
          order_source?: string | null
          parent_order_id?: string | null
          user_id?: string | null
          shopify_order_id: string
          status: string
          synced_at?: string | null
        }
        Update: {
          admin_approval_status?: string | null
          admin_approved_at?: string | null
          admin_approved_by?: string | null
          consultation_id?: string | null
          created_at?: string | null
          fulfillment_hold_status?: string | null
          fulfillment_order_id?: string | null
          id?: string
          order_data?: Json
          order_source?: string | null
          parent_order_id?: string | null
          user_id?: string | null
          shopify_order_id?: string
          status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_admin_approved_by_fkey"
            columns: ["admin_approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contraindications: {
        Row: {
          contraindications: Json | null
          created_at: string | null
          id: string
          user_id: string
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          contraindications?: Json | null
          created_at?: string | null
          id?: string
          user_id: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          contraindications?: Json | null
          created_at?: string | null
          id?: string
          user_id?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_contraindications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_contraindications_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_form_requests: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          form_type: string
          id: string
          notes: string | null
          user_id: string
          skipped_at: string | null
          status: string
          triggered_by: string
          triggered_by_user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          form_type?: string
          id?: string
          notes?: string | null
          user_id: string
          skipped_at?: string | null
          status?: string
          triggered_by: string
          triggered_by_user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          form_type?: string
          id?: string
          notes?: string | null
          user_id?: string
          skipped_at?: string | null
          status?: string
          triggered_by?: string
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_form_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          bmi_is_override: boolean | null
          created_at: string | null
          goal_bmi: number | null
          goal_height: number | null
          goal_height_unit: string | null
          goal_weight: number | null
          goal_weight_unit: string | null
          id: string
          user_id: string
          recorded_at: string | null
          recorded_by: string | null
        }
        Insert: {
          bmi_is_override?: boolean | null
          created_at?: string | null
          goal_bmi?: number | null
          goal_height?: number | null
          goal_height_unit?: string | null
          goal_weight?: number | null
          goal_weight_unit?: string | null
          id?: string
          user_id: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Update: {
          bmi_is_override?: boolean | null
          created_at?: string | null
          goal_bmi?: number | null
          goal_height?: number | null
          goal_height_unit?: string | null
          goal_weight?: number | null
          goal_weight_unit?: string | null
          id?: string
          user_id?: string
          recorded_at?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goals_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hormones: {
        Row: {
          consultation_id: string | null
          created_at: string | null
          current_cycle_day: string | null
          hormonal_birth_control: boolean | null
          id: string
          lmp_date: string | null
          menstruation_status: string | null
          user_id: string
          recorded_at: string | null
          service_id: string | null
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string | null
          current_cycle_day?: string | null
          hormonal_birth_control?: boolean | null
          id?: string
          lmp_date?: string | null
          menstruation_status?: string | null
          user_id: string
          recorded_at?: string | null
          service_id?: string | null
        }
        Update: {
          consultation_id?: string | null
          created_at?: string | null
          current_cycle_day?: string | null
          hormonal_birth_control?: boolean | null
          id?: string
          lmp_date?: string | null
          menstruation_status?: string | null
          user_id?: string
          recorded_at?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_hormones_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hormones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hormones_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lifestyle: {
        Row: {
          alcohol_consumption: string | null
          consultation_id: string | null
          created_at: string | null
          diet_type: string | null
          exercise_hours_per_week: number | null
          id: string
          user_id: string
          recorded_at: string | null
          sleep_hours_per_night: string | null
          smoking_status: string | null
          stress_level: number | null
          service_id: string | null
        }
        Insert: {
          alcohol_consumption?: string | null
          consultation_id?: string | null
          created_at?: string | null
          diet_type?: string | null
          exercise_hours_per_week?: number | null
          id?: string
          user_id: string
          recorded_at?: string | null
          sleep_hours_per_night?: string | null
          smoking_status?: string | null
          stress_level?: number | null
          service_id?: string | null
        }
        Update: {
          alcohol_consumption?: string | null
          consultation_id?: string | null
          created_at?: string | null
          diet_type?: string | null
          exercise_hours_per_week?: number | null
          id?: string
          user_id?: string
          recorded_at?: string | null
          sleep_hours_per_night?: string | null
          smoking_status?: string | null
          stress_level?: number | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_lifestyle_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_lifestyle_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_lifestyle_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile: {
        Row: {
          consultation_id: string | null
          created_at: string | null
          current_documents: string | null
          diagnosed_conditions: string | null
          hormone_optimization: string | null
          id: string
          user_id: string
          recorded_at: string | null
          thyroid_document: string | null
          service_id: string | null
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string | null
          current_documents?: string | null
          diagnosed_conditions?: string | null
          hormone_optimization?: string | null
          id?: string
          user_id: string
          recorded_at?: string | null
          thyroid_document?: string | null
          service_id?: string | null
        }
        Update: {
          consultation_id?: string | null
          created_at?: string | null
          current_documents?: string | null
          diagnosed_conditions?: string | null
          hormone_optimization?: string | null
          id?: string
          user_id?: string
          recorded_at?: string | null
          thyroid_document?: string | null
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profile_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          consultation_id: string | null
          created_at: string | null
          admin_id: string
          id: string
          note: string
          user_id: string
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string | null
          admin_id: string
          id?: string
          note: string
          user_id: string
        }
        Update: {
          consultation_id?: string | null
          created_at?: string | null
          admin_id?: string
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_service_requests: {
        Row: {
          consultation_id: string | null
          created_at: string | null
          expires_at: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string
          user_id: string
          public_url: string
          storage_path: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string | null
          expires_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename: string
          user_id: string
          public_url: string
          storage_path: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          consultation_id?: string | null
          created_at?: string | null
          expires_at?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string
          user_id?: string
          public_url?: string
          storage_path?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_service_requests_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_service_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_service_requests_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tags: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          user_id: string
          tag: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id: string
          tag: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      applicants: {
        Row: {
          address: string | null
          auth_user_id: string | null
          bmi_classification: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          sex: string | null
          shopify_customer_id: string | null
          timezone: string | null
        }
        Insert: {
          address?: string | null
          auth_user_id?: string | null
          bmi_classification?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          sex?: string | null
          shopify_customer_id?: string | null
          timezone?: string | null
        }
        Update: {
          address?: string | null
          auth_user_id?: string | null
          bmi_classification?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          sex?: string | null
          shopify_customer_id?: string | null
          timezone?: string | null
        }
        Relationships: []
      }
      protocol_instances: {
        Row: {
          completed_at: string | null
          completed_checkpoints: string[] | null
          created_at: string | null
          current_step_index: number
          id: string
          metadata: Json | null
          next_checkpoint_due_at: string | null
          user_id: string
          protocol_id: string
          started_at: string | null
          status: string
          service_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          completed_checkpoints?: string[] | null
          created_at?: string | null
          current_step_index?: number
          id?: string
          metadata?: Json | null
          next_checkpoint_due_at?: string | null
          user_id: string
          protocol_id: string
          started_at?: string | null
          status?: string
          service_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          completed_checkpoints?: string[] | null
          created_at?: string | null
          current_step_index?: number
          id?: string
          metadata?: Json | null
          next_checkpoint_due_at?: string | null
          user_id?: string
          protocol_id?: string
          started_at?: string | null
          status?: string
          service_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocol_instances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_instances_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "service_protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_instances_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_steps: {
        Row: {
          allowed_dose_range_mg: unknown
          checkpoints: Json | null
          created_at: string | null
          education_items: Json | null
          end_week: number
          expected_dose_mg: number | null
          expected_side_effects: string[] | null
          id: string
          monitoring_requirements: Json | null
          phase: string
          protocol_id: string
          red_flag_notes: string[] | null
          start_week: number
          step_index: number
        }
        Insert: {
          allowed_dose_range_mg?: unknown
          checkpoints?: Json | null
          created_at?: string | null
          education_items?: Json | null
          end_week: number
          expected_dose_mg?: number | null
          expected_side_effects?: string[] | null
          id?: string
          monitoring_requirements?: Json | null
          phase: string
          protocol_id: string
          red_flag_notes?: string[] | null
          start_week: number
          step_index: number
        }
        Update: {
          allowed_dose_range_mg?: unknown
          checkpoints?: Json | null
          created_at?: string | null
          education_items?: Json | null
          end_week?: number
          expected_dose_mg?: number | null
          expected_side_effects?: string[] | null
          id?: string
          monitoring_requirements?: Json | null
          phase?: string
          protocol_id?: string
          red_flag_notes?: string[] | null
          start_week?: number
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "protocol_steps_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "service_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaires: {
        Row: {
          id: string
          user_id: string
          questionnaire_type: string
          responses: Json
          status: string
          submitted_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          questionnaire_type: string
          responses: Json
          status?: string
          submitted_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          questionnaire_type?: string
          responses?: Json
          status?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaires_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      refill_tracks: {
        Row: {
          auto_charge_enabled: boolean | null
          created_at: string | null
          id: string
          last_check_at: string | null
          last_result: string
          next_refill_due_at: string | null
          notes: string | null
          user_id: string
          plan_id: string
          rule_state: Json
          service_id: string | null
          updated_at: string | null
        }
        Insert: {
          auto_charge_enabled?: boolean | null
          created_at?: string | null
          id?: string
          last_check_at?: string | null
          last_result: string
          next_refill_due_at?: string | null
          notes?: string | null
          user_id: string
          plan_id: string
          rule_state?: Json
          service_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_charge_enabled?: boolean | null
          created_at?: string | null
          id?: string
          last_check_at?: string | null
          last_result?: string
          next_refill_due_at?: string | null
          notes?: string | null
          user_id?: string
          plan_id?: string
          rule_state?: Json
          service_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refill_tracks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refill_tracks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_transactions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          id: string
          meta: Json | null
          reason: string
          reference_id: string | null
          reference_type: string | null
          source: string
          type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          meta?: Json | null
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          source: string
          type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          meta?: Json | null
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          source?: string
          type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "reward_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_wallets: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          lifetime_earned: number
          lifetime_spent: number
          user_id: string
          updated_at: string | null
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          user_id: string
          updated_at?: string | null
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          lifetime_earned?: number
          lifetime_spent?: number
          user_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          ended_at: string | null
          id: string
          journey_type: string
          metadata: Json | null
          user_id: string
          started_at: string | null
          state: string
        }
        Insert: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          journey_type: string
          metadata?: Json | null
          user_id: string
          started_at?: string | null
          state?: string
        }
        Update: {
          created_at?: string | null
          ended_at?: string | null
          id?: string
          journey_type?: string
          metadata?: Json | null
          user_id?: string
          started_at?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_customers: {
        Row: {
          accepts_marketing: boolean | null
          created_at: string | null
          customer_data: Json
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          orders_count: number | null
          user_id: string | null
          phone: string | null
          shopify_customer_id: number
          state: string | null
          synced_at: string | null
          tags: string[] | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          accepts_marketing?: boolean | null
          created_at?: string | null
          customer_data: Json
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          orders_count?: number | null
          user_id?: string | null
          phone?: string | null
          shopify_customer_id: number
          state?: string | null
          synced_at?: string | null
          tags?: string[] | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          accepts_marketing?: boolean | null
          created_at?: string | null
          customer_data?: Json
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          orders_count?: number | null
          user_id?: string | null
          phone?: string | null
          shopify_customer_id?: number
          state?: string | null
          synced_at?: string | null
          tags?: string[] | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shopify_customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shopify_inventory_levels: {
        Row: {
          available: number | null
          created_at: string | null
          id: string
          inventory_data: Json
          inventory_item_id: number
          location_id: number
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          available?: number | null
          created_at?: string | null
          id?: string
          inventory_data: Json
          inventory_item_id: number
          location_id: number
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          available?: number | null
          created_at?: string | null
          id?: string
          inventory_data?: Json
          inventory_item_id?: number
          location_id?: number
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_shopify_inventory_levels_variant"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "shopify_variants"
            referencedColumns: ["inventory_item_id"]
          },
        ]
      }
      shopify_products: {
        Row: {
          created_at: string | null
          handle: string
          id: string
          product_data: Json
          product_type: string | null
          published_at: string | null
          shopify_product_id: number
          status: string
          synced_at: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          created_at?: string | null
          handle: string
          id?: string
          product_data: Json
          product_type?: string | null
          published_at?: string | null
          shopify_product_id: number
          status: string
          synced_at?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          created_at?: string | null
          handle?: string
          id?: string
          product_data?: Json
          product_type?: string | null
          published_at?: string | null
          shopify_product_id?: number
          status?: string
          synced_at?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: []
      }
      shopify_sync_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          records_synced: number | null
          started_at: string | null
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          started_at?: string | null
          status: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          records_synced?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
        }
        Relationships: []
      }
      shopify_variants: {
        Row: {
          compare_at_price: number | null
          created_at: string | null
          id: string
          inventory_item_id: number | null
          inventory_policy: string | null
          inventory_quantity: number | null
          position: number | null
          price: number
          shopify_product_id: number
          shopify_variant_id: number
          sku: string | null
          synced_at: string | null
          title: string
          updated_at: string | null
          variant_data: Json
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          inventory_item_id?: number | null
          inventory_policy?: string | null
          inventory_quantity?: number | null
          position?: number | null
          price: number
          shopify_product_id: number
          shopify_variant_id: number
          sku?: string | null
          synced_at?: string | null
          title: string
          updated_at?: string | null
          variant_data: Json
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          inventory_item_id?: number | null
          inventory_policy?: string | null
          inventory_quantity?: number | null
          position?: number | null
          price?: number
          shopify_product_id?: number
          shopify_variant_id?: number
          sku?: string | null
          synced_at?: string | null
          title?: string
          updated_at?: string | null
          variant_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fk_shopify_variants_product"
            columns: ["shopify_product_id"]
            isOneToOne: false
            referencedRelation: "shopify_products"
            referencedColumns: ["shopify_product_id"]
          },
        ]
      }
      side_effect_reports: {
        Row: {
          action_taken: string | null
          created_at: string | null
          description: string
          escalated_at: string | null
          id: string
          document_id: string | null
          metadata: Json | null
          user_id: string
          requires_escalation: boolean | null
          resolved_at: string | null
          severity: number
          service_id: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          description: string
          escalated_at?: string | null
          id?: string
          document_id?: string | null
          metadata?: Json | null
          user_id: string
          requires_escalation?: boolean | null
          resolved_at?: string | null
          severity: number
          service_id?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          description?: string
          escalated_at?: string | null
          id?: string
          document_id?: string | null
          metadata?: Json | null
          user_id?: string
          requires_escalation?: boolean | null
          resolved_at?: string | null
          severity?: number
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "side_effect_reports_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "side_effect_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "side_effect_reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          created_at: string | null
          id: string
          is_pinned: boolean | null
          note: string
          note_type: string
          applicant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          note: string
          note_type?: string
          applicant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          note?: string
          note_type?: string
          applicant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      supplement_mapping_rules: {
        Row: {
          condition: string
          enabled: boolean | null
          id: string
          metric_code: string
          priority: string
          product_ids: string[] | null
          product_tags: string[] | null
          reason: string
        }
        Insert: {
          condition: string
          enabled?: boolean | null
          id: string
          metric_code: string
          priority: string
          product_ids?: string[] | null
          product_tags?: string[] | null
          reason: string
        }
        Update: {
          condition?: string
          enabled?: boolean | null
          id?: string
          metric_code?: string
          priority?: string
          product_ids?: string[] | null
          product_tags?: string[] | null
          reason?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          name: string
          notes: string | null
          onset: string
          user_id: string
          resolved_at: string | null
          severity: number
          service_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          notes?: string | null
          onset: string
          user_id: string
          resolved_at?: string | null
          severity: number
          service_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          notes?: string | null
          onset?: string
          user_id?: string
          resolved_at?: string | null
          severity?: number
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_protocols: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          document: string
          metadata: Json | null
          name: string
          protocol_type: string
          sop_source: string | null
          total_weeks: number
          updated_at: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          document: string
          metadata?: Json | null
          name: string
          protocol_type: string
          sop_source?: string | null
          total_weeks: number
          updated_at?: string | null
          version?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          document?: string
          metadata?: Json | null
          name?: string
          protocol_type?: string
          sop_source?: string | null
          total_weeks?: number
          updated_at?: string | null
          version?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          approval_notes: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          consultation_id: string | null
          created_at: string | null
          id: string
          user_id: string
          plan_json: Json
          product: string
          start_date: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string | null
          id?: string
          user_id: string
          plan_json: Json
          product: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          consultation_id?: string | null
          created_at?: string | null
          id?: string
          user_id?: string
          plan_json?: Json
          product?: string
          start_date?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_destinations: {
        Row: {
          canonical_name: string
          aliases_json: Json
          city: string | null
          completeness_score: number | null
          confidence_score: number | null
          country_code: string | null
          country_name: string | null
          country_name_en: string | null
          country_name_zh: string | null
          created_at: string | null
          currency: string | null
          data_quality: string
          display_name: string
          geonames_id: string | null
          id: string
          is_active: boolean | null
          is_dropdown_enabled: boolean | null
          is_featured: boolean | null
          is_popular: boolean | null
          is_searchable: boolean | null
          is_verified: boolean | null
          last_enriched_at: string | null
          latitude: number | null
          longitude: number | null
          name_en: string | null
          name_zh: string | null
          normalized_name: string | null
          osm_id: string | null
          place_type: string | null
          popularity_score: number | null
          population: number | null
          region: string | null
          show_on_home: boolean | null
          source: string | null
          source_updated_at: string | null
          timezone: string | null
          updated_at: string | null
          wikidata_qid: string | null
        }
        Insert: {
          canonical_name: string
          aliases_json?: Json
          city?: string | null
          completeness_score?: number | null
          confidence_score?: number | null
          country_code?: string | null
          country_name?: string | null
          country_name_en?: string | null
          country_name_zh?: string | null
          created_at?: string | null
          currency?: string | null
          data_quality?: string
          display_name: string
          geonames_id?: string | null
          id?: string
          is_active?: boolean | null
          is_dropdown_enabled?: boolean | null
          is_featured?: boolean | null
          is_popular?: boolean | null
          is_searchable?: boolean | null
          is_verified?: boolean | null
          last_enriched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name_en?: string | null
          name_zh?: string | null
          normalized_name?: string | null
          osm_id?: string | null
          place_type?: string | null
          popularity_score?: number | null
          population?: number | null
          region?: string | null
          show_on_home?: boolean | null
          source?: string | null
          source_updated_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          wikidata_qid?: string | null
        }
        Update: {
          canonical_name?: string
          aliases_json?: Json
          city?: string | null
          completeness_score?: number | null
          confidence_score?: number | null
          country_code?: string | null
          country_name?: string | null
          country_name_en?: string | null
          country_name_zh?: string | null
          created_at?: string | null
          currency?: string | null
          data_quality?: string
          display_name?: string
          geonames_id?: string | null
          id?: string
          is_active?: boolean | null
          is_dropdown_enabled?: boolean | null
          is_featured?: boolean | null
          is_popular?: boolean | null
          is_searchable?: boolean | null
          is_verified?: boolean | null
          last_enriched_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name_en?: string | null
          name_zh?: string | null
          normalized_name?: string | null
          osm_id?: string | null
          place_type?: string | null
          popularity_score?: number | null
          population?: number | null
          region?: string | null
          show_on_home?: boolean | null
          source?: string | null
          source_updated_at?: string | null
          timezone?: string | null
          updated_at?: string | null
          wikidata_qid?: string | null
        }
        Relationships: []
      }
      travel_destination_aliases: {
        Row: {
          alias: string
          created_at: string | null
          destination_id: string
          id: string
          language: string | null
          normalized_alias: string | null
          source: string | null
        }
        Insert: {
          alias: string
          created_at?: string | null
          destination_id: string
          id?: string
          language?: string | null
          normalized_alias?: string | null
          source?: string | null
        }
        Update: {
          alias?: string
          created_at?: string | null
          destination_id?: string
          id?: string
          language?: string | null
          normalized_alias?: string | null
          source?: string | null
        }
        Relationships: []
      }
      travel_attractions: {
        Row: {
          canonical_name: string
          category: string | null
          created_at: string | null
          data_quality: string
          description_en: string | null
          description_zh: string | null
          destination_id: string
          id: string
          latitude: number | null
          longitude: number | null
          name_en: string
          name_zh: string | null
          popularity_score: number | null
          recommended_duration_minutes: number | null
          source: string | null
          source_url: string | null
          updated_at: string | null
        }
        Insert: {
          canonical_name: string
          category?: string | null
          created_at?: string | null
          data_quality?: string
          description_en?: string | null
          description_zh?: string | null
          destination_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_en: string
          name_zh?: string | null
          popularity_score?: number | null
          recommended_duration_minutes?: number | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Update: {
          canonical_name?: string
          category?: string | null
          created_at?: string | null
          data_quality?: string
          description_en?: string | null
          description_zh?: string | null
          destination_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name_en?: string
          name_zh?: string | null
          popularity_score?: number | null
          recommended_duration_minutes?: number | null
          source?: string | null
          source_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      travel_assets: {
        Row: {
          asset_type: string
          attribution: string | null
          confidence_score: number | null
          created_at: string | null
          entity_id: string
          entity_type: string
          height: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          license: string | null
          source: string | null
          source_url: string | null
          thumbnail_url: string | null
          updated_at: string | null
          verified: boolean | null
          width: number | null
        }
        Insert: {
          asset_type: string
          attribution?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          height?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          license?: string | null
          source?: string | null
          source_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          verified?: boolean | null
          width?: number | null
        }
        Update: {
          asset_type?: string
          attribution?: string | null
          confidence_score?: number | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          height?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          license?: string | null
          source?: string | null
          source_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
          verified?: boolean | null
          width?: number | null
        }
        Relationships: []
      }
      travel_destination_cards: {
        Row: {
          card_type: string
          confidence_score: number | null
          created_at: string | null
          description_en: string | null
          description_zh: string | null
          destination_id: string
          id: string
          image_asset_id: string | null
          image_url: string | null
          is_generated: boolean | null
          payload_json: Json
          source: string | null
          source_status: string
          subtitle: string | null
          subtitle_en: string | null
          subtitle_zh: string | null
          title: string
          title_en: string | null
          title_zh: string | null
          updated_at: string | null
        }
        Insert: {
          card_type: string
          confidence_score?: number | null
          created_at?: string | null
          description_en?: string | null
          description_zh?: string | null
          destination_id: string
          id?: string
          image_asset_id?: string | null
          image_url?: string | null
          is_generated?: boolean | null
          payload_json?: Json
          source?: string | null
          source_status?: string
          subtitle?: string | null
          subtitle_en?: string | null
          subtitle_zh?: string | null
          title: string
          title_en?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Update: {
          card_type?: string
          confidence_score?: number | null
          created_at?: string | null
          description_en?: string | null
          description_zh?: string | null
          destination_id?: string
          id?: string
          image_asset_id?: string | null
          image_url?: string | null
          is_generated?: boolean | null
          payload_json?: Json
          source?: string | null
          source_status?: string
          subtitle?: string | null
          subtitle_en?: string | null
          subtitle_zh?: string | null
          title?: string
          title_en?: string | null
          title_zh?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      travel_enrichment_jobs: {
        Row: {
          created_at: string | null
          destination_id: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          missing_fields_json: Json
          provider: string | null
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          destination_id: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          missing_fields_json?: Json
          provider?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          destination_id?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          missing_fields_json?: Json
          provider?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      travel_enrichment_events: {
        Row: {
          created_at: string | null
          destination_id: string | null
          event_type: string
          id: string
          job_id: string | null
          message: string | null
          metadata_json: Json
        }
        Insert: {
          created_at?: string | null
          destination_id?: string | null
          event_type: string
          id?: string
          job_id?: string | null
          message?: string | null
          metadata_json?: Json
        }
        Update: {
          created_at?: string | null
          destination_id?: string | null
          event_type?: string
          id?: string
          job_id?: string | null
          message?: string | null
          metadata_json?: Json
        }
        Relationships: []
      }
      travel_itinerary_sessions: {
        Row: {
          application_id: string | null
          card_state_json: Json
          conversation_memory_json: Json
          created_at: string | null
          destination_id: string | null
          id: string
          itinerary_json: Json
          map_state_json: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          application_id?: string | null
          card_state_json?: Json
          conversation_memory_json?: Json
          created_at?: string | null
          destination_id?: string | null
          id?: string
          itinerary_json?: Json
          map_state_json?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          application_id?: string | null
          card_state_json?: Json
          conversation_memory_json?: Json
          created_at?: string | null
          destination_id?: string | null
          id?: string
          itinerary_json?: Json
          map_state_json?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      travel_unresolved_destinations: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          id: string
          llm_guess_json: Json | null
          resolved_name: string | null
          status: string
          updated_at: string | null
          user_input: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          llm_guess_json?: Json | null
          resolved_name?: string | null
          status?: string
          updated_at?: string | null
          user_input: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          llm_guess_json?: Json | null
          resolved_name?: string | null
          status?: string
          updated_at?: string | null
          user_input?: string
        }
        Relationships: []
      }
      triage_decisions: {
        Row: {
          created_at: string | null
          eligibility_status: string
          expires_at: string | null
          id: string
          user_id: string
          product_pathway: string
          questionnaire_id: string | null
          reason_json: Json
          recommended_service: string | null
          requires_consultation: boolean | null
          risk_factors: string[] | null
        }
        Insert: {
          created_at?: string | null
          eligibility_status: string
          expires_at?: string | null
          id?: string
          user_id: string
          product_pathway: string
          questionnaire_id?: string | null
          reason_json: Json
          recommended_service?: string | null
          requires_consultation?: boolean | null
          risk_factors?: string[] | null
        }
        Update: {
          created_at?: string | null
          eligibility_status?: string
          expires_at?: string | null
          id?: string
          user_id?: string
          product_pathway?: string
          questionnaire_id?: string | null
          reason_json?: Json
          recommended_service?: string | null
          requires_consultation?: boolean | null
          risk_factors?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "triage_decisions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "triage_decisions_questionnaire_id_fkey"
            columns: ["questionnaire_id"]
            isOneToOne: false
            referencedRelation: "questionnaires"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          id: string
          name: string
          role: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          id?: string
          name: string
          role?: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_data: {
        Row: {
          created_at: string | null
          id: string
          meta: Json | null
          metric: string
          user_id: string
          recorded_at: string | null
          service_id: string | null
          unit: string
          value: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          meta?: Json | null
          metric: string
          user_id: string
          recorded_at?: string | null
          service_id?: string | null
          unit: string
          value: number
        }
        Update: {
          created_at?: string | null
          id?: string
          meta?: Json | null
          metric?: string
          user_id?: string
          recorded_at?: string | null
          service_id?: string | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "profile_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_data_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_error_details: {
        Row: {
          activity_log_id: string
          created_at: string | null
          environment_context: Json | null
          id: string
          processing_steps: Json | null
          request_headers: Json | null
          request_payload: Json | null
          stack_trace: string | null
        }
        Insert: {
          activity_log_id: string
          created_at?: string | null
          environment_context?: Json | null
          id?: string
          processing_steps?: Json | null
          request_headers?: Json | null
          request_payload?: Json | null
          stack_trace?: string | null
        }
        Update: {
          activity_log_id?: string
          created_at?: string | null
          environment_context?: Json | null
          id?: string
          processing_steps?: Json | null
          request_headers?: Json | null
          request_payload?: Json | null
          stack_trace?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_error_details_activity_log_id_fkey"
            columns: ["activity_log_id"]
            isOneToOne: false
            referencedRelation: "activity_log"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      incomplete_lab_orders: {
        Row: {
          created_at: string | null
          id: string | null
          missing_metrics: Json | null
          order_status: string | null
          user_email: string | null
          user_name: string | null
          phenoage_completeness: number | null
          validation_status: string | null
          warning_message: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_protocol_step: {
        Args: { p_event?: string; p_user_id: string }
        Returns: boolean
      }
      calculate_adherence_score: {
        Args: { p_user_id: string }
        Returns: number
      }
      create_pending_checkins: { Args: never; Returns: number }
      get_active_goals: {
        Args: { p_user_id: string }
        Returns: {
          goal_id: string
          goal_type: string
          progress_percent: number
          reason: string
          start_date: string
          target_date: string
          target_json: Json
        }[]
      }
      get_consultation_status_counts: {
        Args: { admin_filter?: string; end_date?: string; start_date?: string }
        Returns: {
          count: number
          status: string
        }[]
      }
      get_med_knowledge_stats: {
        Args: never
        Returns: {
          documents: string[]
          total_chunks: number
          total_documents: number
        }[]
      }
      get_order_revenue: {
        Args: { end_date?: string; start_date?: string }
        Returns: number
      }
      get_protocol_critical_info: {
        Args: { p_user_id: string }
        Returns: {
          checkpoints: Json
          education_items: Json
          expected_side_effects: string[]
          red_flag_notes: string[]
        }[]
      }
      get_protocol_instance: {
        Args: { p_user_id: string }
        Returns: {
          current_phase: string
          current_step_index: number
          expected_dose_mg: number
          instance_id: string
          next_checkpoint_due_at: string
          protocol_name: string
          status: string
        }[]
      }
      get_recent_profile_data: {
        Args: { p_days?: number; p_metric?: string; p_user_id: string }
        Returns: {
          metric: string
          recorded_at: string
          unit: string
          value: number
        }[]
      }
      get_service_approval_counts: {
        Args: { admin_filter?: string; end_date?: string; start_date?: string }
        Returns: {
          approval_status: string
          count: number
        }[]
      }
      hybrid_search_med_knowledge: {
        Args: {
          filter_document?: string
          keyword_weight?: number
          match_count?: number
          min_similarity?: number
          query_embedding: string
          query_text: string
          semantic_weight?: number
        }
        Returns: {
          chunk_index: number
          content: string
          document_id: string
          document_type: string
          hybrid_score: number
          id: number
          keyword_rank: number
          document: string
          section_title: string
          similarity: number
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      search_med_knowledge: {
        Args: {
          filter_document?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          chunk_id: number
          content: string
          document_id: string
          document_type: string
          document: string
          section_title: string
          similarity: number
        }[]
      }
      search_user_memories: {
        Args: {
          filter_memory_type?: string
          filter_min_importance?: number
          include_superseded?: boolean
          match_count?: number
          min_similarity?: number
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          combined_score: number
          confidence_score: number
          created_at: string
          id: number
          importance: number
          memory_type: string
          metadata: Json
          recency_score: number
          similarity: number
          text: string
        }[]
      }
      update_consultation_statuses: { Args: never; Returns: undefined }
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

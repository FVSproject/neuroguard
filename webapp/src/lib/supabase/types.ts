// Manual DB types matching supabase/schema.sql. Once the schema stabilises
// we can `supabase gen types typescript` to auto-generate this, but hand-
// written is fine for our size.
//
// The shape below (Row / Insert / Update / Relationships) is exactly what
// Supabase's type-gen emits and what @supabase/postgrest-js's GenericTable
// constraint expects. Skipping `Relationships` silently types every query
// result as `never` — which is what tripped us up on the first build.

import type { ThresholdConfig } from "@/lib/types";

export type Database = {
  public: {
    Tables: {
      babies: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          dob: string | null;
          weight_kg: number | null;
          height_cm: number | null;
          gender: "male" | "female" | "other" | null;
          notes: string | null;
          photo_data_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          dob?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          gender?: "male" | "female" | "other" | null;
          notes?: string | null;
          photo_data_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          dob?: string | null;
          weight_kg?: number | null;
          height_cm?: number | null;
          gender?: "male" | "female" | "other" | null;
          notes?: string | null;
          photo_data_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      parents: {
        Row: {
          id: string;
          baby_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          relation: string | null;
        };
        Insert: {
          id?: string;
          baby_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          relation?: string | null;
        };
        Update: {
          id?: string;
          baby_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          relation?: string | null;
        };
        Relationships: [];
      };
      emergency_contacts: {
        Row: {
          id: string;
          baby_id: string;
          name: string;
          phone: string;
          relation: string | null;
          order: number;
        };
        Insert: {
          id?: string;
          baby_id: string;
          name: string;
          phone: string;
          relation?: string | null;
          order?: number;
        };
        Update: {
          id?: string;
          baby_id?: string;
          name?: string;
          phone?: string;
          relation?: string | null;
          order?: number;
        };
        Relationships: [];
      };
      baby_thresholds: {
        Row: {
          baby_id: string;
          entries: ThresholdConfig[];
          updated_at: string;
        };
        Insert: {
          baby_id: string;
          entries: ThresholdConfig[];
          updated_at?: string;
        };
        Update: {
          baby_id?: string;
          entries?: ThresholdConfig[];
          updated_at?: string;
        };
        Relationships: [];
      };
      alarm_prefs: {
        Row: {
          baby_id: string;
          sound_enabled: boolean;
          sound_name: string;
          volume: number;
          vibrate: boolean;
          updated_at: string;
        };
        Insert: {
          baby_id: string;
          sound_enabled?: boolean;
          sound_name?: string;
          volume?: number;
          vibrate?: boolean;
          updated_at?: string;
        };
        Update: {
          baby_id?: string;
          sound_enabled?: boolean;
          sound_name?: string;
          volume?: number;
          vibrate?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      log_entries: {
        Row: {
          id: number;
          baby_id: string;
          ts_ms: number;
          kind: string;
          metric: string | null;
          severity: string;
          message: string;
          value: number | null;
        };
        Insert: {
          id?: number;
          baby_id: string;
          ts_ms: number;
          kind: string;
          metric?: string | null;
          severity: string;
          message: string;
          value?: number | null;
        };
        Update: {
          id?: number;
          baby_id?: string;
          ts_ms?: number;
          kind?: string;
          metric?: string | null;
          severity?: string;
          message?: string;
          value?: number | null;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

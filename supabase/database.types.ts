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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          address_complement: string | null
          address_line: string | null
          address_number: string | null
          birth_date: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          event_code: string | null
          height: string | null
          id: string
          name: string
          neighborhood: string | null
          phone: string | null
          postal_code: string | null
          profession: string | null
          state: string | null
          updated_at: string
          weight: string | null
        }
        Insert: {
          address_complement?: string | null
          address_line?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_code?: string | null
          height?: string | null
          id?: string
          name: string
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          state?: string | null
          updated_at?: string
          weight?: string | null
        }
        Update: {
          address_complement?: string | null
          address_line?: string | null
          address_number?: string | null
          birth_date?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          event_code?: string | null
          height?: string | null
          id?: string
          name?: string
          neighborhood?: string | null
          phone?: string | null
          postal_code?: string | null
          profession?: string | null
          state?: string | null
          updated_at?: string
          weight?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          foam_line: string
          frame_finish: string
          id: string
          manufacturing_notes: string | null
          order_id: string
          piston: string | null
          product_name: string
          quantity: number
          saddle_model: string
          saddle_size: string
          seat_color: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          foam_line: string
          frame_finish?: string
          id?: string
          manufacturing_notes?: string | null
          order_id: string
          piston?: string | null
          product_name?: string
          quantity?: number
          saddle_model?: string
          saddle_size?: string
          seat_color?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          foam_line?: string
          frame_finish?: string
          id?: string
          manufacturing_notes?: string | null
          order_id?: string
          piston?: string | null
          product_name?: string
          quantity?: number
          saddle_model?: string
          saddle_size?: string
          seat_color?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_status: string
          note: string | null
          order_id: string
          previous_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: string
          note?: string | null
          order_id: string
          previous_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: string
          note?: string | null
          order_id?: string
          previous_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_interactions: {
        Row: {
          created_at: string
          created_by: string | null
          happened_at: string
          id: string
          interaction_type: string
          note: string
          prospect_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          happened_at?: string
          id?: string
          interaction_type: string
          note: string
          prospect_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          happened_at?: string
          id?: string
          interaction_type?: string
          note?: string
          prospect_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_interactions_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          address_line: string | null
          business_name: string
          category: string | null
          city: string
          cnpj: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          google_place_id: string | null
          id: string
          last_checked_at: string | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          notes: string | null
          phone: string | null
          postal_code: string | null
          priority: string
          source_provider: string
          source_url: string | null
          state: string
          status: string
          updated_at: string
          updated_by: string | null
          website: string | null
        }
        Insert: {
          address_line?: string | null
          business_name: string
          category?: string | null
          city?: string
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_place_id?: string | null
          id?: string
          last_checked_at?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          priority?: string
          source_provider?: string
          source_url?: string | null
          state?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Update: {
          address_line?: string | null
          business_name?: string
          category?: string | null
          city?: string
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          google_place_id?: string | null
          id?: string
          last_checked_at?: string | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          priority?: string
          source_provider?: string
          source_url?: string | null
          state?: string
          status?: string
          updated_at?: string
          updated_by?: string | null
          website?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_received: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_snapshot: Json
          discount_amount: number
          discount_pct: number
          freight: number
          id: string
          installment_amount: number
          installments: number
          issue_date: string
          notes: string | null
          order_number: string | null
          order_snapshot: Json
          representative: string | null
          signature_city: string | null
          status: string
          subtotal: number
          total: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_received?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_snapshot?: Json
          discount_amount?: number
          discount_pct?: number
          freight?: number
          id?: string
          installment_amount?: number
          installments?: number
          issue_date?: string
          notes?: string | null
          order_number?: string | null
          order_snapshot?: Json
          representative?: string | null
          signature_city?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_received?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_snapshot?: Json
          discount_amount?: number
          discount_pct?: number
          freight?: number
          id?: string
          installment_amount?: number
          installments?: number
          issue_date?: string
          notes?: string | null
          order_number?: string | null
          order_snapshot?: Json
          representative?: string | null
          signature_city?: string | null
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
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

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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
          summary: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          summary?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          summary?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_user_id: string
          amount: number
          created_at: string
          id: string
          order_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_user_id: string
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_user_id?: string
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_user_id: string
          created_at: string
          id: string
          referred_email: string | null
          referred_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          affiliate_user_id: string
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          affiliate_user_id?: string
          created_at?: string
          id?: string
          referred_email?: string | null
          referred_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_uses: number | null
          min_subtotal: number
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal?: number
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          min_subtotal?: number
          updated_at?: string
          uses?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_image_url: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_image_url?: string | null
          product_name: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_name?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          discount: number
          id: string
          insurance: number
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          resend_notes: string | null
          resend_requested_at: string | null
          resend_sent_at: string | null
          resend_status: string | null
          shipping: number
          shipping_city: string | null
          shipping_complement: string | null
          shipping_cpf: string | null
          shipping_district: string | null
          shipping_full_name: string | null
          shipping_number: string | null
          shipping_phone: string | null
          shipping_state: string | null
          shipping_street: string | null
          shipping_zip: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          discount?: number
          id?: string
          insurance?: number
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          resend_notes?: string | null
          resend_requested_at?: string | null
          resend_sent_at?: string | null
          resend_status?: string | null
          shipping?: number
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_cpf?: string | null
          shipping_district?: string | null
          shipping_full_name?: string | null
          shipping_number?: string | null
          shipping_phone?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_zip?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          discount?: number
          id?: string
          insurance?: number
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          resend_notes?: string | null
          resend_requested_at?: string | null
          resend_sent_at?: string | null
          resend_status?: string | null
          shipping?: number
          shipping_city?: string | null
          shipping_complement?: string | null
          shipping_cpf?: string | null
          shipping_district?: string | null
          shipping_full_name?: string | null
          shipping_number?: string | null
          shipping_phone?: string | null
          shipping_state?: string | null
          shipping_street?: string | null
          shipping_zip?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          product_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active_principle: string | null
          category_id: string | null
          composition: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          price: number
          sale_price: number | null
          slug: string
          stock: number
          updated_at: string
        }
        Insert: {
          active_principle?: string | null
          category_id?: string | null
          composition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          price?: number
          sale_price?: number | null
          slug: string
          stock?: number
          updated_at?: string
        }
        Update: {
          active_principle?: string | null
          category_id?: string | null
          composition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          price?: number
          sale_price?: number | null
          slug?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          affiliate_code: string | null
          cpf: string | null
          created_at: string
          email: string
          facebook_pixel: string | null
          full_name: string | null
          id: string
          phone: string | null
          referred_by_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          affiliate_code?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          facebook_pixel?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referred_by_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          affiliate_code?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          facebook_pixel?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          referred_by_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resend_logs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          active: boolean
          created_at: string
          delivery_days_max: number | null
          delivery_days_min: number | null
          id: string
          label: string
          price: number
          state: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          label?: string
          price?: number
          state: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          delivery_days_max?: number | null
          delivery_days_min?: number | null
          id?: string
          label?: string
          price?: number
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_banners: {
        Row: {
          active: boolean
          created_at: string
          cta_label: string | null
          cta_url: string | null
          display_order: number
          id: string
          image_url: string | null
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
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
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_order: {
        Args: {
          p_city: string
          p_complement: string
          p_coupon_code: string
          p_cpf: string
          p_district: string
          p_full_name: string
          p_insurance: boolean
          p_items: Json
          p_notes: string
          p_number: string
          p_payment_method: string
          p_phone: string
          p_shipping_id: string
          p_state: string
          p_street: string
          p_zip: string
        }
        Returns: string
      }
      funnel_by_product: {
        Args: { p_end: string; p_limit?: number; p_start: string }
        Returns: {
          cart_adds: number
          cart_to_paid: number
          product_id: string
          product_name: string
          product_slug: string
          units_paid: number
          view_to_cart: number
          views: number
          wishlist_adds: number
        }[]
      }
      funnel_summary: {
        Args: { p_end: string; p_start: string }
        Returns: {
          cart_adds: number
          checkout_started: number
          orders_paid: number
          orders_total: number
          revenue_paid: number
          unique_viewers: number
          views: number
          wishlist_adds: number
        }[]
      }
      generate_affiliate_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_method: "pix" | "credit_card" | "boleto"
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
      app_role: ["admin", "customer"],
      order_status: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_method: ["pix", "credit_card", "boleto"],
    },
  },
} as const

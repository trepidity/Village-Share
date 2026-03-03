export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type VillageRole = 'owner' | 'admin' | 'member'
export type ItemStatus = 'available' | 'borrowed' | 'unavailable'
export type CollectionType = 'workshop' | 'kitchen' | 'craft_room' | 'library' | 'garage' | 'closet' | 'party_supplies' | 'general'
export type BorrowStatus = 'requested' | 'active' | 'returned' | 'cancelled'
export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'fulfilled'
export type NotificationChannel = 'sms'
export type NotificationStatus = 'pending' | 'sent' | 'failed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          phone: string | null
          phone_verified: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          avatar_url?: string | null
        }
        Update: {
          display_name?: string | null
          phone?: string | null
          phone_verified?: boolean
          avatar_url?: string | null
        }
        Relationships: []
      }
      villages: {
        Row: {
          id: string
          name: string
          description: string | null
          invite_token: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          invite_token?: string
          created_by: string
        }
        Update: {
          name?: string
          description?: string | null
          invite_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "villages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      village_members: {
        Row: {
          id: string
          village_id: string
          user_id: string
          role: VillageRole
          created_at: string
        }
        Insert: {
          id?: string
          village_id: string
          user_id: string
          role?: VillageRole
        }
        Update: {
          role?: VillageRole
        }
        Relationships: [
          {
            foreignKeyName: "village_members_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "village_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      shops: {
        Row: {
          id: string
          owner_id: string
          village_id: string
          name: string
          short_name: string
          description: string | null
          type: CollectionType
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          village_id: string
          name: string
          short_name?: string
          description?: string | null
          type?: CollectionType
          is_active?: boolean
        }
        Update: {
          name?: string
          short_name?: string
          description?: string | null
          type?: CollectionType
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shops_village_id_fkey"
            columns: ["village_id"]
            isOneToOne: false
            referencedRelation: "villages"
            referencedColumns: ["id"]
          }
        ]
      }
      items: {
        Row: {
          id: string
          shop_id: string
          location_shop_id: string
          name: string
          description: string | null
          category: string | null
          photo_url: string | null
          status: ItemStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          location_shop_id?: string
          name: string
          description?: string | null
          category?: string | null
          photo_url?: string | null
          status?: ItemStatus
        }
        Update: {
          name?: string
          location_shop_id?: string
          description?: string | null
          category?: string | null
          photo_url?: string | null
          status?: ItemStatus
        }
        Relationships: [
          {
            foreignKeyName: "items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_location_shop_id_fkey"
            columns: ["location_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          }
        ]
      }
      borrows: {
        Row: {
          id: string
          item_id: string
          borrower_id: string
          from_shop_id: string
          return_shop_id: string | null
          status: BorrowStatus
          due_at: string | null
          borrowed_at: string | null
          returned_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          borrower_id: string
          from_shop_id: string
          return_shop_id?: string | null
          status?: BorrowStatus
          due_at?: string | null
          borrowed_at?: string | null
        }
        Update: {
          status?: BorrowStatus
          return_shop_id?: string | null
          due_at?: string | null
          borrowed_at?: string | null
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "borrows_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrows_borrower_id_fkey"
            columns: ["borrower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "borrows_from_shop_id_fkey"
            columns: ["from_shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          }
        ]
      }
      reservations: {
        Row: {
          id: string
          item_id: string
          user_id: string
          starts_at: string
          ends_at: string
          status: ReservationStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          item_id: string
          user_id: string
          starts_at: string
          ends_at: string
          status?: ReservationStatus
        }
        Update: {
          starts_at?: string
          ends_at?: string
          status?: ReservationStatus
        }
        Relationships: [
          {
            foreignKeyName: "reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      blackout_periods: {
        Row: {
          id: string
          shop_id: string
          item_id: string | null
          starts_at: string
          ends_at: string
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          item_id?: string | null
          starts_at: string
          ends_at: string
          reason?: string | null
        }
        Update: {
          starts_at?: string
          ends_at?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blackout_periods_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blackout_periods_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          }
        ]
      }
      sms_sessions: {
        Row: {
          id: string
          phone: string
          user_id: string
          active_shop_id: string | null
          last_intent: Json | null
          last_active_at: string
          created_at: string
        }
        Insert: {
          id?: string
          phone: string
          user_id: string
          active_shop_id?: string | null
          last_intent?: Json | null
        }
        Update: {
          active_shop_id?: string | null
          last_intent?: Json | null
          last_active_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          channel: NotificationChannel
          status: NotificationStatus
          body: string
          scheduled_at: string
          sent_at: string | null
          error: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          channel?: NotificationChannel
          status?: NotificationStatus
          body: string
          scheduled_at?: string
          metadata?: Json | null
        }
        Update: {
          status?: NotificationStatus
          sent_at?: string | null
          error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      unrecognized_messages: {
        Row: {
          id: string
          user_id: string
          raw_message: string
          source: string
          ai_attempted: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          raw_message: string
          source: string
          ai_attempted?: boolean
        }
        Update: {
          raw_message?: string
          source?: string
          ai_attempted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "unrecognized_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      village_role: VillageRole
      item_status: ItemStatus
      borrow_status: BorrowStatus
      reservation_status: ReservationStatus
      notification_channel: NotificationChannel
      notification_status: NotificationStatus
      collection_type: CollectionType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

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
      users: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          kb_token_balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          kb_token_balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          kb_token_balance?: number
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          mode: 'personal' | 'team'
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          mode: 'personal' | 'team'
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          mode?: 'personal' | 'team'
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member' | 'viewer'
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role: 'owner' | 'admin' | 'member' | 'viewer'
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'member' | 'viewer'
          joined_at?: string
        }
      }
      boards: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          template: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          template?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          template?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      columns: {
        Row: {
          id: string
          board_id: string
          name: string
          order_index: number
          wip_limit: number | null
          color: string | null
          collapsed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          order_index: number
          wip_limit?: number | null
          color?: string | null
          collapsed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          order_index?: number
          wip_limit?: number | null
          color?: string | null
          collapsed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      cards: {
        Row: {
          id: string
          column_id: string
          title: string
          description: string | null
          priority: 'low' | 'medium' | 'high' | 'critical' | null
          assignee_id: string | null
          due_date: string | null
          estimated_time_minutes: number | null
          actual_time_minutes: number | null
          created_at: string
          updated_at: string
          start_date: string | null
          completion_date: string | null
          blocked: boolean
          blocker_reason: string | null
          order_index: number
        }
        Insert: {
          id?: string
          column_id: string
          title: string
          description?: string | null
          priority?: 'low' | 'medium' | 'high' | 'critical' | null
          assignee_id?: string | null
          due_date?: string | null
          estimated_time_minutes?: number | null
          actual_time_minutes?: number | null
          created_at?: string
          updated_at?: string
          start_date?: string | null
          completion_date?: string | null
          blocked?: boolean
          blocker_reason?: string | null
          order_index: number
        }
        Update: {
          id?: string
          column_id?: string
          title?: string
          description?: string | null
          priority?: 'low' | 'medium' | 'high' | 'critical' | null
          assignee_id?: string | null
          due_date?: string | null
          estimated_time_minutes?: number | null
          actual_time_minutes?: number | null
          created_at?: string
          updated_at?: string
          start_date?: string | null
          completion_date?: string | null
          blocked?: boolean
          blocker_reason?: string | null
          order_index?: number
        }
      }
      labels: {
        Row: {
          id: string
          workspace_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          color: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          color?: string
          created_at?: string
        }
      }
      card_labels: {
        Row: {
          card_id: string
          label_id: string
        }
        Insert: {
          card_id: string
          label_id: string
        }
        Update: {
          card_id?: string
          label_id?: string
        }
      }
      subtasks: {
        Row: {
          id: string
          card_id: string
          title: string
          completed: boolean
          order_index: number
          created_at: string
        }
        Insert: {
          id?: string
          card_id: string
          title: string
          completed?: boolean
          order_index: number
          created_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          title?: string
          completed?: boolean
          order_index?: number
          created_at?: string
        }
      }
      dependencies: {
        Row: {
          id: string
          blocker_id: string
          blocked_id: string
          created_at: string
        }
        Insert: {
          id?: string
          blocker_id: string
          blocked_id: string
          created_at?: string
        }
        Update: {
          id?: string
          blocker_id?: string
          blocked_id?: string
          created_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          card_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          card_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          card_id: string | null
          user_id: string | null
          action: string
          old_value: Json | null
          new_value: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          card_id?: string | null
          user_id?: string | null
          action: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          card_id?: string | null
          user_id?: string | null
          action?: string
          old_value?: Json | null
          new_value?: Json | null
          created_at?: string
        }
      }
      sprints: {
        Row: {
          id: string
          board_id: string
          name: string
          start_date: string | null
          end_date: string | null
          status: 'planned' | 'active' | 'completed'
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          start_date?: string | null
          end_date?: string | null
          status?: 'planned' | 'active' | 'completed'
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          start_date?: string | null
          end_date?: string | null
          status?: 'planned' | 'active' | 'completed'
          created_at?: string
        }
      }
      ai_operations: {
        Row: {
          id: string
          user_id: string
          workspace_id: string | null
          operation: string
          kb_token_cost: number
          request_metadata: Json | null
          result_status: 'success' | 'failed' | 'partial'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id?: string | null
          operation: string
          kb_token_cost: number
          request_metadata?: Json | null
          result_status?: 'success' | 'failed' | 'partial'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string | null
          operation?: string
          kb_token_cost?: number
          request_metadata?: Json | null
          result_status?: 'success' | 'failed' | 'partial'
          created_at?: string
        }
      }
      kb_token_transactions: {
        Row: {
          id: string
          user_id: string
          workspace_id: string | null
          amount: number
          operation: string
          balance_after: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id?: string | null
          amount: number
          operation: string
          balance_after: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string | null
          amount?: number
          operation?: string
          balance_after?: number
          created_at?: string
        }
      }
      ai_insights: {
        Row: {
          id: string
          workspace_id: string
          board_id: string | null
          category: string
          title: string
          explanation: string | null
          evidence: Json | null
          recommended_action: string | null
          severity: 'low' | 'medium' | 'high' | 'critical'
          dismissed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          board_id?: string | null
          category: string
          title: string
          explanation?: string | null
          evidence?: Json | null
          recommended_action?: string | null
          severity?: 'low' | 'medium' | 'high' | 'critical'
          dismissed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          board_id?: string | null
          category?: string
          title?: string
          explanation?: string | null
          evidence?: Json | null
          recommended_action?: string | null
          severity?: 'low' | 'medium' | 'high' | 'critical'
          dismissed?: boolean
          created_at?: string
        }
      }
    }
  }
}

/**
 * Database Utilities
 * CLAUDE.md 준수: 타입 안전성, 비용 안전, $300 사건 방지
 */

import { supabaseClient } from '@/shared/api/supabase-client';

/**
 * Database operations for prompts
 */
export const db = {
  /**
   * Get prompt by ID
   */
  async getPrompt(id: string) {
    const { data, error } = await supabaseClient.raw
      .from('prompts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Failed to get prompt: ${error.message}`);
    }

    return data;
  },

  /**
   * Create new prompt
   */
  async createPrompt(prompt: any) {
    const { data, error } = await supabaseClient.raw
      .from('prompts')
      .insert(prompt)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create prompt: ${error.message}`);
    }

    return data;
  },

  /**
   * Update prompt
   */
  async updatePrompt(id: string, updates: any) {
    const { data, error } = await supabaseClient.raw
      .from('prompts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update prompt: ${error.message}`);
    }

    return data;
  },

  /**
   * Delete prompt
   */
  async deletePrompt(id: string) {
    const { error } = await supabaseClient.raw
      .from('prompts')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete prompt: ${error.message}`);
    }

    return true;
  },

  /**
   * Get prompts list with pagination
   */
  async getPrompts(options: {
    limit?: number;
    offset?: number;
    userId?: string;
  } = {}) {
    const { limit = 10, offset = 0, userId } = options;

    let query = supabaseClient.raw
      .from('prompts')
      .select('*', { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to get prompts: ${error.message}`);
    }

    return {
      data: data || [],
      count: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  },
};

export default db;
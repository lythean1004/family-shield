/**
 * Supabase 클라이언트 (스킬 서버용)
 *
 * Service Role Key로 연결하므로 RLS를 우회한다. 서버 전용.
 */
import { createClient } from '@supabase/supabase-js'

let supabaseClient = null

/**
 * @param {{ url: string|null, serviceRoleKey: string|null }} config
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient(config) {
  if (!config.url || !config.serviceRoleKey) {
    return null
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false },
    })
  }

  return supabaseClient
}

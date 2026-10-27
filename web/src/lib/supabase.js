import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase 환경 변수가 설정되지 않았습니다. web/.env.local을 확인하세요.\n' +
    'VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY가 필요합니다.\n' +
    '테스트 환경에서는 localStorage 폴백을 사용합니다.'
  )
}

// 환경 변수가 없으면 더미 클라이언트 (테스트용)
const dummyUrl = 'http://localhost:54321'
const dummyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZXYiLCJyb2xlIjoiYW5vbiJ9.fake'

export const supabase = createClient(
  supabaseUrl || dummyUrl,
  supabaseAnonKey || dummyKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
)

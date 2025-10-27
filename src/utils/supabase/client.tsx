import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { projectId, publicAnonKey } from './info'

const supabaseUrl = `https://${projectId}.supabase.co`

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null

export function createClient() {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient(supabaseUrl, publicAnonKey)
  }
  return supabaseClient
}

export const API_URL = `${supabaseUrl}/functions/v1/make-server-882c4243`

interface ApiCallOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiCall(endpoint: string, options: ApiCallOptions = {}) {
  const { skipAuth, ...fetchOptions } = options
  
  let authToken = publicAnonKey
  
  if (!skipAuth) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    authToken = session?.access_token || publicAnonKey
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    ...fetchOptions.headers,
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    })

    const data = await response.json()
    
    // Debug logging for dashboard endpoint
    if (endpoint === '/dashboard') {
      console.log('🔍 RAW API Response for /dashboard:', data)
      console.log('🔍 thisMonthIncome type:', typeof data.thisMonthIncome, '| value:', data.thisMonthIncome)
      console.log('🔍 thisMonthExpense type:', typeof data.thisMonthExpense, '| value:', data.thisMonthExpense)
      console.log('🔍 thisMonthProfit type:', typeof data.thisMonthProfit, '| value:', data.thisMonthProfit)
    }
    
    if (!response.ok) {
      console.error(`API Error at ${endpoint}:`, data.error)
      throw new Error(data.error || 'API request failed')
    }

    return data
  } catch (error) {
    if (error instanceof Error && error.message.includes('fetch')) {
      console.error(`Network error calling ${endpoint}. The server might not be running yet. Error:`, error.message)
      throw new Error('Sunucuya bağlanılamadı. Lütfen sayfayı yenileyin veya birkaç saniye bekleyin.')
    }
    throw error
  }
}

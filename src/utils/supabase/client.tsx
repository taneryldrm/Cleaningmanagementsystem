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

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function apiCall(endpoint: string, options: ApiCallOptions = {}, retries = 3) {
  const { skipAuth, ...fetchOptions } = options
  
  let authToken = publicAnonKey
  
  if (!skipAuth) {
    const supabase = createClient()
    
    // Try to refresh session if it exists
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('Session error:', sessionError)
    }
    
    // If no session or session expired, try to refresh
    if (!session || sessionError) {
      console.log('🔄 No active session or session error, attempting to refresh...')
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
      
      if (refreshError) {
        console.error('Session refresh failed:', refreshError)
        // Redirect to login
        window.location.reload()
        throw new Error('Session expired. Please login again.')
      }
      
      authToken = refreshedSession?.access_token || publicAnonKey
    } else {
      authToken = session.access_token
    }
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    ...fetchOptions.headers,
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`🔄 API Call attempt ${attempt + 1}/${retries} to ${endpoint}`)
      
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
        // Handle 401 Unauthorized - redirect to login
        if (response.status === 401) {
          console.error('❌ Unauthorized - Session expired, redirecting to login...')
          const supabase = createClient()
          await supabase.auth.signOut()
          window.location.reload()
          throw new Error('Session expired. Please login again.')
        }
        
        console.error(`❌ API Error at ${endpoint} (${response.status}):`, data.error)
        throw new Error(data.error || `API request failed with status ${response.status}`)
      }

      console.log(`✅ API Call successful to ${endpoint}`)
      return data
    } catch (error) {
      const isLastAttempt = attempt === retries - 1
      
      if (error instanceof Error && (error.message.includes('fetch') || error.name === 'TypeError')) {
        if (isLastAttempt) {
          console.error(`❌ Network error calling ${endpoint} after ${retries} attempts. Error:`, error.message)
          throw new Error('Sunucu bağlantısı kurulamadı. Lütfen sayfayı yenileyin ve tekrar deneyin. Sorun devam ederse birkaç saniye bekleyin.')
        } else {
          // Wait before retry (exponential backoff: 2s, 4s, 8s)
          const waitTime = 2000 * Math.pow(2, attempt)
          console.log(`⏳ Retrying ${endpoint} in ${waitTime}ms... (attempt ${attempt + 1}/${retries})`)
          await delay(waitTime)
          continue
        }
      }
      
      // For non-network errors, don't retry
      throw error
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw new Error('Unexpected error in apiCall')
}
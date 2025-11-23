import { createClient } from 'jsr:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

/**
 * Get all records by prefix without limit restriction
 * Uses pagination to fetch all records beyond Supabase's default 1000 limit
 */
export async function getAllByPrefix(prefix: string): Promise<any[]> {
  const allData: any[] = []
  let hasMore = true
  let offset = 0
  const pageSize = 1000

  while (hasMore) {
    const { data, error } = await supabase
      .from('kv_store_882c4243')
      .select('key, value')
      .like('key', prefix + '%')
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Error fetching data with prefix ${prefix}: ${error.message}`)
    }

    if (data && data.length > 0) {
      allData.push(...data.map((d) => d.value))
      offset += pageSize
      
      // If we got less than pageSize, we've reached the end
      if (data.length < pageSize) {
        hasMore = false
      }
    } else {
      hasMore = false
    }
  }

  console.log(`✅ Fetched ${allData.length} records with prefix: ${prefix}`)
  return allData
}

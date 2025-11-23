import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as kv from './kv_store.tsx'
import { getAllByPrefix } from './helpers.tsx'

const app = new Hono()

app.use('*', cors())
app.use('*', logger(console.log))

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Helper function to verify auth and get user
async function getAuthUser(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1]
  if (!accessToken) {
    return null
  }
  
  const { data: { user }, error } = await supabase.auth.getUser(accessToken)
  if (error || !user) {
    return null
  }
  
  return user
}

// ============================
// HEALTH CHECK
// ============================

app.get('/make-server-882c4243/health', async (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ============================
// AUTH & USER ROUTES
// ============================

// Check if system needs initial setup (no auth required)
app.get('/make-server-882c4243/check-setup', async (c) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.log('Error checking setup status:', error)
      return c.json({ error: error.message }, 400)
    }

    return c.json({ needsSetup: data.users.length === 0 })
  } catch (error) {
    console.log('Server error checking setup:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Create new user with role
app.post('/make-server-882c4243/signup', async (c) => {
  try {
    const body = await c.req.json()
    const { email, password, name, role, permissions } = body

    if (!email || !password || !name || !role) {
      return c.json({ error: 'Email, password, name, and role are required' }, 400)
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name, 
        role,
        permissions: permissions || {},
        createdAt: new Date().toISOString()
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    })

    if (error) {
      console.log('Error creating user during signup:', error)
      return c.json({ error: error.message }, 400)
    }

    return c.json({ success: true, user: data.user })
  } catch (error) {
    console.log('Server error during signup:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Get all users (admin only)
app.get('/make-server-882c4243/users', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    const { data, error } = await supabase.auth.admin.listUsers()
    
    if (error) {
      console.log('Error fetching users:', error)
      return c.json({ error: error.message }, 400)
    }

    const users = data.users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.user_metadata?.name,
      role: u.user_metadata?.role,
      permissions: u.user_metadata?.permissions,
      createdAt: u.user_metadata?.createdAt
    }))

    return c.json({ users })
  } catch (error) {
    console.log('Server error fetching users:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Update user (admin only)
app.put('/make-server-882c4243/users/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    const userId = c.req.param('id')
    const body = await c.req.json()
    const { name, role, permissions } = body

    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { name, role, permissions }
    })

    if (error) {
      console.log('Error updating user:', error)
      return c.json({ error: error.message }, 400)
    }

    return c.json({ success: true, user: data.user })
  } catch (error) {
    console.log('Server error updating user:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// CUSTOMER ROUTES
// ============================

app.get('/make-server-882c4243/customers', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Use getAllByPrefix to bypass 1000 record limit
    const customers = await getAllByPrefix('customer:')
    return c.json({ customers })
  } catch (error) {
    console.log('Server error fetching customers:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.post('/make-server-882c4243/customers', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can create customers' }, 403)
    }

    const body = await c.req.json()
    const { name, type, contactInfo, address, addresses, notes } = body

    if (!name) {
      return c.json({ error: 'Customer name is required' }, 400)
    }

    const customerId = `customer:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const customer = {
      id: customerId,
      name,
      type: type || 'normal', // regular, problematic, normal
      contactInfo: contactInfo || {},
      address: address || '',
      addresses: addresses || [],
      notes: notes || '',
      paymentHistory: [],
      balance: 0,
      createdAt: new Date().toISOString(),
      createdBy: user.id
    }

    await kv.set(customerId, customer)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'customer_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      customerId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, customer })
  } catch (error) {
    console.log('Server error creating customer:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.put('/make-server-882c4243/customers/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can update customers' }, 403)
    }

    const customerId = c.req.param('id')
    const body = await c.req.json()

    const existing = await kv.get(customerId)
    if (!existing) {
      return c.json({ error: 'Customer not found' }, 404)
    }

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
    await kv.set(customerId, updated)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'customer_updated',
      userId: user.id,
      userName: user.user_metadata?.name,
      customerId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, customer: updated })
  } catch (error) {
    console.log('Server error updating customer:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.delete('/make-server-882c4243/customers/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    const customerId = c.req.param('id')
    await kv.del(customerId)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'customer_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      customerId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting customer:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// PERSONNEL ROUTES
// ============================

app.get('/make-server-882c4243/personnel', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Use getAllByPrefix to bypass 1000 record limit
    const personnel = await getAllByPrefix('personnel:')
    
    // Get all payroll records to calculate total balance for each personnel
    const allPayrollRecords = await getAllByPrefix('payroll:')
    
    // Calculate total balance for each personnel
    const personnelBalances: Record<string, number> = {}
    allPayrollRecords.forEach((record: any) => {
      const personnelId = record.personnelId
      if (personnelId) {
        if (!personnelBalances[personnelId]) {
          personnelBalances[personnelId] = 0
        }
        personnelBalances[personnelId] += (record.balance || 0)
      }
    })
    
    // Add balance to each personnel record
    const personnelWithBalances = personnel.map((p: any) => ({
      ...p,
      totalBalance: personnelBalances[p.id] || 0
    }))
    
    return c.json({ personnel: personnelWithBalances })
  } catch (error) {
    console.log('Server error fetching personnel:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.post('/make-server-882c4243/personnel', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can create personnel' }, 403)
    }

    const body = await c.req.json()
    const { name, role: personnelRole, contactInfo, notes, tcNo } = body

    if (!name) {
      return c.json({ error: 'Personnel name is required' }, 400)
    }

    const personnelId = `personnel:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const personnel = {
      id: personnelId,
      name,
      role: personnelRole || 'cleaner',
      contactInfo: contactInfo || {},
      notes: notes || '',
      tcNo: tcNo || '',
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: user.id
    }

    await kv.set(personnelId, personnel)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'personnel_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      personnelId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, personnel })
  } catch (error) {
    console.log('Server error creating personnel:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.put('/make-server-882c4243/personnel/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can update personnel' }, 403)
    }

    const personnelId = c.req.param('id')
    const body = await c.req.json()

    const existing = await kv.get(personnelId)
    if (!existing) {
      return c.json({ error: 'Personnel not found' }, 404)
    }

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
    await kv.set(personnelId, updated)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'personnel_updated',
      userId: user.id,
      userName: user.user_metadata?.name,
      personnelId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, personnel: updated })
  } catch (error) {
    console.log('Server error updating personnel:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.delete('/make-server-882c4243/personnel/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    const personnelId = c.req.param('id')
    
    // Delete the personnel record
    await kv.del(personnelId)
    
    // Delete all payroll records for this personnel
    const allPayrollRecords = await getAllByPrefix('payroll:')
    const personnelPayrollRecords = allPayrollRecords.filter((record: any) => 
      record.personnelId === personnelId
    )
    
    // Delete each payroll record
    for (const record of personnelPayrollRecords) {
      await kv.del(record.id)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'personnel_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      personnelId,
      payrollRecordsDeleted: personnelPayrollRecords.length,
      timestamp: new Date().toISOString()
    })

    return c.json({ 
      success: true, 
      payrollRecordsDeleted: personnelPayrollRecords.length 
    })
  } catch (error) {
    console.log('Server error deleting personnel:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Clean orphaned payroll records (for deleted personnel)
app.post('/make-server-882c4243/personnel/cleanup-payroll', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    // Get all personnel and payroll records
    const allPersonnel = await getAllByPrefix('personnel:')
    const personnelIds = new Set(allPersonnel.map((p: any) => p.id))
    const allPayrollRecords = await getAllByPrefix('payroll:')
    
    // Find orphaned payroll records
    const orphanedRecords = allPayrollRecords.filter((record: any) => 
      record.personnelId && !personnelIds.has(record.personnelId)
    )
    
    // Delete orphaned records
    for (const record of orphanedRecords) {
      await kv.del(record.id)
    }

    console.log(`Cleaned ${orphanedRecords.length} orphaned payroll records`)

    return c.json({ 
      success: true,
      deletedCount: orphanedRecords.length,
      message: `${orphanedRecords.length} yetim yevmiye kaydı temizlendi`
    })
  } catch (error) {
    console.log('Server error cleaning payroll records:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Get personnel work history
app.get('/make-server-882c4243/personnel/:id/history', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const personnelId = c.req.param('id')
    
    // Get all work orders where this personnel was assigned
    const allWorkOrders = await getAllByPrefix('workorder:')
    const personnelWorkOrders = allWorkOrders.filter((wo: any) => 
      wo.personnelIds && wo.personnelIds.includes(personnelId)
    )

    // Get customer names for each work order
    const customers = await getAllByPrefix('customer:')
    const customerMap = customers.reduce((acc: any, customer: any) => {
      acc[customer.id] = customer.name
      return acc
    }, {})

    // Enrich work orders with customer names
    const history = personnelWorkOrders
      .map((wo: any) => ({
        id: wo.id,
        customerName: customerMap[wo.customerId] || 'Bilinmiyor',
        date: wo.date,
        description: wo.description,
        totalAmount: wo.totalAmount,
        paidAmount: wo.paidAmount,
        status: wo.status,
        approvedAt: wo.approvedAt,
        completedAt: wo.completedAt
      }))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return c.json({ history })
  } catch (error) {
    console.log('Server error fetching personnel history:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// WORK ORDER ROUTES
// ============================

// Helper function to auto-approve draft work orders scheduled for today
async function autoApproveTodayWorkOrders() {
  try {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayStr = today.toISOString().split('T')[0]
    
    // Use getAllByPrefix to bypass 1000 record limit
    const workOrders = await getAllByPrefix('workorder:')
    // Filter draft work orders scheduled for today (date is today or earlier and not yet approved)
    const draftsToApprove = workOrders.filter((wo: any) => {
      if (wo.status !== 'draft') return false
      const woDate = wo.date?.split('T')[0]
      return woDate && woDate <= todayStr
    })
    
    let approvedCount = 0
    for (const draft of draftsToApprove) {
      const updated = {
        ...draft,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        autoApproved: true
      }
      await kv.set(draft.id, updated)
      
      // If has paidAmount, create income transaction and collection record
      if (draft.paidAmount > 0) {
        // Get customer name
        const customer = await kv.get(draft.customerId)
        const customerName = customer?.name || 'Bilinmiyor'

        // Create income transaction
        const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const transaction = {
          id: transactionId,
          type: 'income',
          amount: draft.paidAmount,
          date: draft.date,
          category: 'İş Emri Tahsilatı',
          description: `İş emri (Otomatik Onay): ${draft.description || 'Temizlik hizmeti'}`,
          relatedCustomerId: draft.customerId,
          relatedWorkOrderId: draft.id,
          createdAt: new Date().toISOString(),
          createdBy: draft.createdBy,
          createdByName: draft.createdByName
        }
        await kv.set(transactionId, transaction)

        // Create collection record for daily cash flow
        const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const collection = {
          id: collectionId,
          customerId: draft.customerId,
          customerName: customerName,
          amount: draft.paidAmount,
          date: draft.date,
          workDate: draft.date,
          description: draft.description || 'İş emri tahsilatı (Otomatik Onay)',
          relatedWorkOrderId: draft.id,
          createdAt: new Date().toISOString(),
          createdBy: draft.createdBy,
          createdByName: draft.createdByName
        }
        await kv.set(collectionId, collection)
      }
      
      approvedCount++
      
      // Small delay to ensure unique IDs
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    if (approvedCount > 0) {
      console.log(`Auto-approved ${approvedCount} work orders scheduled for today or earlier`)
    }
    return approvedCount
  } catch (error) {
    console.log('Error during auto-approval:', error)
    return 0
  }
}

app.get('/make-server-882c4243/work-orders', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Auto-approve work orders scheduled for today or earlier (runs in background)
    autoApproveTodayWorkOrders().catch(err => 
      console.log('Background auto-approve error:', err)
    )

    // Use getAllByPrefix to bypass 1000 record limit
    const workOrders = await getAllByPrefix('workorder:')
    
    // Filter based on role
    const role = user.user_metadata?.role
    let filtered = workOrders

    if (role === 'cleaner') {
      // Cleaners only see their own work orders
      filtered = workOrders.filter((wo: any) => 
        wo.personnelIds && wo.personnelIds.includes(user.id)
      )
    }

    return c.json({ workOrders: filtered })
  } catch (error) {
    console.log('Server error fetching work orders:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.post('/make-server-882c4243/work-orders', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can create work orders' }, 403)
    }

    const body = await c.req.json()
    const { customerId, personnelIds, date, description, totalAmount, paidAmount, autoApprove, customerAddress } = body

    if (!customerId || !date) {
      return c.json({ error: 'Customer and date are required' }, 400)
    }

    const workOrderId = `workorder:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Get customer name to store in the record for searching
    const customer = await kv.get(customerId)
    const customerName = customer?.name || 'Bilinmiyor'
    // Use provided customerAddress or fallback to customer's default address
    const workOrderAddress = customerAddress || customer?.address || ''
    
    const workOrder = {
      id: workOrderId,
      customerId,
      customerName,
      customerAddress: workOrderAddress,
      personnelIds: personnelIds || [],
      date,
      description: description || '',
      totalAmount: totalAmount || 0,
      paidAmount: paidAmount || 0,
      status: autoApprove ? 'approved' : 'draft',
      approvedAt: autoApprove ? new Date().toISOString() : null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }

    await kv.set(workOrderId, workOrder)

    // If has paidAmount, create income transaction and collection record
    if (paidAmount > 0) {

      // Use the work order's date as the collection date
      const collectionDate = date

      // Create income transaction
      const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const transaction = {
        id: transactionId,
        type: 'income',
        amount: paidAmount,
        date: collectionDate,
        category: 'İş Emri Tahsilatı',
        description: `İş emri: ${description || 'Temizlik hizmeti'}`,
        relatedCustomerId: customerId,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(transactionId, transaction)

      // Create collection record for daily cash flow
      const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const collection = {
        id: collectionId,
        customerId: customerId,
        customerName: customerName,
        amount: paidAmount,
        date: collectionDate,
        description: description || 'İş emri tahsilatı',
        workDate: date,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(collectionId, collection)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'workorder_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      workOrderId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, workOrder })
  } catch (error) {
    console.log('Server error creating work order:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.put('/make-server-882c4243/work-orders/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const workOrderId = c.req.param('id')
    const body = await c.req.json()

    const existing = await kv.get(workOrderId)
    if (!existing) {
      return c.json({ error: 'Work order not found' }, 404)
    }

    const updated = { ...existing, ...body, updatedAt: new Date().toISOString() }
    await kv.set(workOrderId, updated)

    // If status changed to approved and has paidAmount, create income transaction and collection record
    if (body.status === 'approved' && existing.status !== 'approved' && existing.paidAmount > 0) {
      // Get customer name
      const customer = await kv.get(existing.customerId)
      const customerName = customer?.name || 'Bilinmiyor'

      // Use the work order's date as the collection date
      const collectionDate = existing.date

      // Create income transaction
      const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const transaction = {
        id: transactionId,
        type: 'income',
        amount: existing.paidAmount,
        date: collectionDate,
        category: 'İş Emri Tahsilatı',
        description: `İş emri: ${existing.description || 'Temizlik hizmeti'}`,
        relatedCustomerId: existing.customerId,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(transactionId, transaction)

      // Create collection record for daily cash flow
      const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const collection = {
        id: collectionId,
        customerId: existing.customerId,
        customerName: customerName,
        amount: existing.paidAmount,
        date: collectionDate,
        description: existing.description || 'İş emri tahsilatı',
        workDate: existing.date,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(collectionId, collection)
    }

    // If status changed to completed and paidAmount increased, create income transaction and collection record for the difference
    if (body.status === 'completed' && body.paidAmount && body.paidAmount > (existing.paidAmount || 0)) {
      const paymentDifference = body.paidAmount - (existing.paidAmount || 0)
      
      // Get customer name
      const customer = await kv.get(existing.customerId)
      const customerName = customer?.name || 'Bilinmiyor'

      // Use the work order's date as the collection date
      const collectionDate = existing.date

      // Create income transaction for the additional payment
      const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const transaction = {
        id: transactionId,
        type: 'income',
        amount: paymentDifference,
        date: collectionDate,
        category: 'İş Emri Tamamlanma Tahsilatı',
        description: `İş tamamlandı: ${existing.description || 'Temizlik hizmeti'}`,
        relatedCustomerId: existing.customerId,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(transactionId, transaction)

      // Create collection record for daily cash flow
      const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const collection = {
        id: collectionId,
        customerId: existing.customerId,
        customerName: customerName,
        amount: paymentDifference,
        date: collectionDate,
        description: `İş tamamlandı: ${existing.description || 'Temizlik hizmeti'}`,
        workDate: existing.date,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(collectionId, collection)
    }

    // If paidAmount increased (and not already handled by status change to completed), create collection record for the difference
    if (body.paidAmount && body.paidAmount > (existing.paidAmount || 0) && body.status !== 'completed') {
      const paymentDifference = body.paidAmount - (existing.paidAmount || 0)
      
      // Get customer name
      const customer = await kv.get(existing.customerId)
      const customerName = customer?.name || 'Bilinmiyor'

      // Use the work order's date as the collection date
      const collectionDate = existing.date

      // Create income transaction for the additional payment
      const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const transaction = {
        id: transactionId,
        type: 'income',
        amount: paymentDifference,
        date: collectionDate,
        category: 'İş Emri Ek Tahsilatı',
        description: `Ek ödeme: ${existing.description || 'Temizlik hizmeti'}`,
        relatedCustomerId: existing.customerId,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(transactionId, transaction)

      // Create collection record for daily cash flow
      const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const collection = {
        id: collectionId,
        customerId: existing.customerId,
        customerName: customerName,
        amount: paymentDifference,
        date: collectionDate,
        description: `Ek ödeme: ${existing.description || 'İş emri tahsilatı'}`,
        workDate: existing.date,
        relatedWorkOrderId: workOrderId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(collectionId, collection)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'workorder_updated',
      userId: user.id,
      userName: user.user_metadata?.name,
      workOrderId,
      changes: body,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, workOrder: updated })
  } catch (error) {
    console.log('Server error updating work order:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Delete work order (admin only, approved or completed status only)
app.delete('/make-server-882c4243/work-orders/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin') {
      return c.json({ error: 'Only admin can delete work orders' }, 403)
    }

    const workOrderId = c.req.param('id')
    const existing = await kv.get(workOrderId)
    
    if (!existing) {
      return c.json({ error: 'Work order not found' }, 404)
    }

    // Check if work order status is approved or completed
    if (existing.status !== 'approved' && existing.status !== 'completed') {
      return c.json({ error: 'Only approved or completed work orders can be deleted' }, 400)
    }

    await kv.del(workOrderId)

    // Delete related transactions and collections
    const allTransactions = await getAllByPrefix('transaction:')
    const relatedTransactions = allTransactions.filter((t: any) => t.relatedWorkOrderId === workOrderId)
    for (const transaction of relatedTransactions) {
      await kv.del(transaction.id)
    }

    const allCollections = await getAllByPrefix('collection:')
    const relatedCollections = allCollections.filter((c: any) => c.relatedWorkOrderId === workOrderId)
    for (const collection of relatedCollections) {
      await kv.del(collection.id)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'workorder_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      workOrderId,
      workOrderData: existing,
      deletedTransactions: relatedTransactions.length,
      deletedCollections: relatedCollections.length,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting work order:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Delete ALL work orders (admin only) - DANGEROUS!
app.post('/make-server-882c4243/work-orders/delete-all', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    console.log('🗑️ Starting DELETE ALL work orders...')

    // Get all work orders, transactions, and collections
    const [allWorkOrders, allTransactions, allCollections] = await Promise.all([
      getAllByPrefix('workorder:'),
      getAllByPrefix('transaction:'),
      getAllByPrefix('collection:')
    ])
    
    console.log(`📋 Found:`, {
      workOrders: allWorkOrders.length,
      transactions: allTransactions.length,
      collections: allCollections.length
    })

    // Collect IDs to delete
    const workOrderIds = allWorkOrders.map((wo: any) => wo.id)
    const transactionIds = allTransactions
      .filter((t: any) => t.relatedWorkOrderId)
      .map((t: any) => t.id)
    const collectionIds = allCollections
      .filter((c: any) => c.relatedWorkOrderId)
      .map((c: any) => c.id)

    // Batch delete in chunks
    const CHUNK_SIZE = 100
    
    if (workOrderIds.length > 0) {
      const chunks = Math.ceil(workOrderIds.length / CHUNK_SIZE)
      console.log(`Deleting ${workOrderIds.length} work orders in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, workOrderIds.length)
        const chunk = workOrderIds.slice(start, end)
        await kv.mdel(chunk)
        console.log(`Chunk ${i + 1}/${chunks}: Deleted ${chunk.length} work orders`)
      }
    }

    if (transactionIds.length > 0) {
      const chunks = Math.ceil(transactionIds.length / CHUNK_SIZE)
      console.log(`Deleting ${transactionIds.length} transactions in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, transactionIds.length)
        const chunk = transactionIds.slice(start, end)
        await kv.mdel(chunk)
        console.log(`Chunk ${i + 1}/${chunks}: Deleted ${chunk.length} transactions`)
      }
    }

    if (collectionIds.length > 0) {
      const chunks = Math.ceil(collectionIds.length / CHUNK_SIZE)
      console.log(`Deleting ${collectionIds.length} collections in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, collectionIds.length)
        const chunk = collectionIds.slice(start, end)
        await kv.mdel(chunk)
        console.log(`Chunk ${i + 1}/${chunks}: Deleted ${chunk.length} collections`)
      }
    }

    console.log(`✅ DELETE ALL completed`)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'workorders_deleted_all',
      userId: user.id,
      userName: user.user_metadata?.name,
      deletedWorkOrders: workOrderIds.length,
      deletedTransactions: transactionIds.length,
      deletedCollections: collectionIds.length,
      timestamp: new Date().toISOString()
    })

    return c.json({ 
      success: true,
      deletedWorkOrders: workOrderIds.length,
      deletedTransactions: transactionIds.length,
      deletedCollections: collectionIds.length,
      message: `${workOrderIds.length} iş emri, ${transactionIds.length} işlem ve ${collectionIds.length} tahsilat kaydı silindi`
    })
  } catch (error) {
    console.log('Server error deleting all work orders:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Clean duplicate work orders (admin only)
app.post('/make-server-882c4243/work-orders/cleanup-duplicates', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    console.log('🧹 Starting duplicate work order cleanup...')

    // Get all work orders, transactions, and collections ONCE (optimization)
    const [allWorkOrders, allTransactions, allCollections] = await Promise.all([
      getAllByPrefix('workorder:'),
      getAllByPrefix('transaction:'),
      getAllByPrefix('collection:')
    ])
    
    console.log(`📋 Found ${allWorkOrders.length} work orders`)

    // Group by customer + date + totalAmount
    const groups = new Map<string, any[]>()
    
    allWorkOrders.forEach((wo: any) => {
      const key = `${wo.customerId}_${wo.date}_${wo.totalAmount}`
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(wo)
    })

    // Find duplicate groups (more than 1 work order with same key)
    const duplicateGroups = Array.from(groups.entries())
      .filter(([_, workOrders]) => workOrders.length > 1)

    console.log(`🔍 Found ${duplicateGroups.length} duplicate groups`)

    let deletedCount = 0
    let deletedTransactionsCount = 0
    let deletedCollectionsCount = 0
    const deletedWorkOrders: any[] = []
    const idsToDelete: string[] = []
    const transactionsToDelete: string[] = []
    const collectionsToDelete: string[] = []

    // Collect all IDs to delete first
    for (const [key, workOrders] of duplicateGroups) {
      // Sort by createdAt to keep the oldest one
      workOrders.sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )

      // Keep the first, delete the rest
      const toDelete = workOrders.slice(1)
      
      for (const wo of toDelete) {
        idsToDelete.push(wo.id)
        deletedWorkOrders.push({
          id: wo.id,
          customerName: wo.customerName,
          date: wo.date,
          totalAmount: wo.totalAmount
        })

        // Find related transactions
        const relatedTransactions = allTransactions.filter((t: any) => 
          t.relatedWorkOrderId === wo.id
        )
        relatedTransactions.forEach(t => transactionsToDelete.push(t.id))

        // Find related collections
        const relatedCollections = allCollections.filter((c: any) => 
          c.relatedWorkOrderId === wo.id
        )
        relatedCollections.forEach(c => collectionsToDelete.push(c.id))
      }
    }

    // Batch delete using mdel in chunks to avoid timeout
    const CHUNK_SIZE = 100 // Delete 100 records at a time
    
    if (idsToDelete.length > 0) {
      const chunks = Math.ceil(idsToDelete.length / CHUNK_SIZE)
      console.log(`Deleting ${idsToDelete.length} work orders in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, idsToDelete.length)
        const chunk = idsToDelete.slice(start, end)
        await kv.mdel(chunk)
        console.log(`Chunk ${i + 1}/${chunks}: Deleted ${chunk.length} work orders`)
      }
      deletedCount = idsToDelete.length
    }

    if (transactionsToDelete.length > 0) {
      const chunks = Math.ceil(transactionsToDelete.length / CHUNK_SIZE)
      console.log(`Deleting ${transactionsToDelete.length} transactions in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, transactionsToDelete.length)
        const chunk = transactionsToDelete.slice(start, end)
        await kv.mdel(chunk)
        console.log(`Chunk ${i + 1}/${chunks}: Deleted ${chunk.length} transactions`)
      }
      deletedTransactionsCount = transactionsToDelete.length
    }

    if (collectionsToDelete.length > 0) {
      const chunks = Math.ceil(collectionsToDelete.length / CHUNK_SIZE)
      console.log(`Deleting ${collectionsToDelete.length} collections in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, collectionsToDelete.length)
        const chunk = collectionsToDelete.slice(start, end)
        await kv.mdel(chunk)
        console.log(`Chunk ${i + 1}/${chunks}: Deleted ${chunk.length} collections`)
      }
      deletedCollectionsCount = collectionsToDelete.length
    }

    console.log(`✅ Cleanup complete: ${deletedCount} duplicates removed`)

    // Log the cleanup action
    await kv.set(`log:${Date.now()}`, {
      action: 'workorder_duplicates_cleaned',
      userId: user.id,
      userName: user.user_metadata?.name,
      deletedWorkOrders: deletedCount,
      deletedTransactions: deletedTransactionsCount,
      deletedCollections: deletedCollectionsCount,
      details: deletedWorkOrders,
      timestamp: new Date().toISOString()
    })

    return c.json({ 
      success: true,
      deletedWorkOrders: deletedCount,
      deletedTransactions: deletedTransactionsCount,
      deletedCollections: deletedCollectionsCount,
      details: deletedWorkOrders,
      message: `${deletedCount} duplicate iş emri ve ilgili ${deletedTransactionsCount} işlem + ${deletedCollectionsCount} tahsilat kaydı silindi`
    })
  } catch (error) {
    console.log('Server error cleaning duplicate work orders:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Create recurring work orders
app.post('/make-server-882c4243/work-orders/recurring', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can create recurring work orders' }, 403)
    }

    const body = await c.req.json()
    const { 
      customerId, 
      personnelIds, 
      startDate, 
      description, 
      totalAmount, 
      paidAmount, 
      autoApprove,
      customerAddress,
      recurrenceType, // 'weekly' | 'biweekly' | 'monthly-date' | 'monthly-weekday'
      recurrenceDay, // 0-6 for weekly/biweekly (Sunday-Saturday)
      recurrenceDate, // 1-31 for monthly-date
      recurrenceWeek, // 1-4 for monthly-weekday (1=first, 2=second, etc.)
      recurrenceWeekday, // 0-6 for monthly-weekday
      endDate // End date for recurrence
    } = body

    if (!customerId || !startDate || !recurrenceType || !endDate) {
      return c.json({ error: 'Customer, start date, recurrence type, and end date are required' }, 400)
    }

    // Get customer info once for all work orders
    const customer = await kv.get(customerId)
    const customerName = customer?.name || 'Bilinmiyor'
    // Use provided customerAddress or fallback to customer's default address
    const workOrderAddress = customerAddress || customer?.address || ''

    // Calculate all dates based on recurrence type
    const dates: string[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Helper function to get the day of week (0-6, Sunday-Saturday)
    const getDayOfWeek = (date: Date) => date.getDay()
    
    // Helper function to get nth weekday of month
    const getNthWeekdayOfMonth = (year: number, month: number, weekday: number, n: number) => {
      const firstDay = new Date(year, month, 1)
      const firstWeekday = firstDay.getDay()
      let offset = (weekday - firstWeekday + 7) % 7
      const date = new Date(year, month, 1 + offset + (n - 1) * 7)
      
      // Check if this date is still in the same month
      if (date.getMonth() !== month) {
        return null
      }
      return date
    }
    
    if (recurrenceType === 'weekly') {
      let current = new Date(start)
      // Find the first occurrence of the specified day
      while (getDayOfWeek(current) !== recurrenceDay && current <= end) {
        current.setDate(current.getDate() + 1)
      }
      
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 7)
      }
    } else if (recurrenceType === 'biweekly') {
      let current = new Date(start)
      // Find the first occurrence of the specified day
      while (getDayOfWeek(current) !== recurrenceDay && current <= end) {
        current.setDate(current.getDate() + 1)
      }
      
      while (current <= end) {
        dates.push(current.toISOString().split('T')[0])
        current.setDate(current.getDate() + 14)
      }
    } else if (recurrenceType === 'monthly-date') {
      let current = new Date(start.getFullYear(), start.getMonth(), recurrenceDate)
      
      // If the start date is after the recurrence date this month, start next month
      if (current < start) {
        current.setMonth(current.getMonth() + 1)
      }
      
      while (current <= end) {
        // Check if this date exists in the month (e.g., Feb 30 doesn't exist)
        if (current.getDate() === recurrenceDate) {
          dates.push(current.toISOString().split('T')[0])
        }
        
        // Move to next month
        const nextMonth = current.getMonth() + 1
        const nextYear = nextMonth > 11 ? current.getFullYear() + 1 : current.getFullYear()
        current = new Date(nextYear, nextMonth % 12, recurrenceDate)
      }
    } else if (recurrenceType === 'monthly-weekday') {
      let currentMonth = start.getMonth()
      let currentYear = start.getFullYear()
      
      while (true) {
        const date = getNthWeekdayOfMonth(currentYear, currentMonth, recurrenceWeekday, recurrenceWeek)
        
        if (date && date >= start && date <= end) {
          dates.push(date.toISOString().split('T')[0])
        }
        
        if (date && date > end) {
          break
        }
        
        // Move to next month
        currentMonth++
        if (currentMonth > 11) {
          currentMonth = 0
          currentYear++
        }
        
        // Safety check to prevent infinite loop
        if (currentYear > end.getFullYear() + 1) {
          break
        }
      }
    }

    // Create work orders for all calculated dates
    const createdWorkOrders = []
    for (const date of dates) {
      const workOrderId = `workorder:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const workOrder = {
        id: workOrderId,
        customerId,
        customerName,
        customerAddress: workOrderAddress,
        personnelIds: personnelIds || [],
        date,
        description: description || '',
        totalAmount: totalAmount || 0,
        paidAmount: paidAmount || 0,
        status: autoApprove ? 'approved' : 'draft',
        approvedAt: autoApprove ? new Date().toISOString() : null,
        completedAt: null,
        isRecurring: true,
        recurrenceType,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }

      await kv.set(workOrderId, workOrder)
      createdWorkOrders.push(workOrder)

      // If auto-approved and has paidAmount, create income transaction and collection record
      if (autoApprove && paidAmount > 0) {
        const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const transaction = {
          id: transactionId,
          type: 'income',
          amount: paidAmount,
          date: date,
          category: 'İş Emri Tahsilatı',
          description: `Tekrarlayan iş emri: ${description || 'Temizlik hizmeti'}`,
          relatedCustomerId: customerId,
          relatedWorkOrderId: workOrderId,
          createdAt: new Date().toISOString(),
          createdBy: user.id,
          createdByName: user.user_metadata?.name
        }
        await kv.set(transactionId, transaction)

        const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const collection = {
          id: collectionId,
          customerId: customerId,
          customerName: customerName,
          amount: paidAmount,
          date: date,
          description: description || 'Tekrarlayan iş emri tahsilatı',
          workDate: date,
          relatedWorkOrderId: workOrderId,
          createdAt: new Date().toISOString(),
          createdBy: user.id,
          createdByName: user.user_metadata?.name
        }
        await kv.set(collectionId, collection)
      }

      // Small delay to ensure unique IDs
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'recurring_workorders_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      count: createdWorkOrders.length,
      recurrenceType,
      startDate,
      endDate,
      timestamp: new Date().toISOString()
    })

    return c.json({ 
      success: true, 
      workOrders: createdWorkOrders,
      count: createdWorkOrders.length,
      dates: dates
    })
  } catch (error) {
    console.log('Server error creating recurring work orders:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Bulk import work orders from CSV
app.post('/make-server-882c4243/work-orders/bulk', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can bulk import work orders' }, 403)
    }

    const body = await c.req.json()
    const { workOrders } = body

    if (!workOrders || !Array.isArray(workOrders) || workOrders.length === 0) {
      return c.json({ error: 'Work orders array is required' }, 400)
    }

    // Get all customers ONCE (optimization)
    const allCustomers = await getAllByPrefix('customer:')
    console.log('📊 BACKEND İÇE AKTARMA BAŞLADI:', {
      receivedCount: workOrders.length
    })

    // Create customer map for fast lookups
    const customerMap = new Map()
    allCustomers.forEach((c: any) => customerMap.set(c.id, c))

    const createdWorkOrders = []
    const keysToSet: string[] = []
    const valuesToSet: any[] = []
    let counter = 0
    
    for (const wo of workOrders) {
      const workOrderId = `workorder:${Date.now()}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
      
      // Get customer name from map
      const customer = customerMap.get(wo.customerId)
      const customerName = customer?.name || 'Bilinmiyor'

      const workOrder = {
        id: workOrderId,
        customerId: wo.customerId,
        customerName,
        customerAddress: wo.customerAddress || '',
        personnelIds: wo.personnelIds || [],
        date: wo.date,
        description: wo.description || '',
        totalAmount: wo.totalAmount || 0,
        paidAmount: wo.paidAmount || 0,
        status: wo.autoApprove ? 'approved' : 'draft',
        approvedAt: wo.autoApprove ? new Date().toISOString() : null,
        completedAt: null,
        source: wo.source || 'csv_import',
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }

      keysToSet.push(workOrderId)
      valuesToSet.push(workOrder)
      createdWorkOrders.push(workOrder)

      // If auto-approved and has paidAmount, create income transaction
      if (wo.autoApprove && wo.paidAmount > 0) {
        const transactionId = `transaction:${Date.now()}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
        const transaction = {
          id: transactionId,
          type: 'income',
          amount: wo.paidAmount,
          date: wo.date,
          category: 'İş Emri Tahsilatı',
          description: `CSV İçe Aktarımı: ${wo.description || 'Temizlik hizmeti'}`,
          relatedCustomerId: wo.customerId,
          relatedWorkOrderId: workOrderId,
          createdAt: new Date().toISOString(),
          createdBy: user.id,
          createdByName: user.user_metadata?.name
        }
        keysToSet.push(transactionId)
        valuesToSet.push(transaction)

        const collectionId = `collection:${Date.now()}_${counter++}_${Math.random().toString(36).substr(2, 9)}`
        const collection = {
          id: collectionId,
          customerId: wo.customerId,
          customerName: customerName,
          amount: wo.paidAmount,
          date: wo.date,
          description: wo.description || 'CSV içe aktarımı',
          workDate: wo.date,
          relatedWorkOrderId: workOrderId,
          createdAt: new Date().toISOString(),
          createdBy: user.id,
          createdByName: user.user_metadata?.name
        }
        keysToSet.push(collectionId)
        valuesToSet.push(collection)
      }
    }

    // Batch insert all records in chunks to avoid timeout
    if (keysToSet.length > 0) {
      const CHUNK_SIZE = 50 // Insert 50 records at a time
      const chunks = Math.ceil(keysToSet.length / CHUNK_SIZE)
      
      console.log(`Inserting ${keysToSet.length} records in ${chunks} chunks`)
      
      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE
        const end = Math.min(start + CHUNK_SIZE, keysToSet.length)
        const chunkKeys = keysToSet.slice(start, end)
        const chunkValues = valuesToSet.slice(start, end)
        
        await kv.mset(chunkKeys, chunkValues)
        console.log(`Chunk ${i + 1}/${chunks}: Inserted ${chunkKeys.length} records`)
      }
      
      console.log('✅ Batch insert completed')
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'bulk_workorders_imported',
      userId: user.id,
      userName: user.user_metadata?.name,
      count: createdWorkOrders.length,
      skipped: 0,
      timestamp: new Date().toISOString()
    })

    console.log('📊 BACKEND İÇE AKTARMA SONUÇLARI:', {
      received: workOrders.length,
      created: createdWorkOrders.length,
      skipped: 0,
      total_db_records: keysToSet.length
    })

    return c.json({ 
      success: true, 
      workOrders: createdWorkOrders,
      count: createdWorkOrders.length,
      skipped: 0
    })
  } catch (error) {
    console.log('Server error bulk importing work orders:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Cron endpoint to auto-approve work orders (can be called by external cron services)
app.post('/make-server-882c4243/cron/auto-approve', async (c) => {
  try {
    const approvedCount = await autoApproveTodayWorkOrders()
    
    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'auto_approve_cron',
      approvedCount,
      timestamp: new Date().toISOString()
    })

    console.log(`Auto-approve cron: ${approvedCount} work orders approved`)
    return c.json({ success: true, approvedCount, message: `${approvedCount} iş emri otomatik olarak onaylandı` })
  } catch (error) {
    console.log('Server error during auto-approval cron:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Legacy endpoint for backward compatibility (approves ALL drafts)
app.post('/make-server-882c4243/auto-approve', async (c) => {
  try {
    const workOrders = await getAllByPrefix('workorder:')
    const drafts = workOrders.filter((wo: any) => wo.status === 'draft')
    
    let approvedCount = 0
    for (const draft of drafts) {
      const updated = {
        ...draft,
        status: 'approved',
        approvedAt: new Date().toISOString(),
        autoApproved: true
      }
      await kv.set(draft.id, updated)
      
      // If has paidAmount, create income transaction and collection record
      if (draft.paidAmount > 0) {
        // Get customer name
        const customer = await kv.get(draft.customerId)
        const customerName = customer?.name || 'Bilinmiyor'

        // Create income transaction
        const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const transaction = {
          id: transactionId,
          type: 'income',
          amount: draft.paidAmount,
          date: draft.date,
          category: 'İş Emri Tahsilatı',
          description: `İş emri: ${draft.description || 'Temizlik hizmeti'}`,
          relatedCustomerId: draft.customerId,
          relatedWorkOrderId: draft.id,
          createdAt: new Date().toISOString(),
          createdBy: draft.createdBy,
          createdByName: draft.createdByName
        }
        await kv.set(transactionId, transaction)

        // Create collection record for daily cash flow
        const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const collection = {
          id: collectionId,
          customerId: draft.customerId,
          customerName: customerName,
          amount: draft.paidAmount,
          date: draft.date,
          workDate: draft.date,
          description: draft.description || 'İş emri tahsilatı',
          relatedWorkOrderId: draft.id,
          createdAt: new Date().toISOString(),
          createdBy: draft.createdBy,
          createdByName: draft.createdByName
        }
        await kv.set(collectionId, collection)
      }
      
      approvedCount++
    }

    console.log(`Auto-approved ${approvedCount} work orders`)
    return c.json({ success: true, approvedCount })
  } catch (error) {
    console.log('Server error during auto-approval:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// INCOME/EXPENSE ROUTES
// ============================

app.get('/make-server-882c4243/transactions', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const transactions = await getAllByPrefix('transaction:')
    return c.json({ transactions })
  } catch (error) {
    console.log('Server error fetching transactions:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.post('/make-server-882c4243/transactions', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    const permissions = user.user_metadata?.permissions || {}
    
    if (role !== 'admin' && !permissions.canManageFinance) {
      return c.json({ error: 'Insufficient permissions for financial transactions' }, 403)
    }

    const body = await c.req.json()
    const { type, amount, date, category, description, relatedCustomerId } = body

    if (!type || !amount || !date) {
      return c.json({ error: 'Type, amount, and date are required' }, 400)
    }

    const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const transaction = {
      id: transactionId,
      type, // 'income' or 'expense'
      amount: parseFloat(amount),
      date,
      category: category || '',
      description: description || '',
      relatedCustomerId: relatedCustomerId || null,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }

    await kv.set(transactionId, transaction)

    // Update customer balance if related to customer
    if (relatedCustomerId && type === 'income') {
      const customer = await kv.get(relatedCustomerId)
      if (customer) {
        customer.balance = (customer.balance || 0) - parseFloat(amount)
        customer.paymentHistory = customer.paymentHistory || []
        customer.paymentHistory.push({
          date,
          amount: parseFloat(amount),
          transactionId
        })
        await kv.set(relatedCustomerId, customer)
      }
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'transaction_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      transactionId,
      type,
      amount,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, transaction })
  } catch (error) {
    console.log('Server error creating transaction:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Delete transaction
app.delete('/make-server-882c4243/transactions/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin') {
      return c.json({ error: 'Only admin can delete transactions' }, 403)
    }

    const transactionId = c.req.param('id')
    const transaction = await kv.get(transactionId)

    if (!transaction) {
      return c.json({ error: 'Transaction not found' }, 404)
    }

    // If transaction was related to customer, update customer balance
    if (transaction.relatedCustomerId && transaction.type === 'income') {
      const customer = await kv.get(transaction.relatedCustomerId)
      if (customer) {
        customer.balance = (customer.balance || 0) + parseFloat(transaction.amount)
        customer.paymentHistory = (customer.paymentHistory || []).filter(
          (p: any) => p.transactionId !== transactionId
        )
        await kv.set(transaction.relatedCustomerId, customer)
      }
    }

    await kv.del(transactionId)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'transaction_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      transactionId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting transaction:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// INVOICE ROUTES
// ============================

app.get('/make-server-882c4243/invoices', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const invoices = await getAllByPrefix('invoice:')
    return c.json({ invoices })
  } catch (error) {
    console.log('Server error fetching invoices:', error)
    return c.json({ error: String(error) }, 500)
  }
})

app.post('/make-server-882c4243/invoices', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Only admin and secretary can create invoices' }, 403)
    }

    const body = await c.req.json()
    const { id, customerId, amount, paidAmount, dueDate, description, workOrderIds } = body

    if (!customerId || !amount || !dueDate) {
      return c.json({ error: 'Customer, amount, and due date are required' }, 400)
    }

    let invoice: any
    let invoiceId: string

    if (id) {
      // Update existing invoice
      invoice = await kv.get(id)
      if (!invoice) {
        return c.json({ error: 'Invoice not found' }, 404)
      }
      
      const oldAmount = invoice.amount
      const oldPaidAmount = invoice.paidAmount || 0
      
      invoice.customerId = customerId
      invoice.amount = parseFloat(amount)
      invoice.paidAmount = parseFloat(paidAmount) || 0
      invoice.dueDate = dueDate
      invoice.description = description || ''
      invoice.updatedAt = new Date().toISOString()
      invoice.updatedBy = user.id
      invoice.updatedByName = user.user_metadata?.name
      
      // Update status
      if (invoice.paidAmount >= invoice.amount) {
        invoice.status = 'paid'
      } else if (invoice.paidAmount > 0) {
        invoice.status = 'partial'
      } else {
        invoice.status = 'pending'
      }

      invoiceId = id

      // Update customer balance (adjust for changes)
      const customer = await kv.get(customerId)
      if (customer) {
        customer.balance = (customer.balance || 0) - oldAmount + oldPaidAmount + invoice.amount - invoice.paidAmount
        await kv.set(customerId, customer)
      }
    } else {
      // Create new invoice
      invoiceId = `invoice:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      invoice = {
        id: invoiceId,
        invoiceNumber: `INV-${Date.now()}`,
        customerId,
        amount: parseFloat(amount),
        paidAmount: parseFloat(paidAmount) || 0,
        dueDate,
        description: description || '',
        workOrderIds: workOrderIds || [],
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }

      // Set status based on payment
      if (invoice.paidAmount >= invoice.amount) {
        invoice.status = 'paid'
      } else if (invoice.paidAmount > 0) {
        invoice.status = 'partial'
      }

      // Update customer balance
      const customer = await kv.get(customerId)
      if (customer) {
        customer.balance = (customer.balance || 0) + invoice.amount - invoice.paidAmount
        await kv.set(customerId, customer)
      }
    }

    await kv.set(invoiceId, invoice)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: id ? 'invoice_updated' : 'invoice_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      invoiceId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, invoice })
  } catch (error) {
    console.log('Server error creating invoice:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Update invoice (PUT method)
app.put('/make-server-882c4243/invoices', async (c) => {
  // Redirect to POST handler
  return app.fetch(new Request(c.req.url.replace('/invoices', '/invoices'), {
    method: 'POST',
    headers: c.req.raw.headers,
    body: c.req.raw.body
  }))
})

// Delete invoice
app.delete('/make-server-882c4243/invoices/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const invoiceId = c.req.param('id')
    const invoice = await kv.get(invoiceId)
    
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404)
    }

    // Update customer balance
    const customer = await kv.get(invoice.customerId)
    if (customer) {
      customer.balance = (customer.balance || 0) - invoice.amount + (invoice.paidAmount || 0)
      await kv.set(invoice.customerId, customer)
    }

    await kv.del(invoiceId)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'invoice_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      invoiceId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting invoice:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// DASHBOARD ROUTES
// ============================
// Old dashboard route removed - using enhanced version below at line ~2483

// ============================
// LOGS ROUTE
// ============================

app.get('/make-server-882c4243/logs', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    const logs = await getAllByPrefix('log:')
    // Sort by timestamp descending
    logs.sort((a: any, b: any) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return c.json({ logs })
  } catch (error) {
    console.log('Server error fetching logs:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// PAYROLL ROUTES
// ============================

// Get payroll records for a specific date
app.get('/make-server-882c4243/payroll', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const date = c.req.query('date') || new Date().toISOString().split('T')[0]
    
    // Get all payroll records for the date
    const allRecords = await getAllByPrefix(`payroll:${date}:`)
    
    // Calculate cumulative balance up to the day before selected date
    // This finds the most recent balance for each personnel before the selected date
    const allPayrollRecords = await getAllByPrefix('payroll:')
    
    const previousBalances: Record<string, number> = {}
    
    // Group records by personnel
    const personnelRecords: Record<string, any[]> = {}
    allPayrollRecords.forEach((record: any) => {
      if (record.personnelId && record.date && record.date < date) {
        if (!personnelRecords[record.personnelId]) {
          personnelRecords[record.personnelId] = []
        }
        personnelRecords[record.personnelId].push(record)
      }
    })
    
    // For each personnel, find the most recent balance before the selected date
    Object.keys(personnelRecords).forEach(personnelId => {
      const records = personnelRecords[personnelId]
      // Sort by date descending to get the most recent
      records.sort((a, b) => b.date.localeCompare(a.date))
      // Get the most recent balance
      const mostRecentRecord = records[0]
      previousBalances[personnelId] = mostRecentRecord.balance || 0
    })
    
    return c.json({ 
      records: allRecords,
      previousBalances 
    })
  } catch (error) {
    console.log('Server error fetching payroll records:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Create or update payroll record
app.post('/make-server-882c4243/payroll', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()
    const { personnelId, date, dailyWage, dailyPayment } = body

    console.log('Payroll POST request body:', body)

    if (!personnelId || !date) {
      console.log('Missing required fields - personnelId:', personnelId, 'date:', date)
      return c.json({ 
        error: 'Personnel ID and date are required',
        received: { personnelId, date }
      }, 400)
    }

    // AUTO-CALCULATE CARRYOVER: Find most recent balance before this date
    const allPayrollRecords = await getAllByPrefix('payroll:')
    const previousRecords = allPayrollRecords.filter((record: any) => 
      record.personnelId === personnelId && 
      record.date && 
      record.date < date
    )
    
    // Sort by date descending to get the most recent
    previousRecords.sort((a, b) => b.date.localeCompare(a.date))
    
    // Get the most recent balance as carryover
    const autoCarryover = previousRecords.length > 0 ? (previousRecords[0].balance || 0) : 0

    console.log('Auto-calculated carryover for', personnelId, 'on', date, ':', autoCarryover, 'from', previousRecords.length, 'previous records')

    const recordId = `payroll:${date}:${personnelId}`
    const balance = autoCarryover + (parseFloat(dailyWage) || 0) - (parseFloat(dailyPayment) || 0)

    // Get personnel name to store in the record for searching
    const personnel = await kv.get(personnelId)
    const personnelName = personnel?.name || 'Bilinmiyor'

    const record = {
      personnelId,
      personnelName,
      date,
      carryover: autoCarryover, // AUTO-CALCULATED, not from user input
      dailyWage: parseFloat(dailyWage) || 0,
      dailyPayment: parseFloat(dailyPayment) || 0,
      balance,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      updatedByName: user.user_metadata?.name
    }

    await kv.set(recordId, record)

    // If dailyPayment > 0, create an expense transaction
    const paymentAmount = parseFloat(dailyPayment) || 0
    if (paymentAmount > 0) {

      // Create expense transaction
      const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const transaction = {
        id: transactionId,
        type: 'expense',
        amount: paymentAmount,
        date: date,
        category: 'Personel Yevmiye Ödemesi',
        description: `${personnelName} - Yevmiye ödemesi`,
        relatedCustomerId: null,
        relatedPersonnelId: personnelId,
        relatedPayrollRecord: recordId,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.user_metadata?.name
      }
      await kv.set(transactionId, transaction)
      
      console.log('Created expense transaction for payroll payment:', transactionId, 'Amount:', paymentAmount)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'payroll_updated',
      userId: user.id,
      userName: user.user_metadata?.name,
      personnelId,
      date,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, record })
  } catch (error) {
    console.log('Server error saving payroll record:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// CASH FLOW ROUTES
// ============================

// Get cash flow data for a specific date
app.get('/make-server-882c4243/cash-flow', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const date = c.req.query('date') || new Date().toISOString().split('T')[0]
    
    console.log('Cash flow request for date:', date)
    
    // Get collections and expenses for the date
    // Get both work order collections and manual collections
    const [allCollections, allManualCollections, allExpenses, allPayrollRecords, allPersonnel] = await Promise.all([
      getAllByPrefix('collection:'),
      getAllByPrefix('cashflow:collection:'),
      getAllByPrefix('cashflow:expense:'),
      getAllByPrefix(`payroll:${date}:`),
      getAllByPrefix('personnel:')
    ])
    
    // Filter payroll records to only include existing personnel
    const personnelIds = new Set(allPersonnel.map((p: any) => p.id))
    const payrollRecords = allPayrollRecords.filter((record: any) => 
      personnelIds.has(record.personnelId)
    )

    console.log('Payroll records found:', payrollRecords.length, 'for date:', date, '(filtered from', allPayrollRecords.length, ')')
    console.log('All manual collections (before filter):', allManualCollections.length)
    console.log('All expenses (before filter):', allExpenses.length)
    console.log('All work order collections (before filter):', allCollections.length)

    // Filter work order collections by date - normalize date comparison
    const workOrderCollections = allCollections.filter((c: any) => {
      // Normalize both dates to YYYY-MM-DD format for comparison
      const collectionDate = c.date ? c.date.split('T')[0] : ''
      const match = collectionDate === date
      if (match) {
        console.log('Work order collection matched:', { collectionDate, targetDate: date, amount: c.amount })
      }
      return match
    })
    
    // Filter manual collections by date - normalize date comparison
    const manualCollections = allManualCollections.filter((c: any) => {
      const collectionDate = c.date ? c.date.split('T')[0] : ''
      const match = collectionDate === date
      if (match) {
        console.log('Manual collection matched:', { collectionDate, targetDate: date, amount: c.amount })
      }
      return match
    })
    
    // Filter expenses by date - normalize date comparison
    const expenses = allExpenses.filter((e: any) => {
      const expenseDate = e.date ? e.date.split('T')[0] : ''
      const match = expenseDate === date
      if (match) {
        console.log('Expense matched:', { expenseDate, targetDate: date, amount: e.amount })
      }
      return match
    })
    
    console.log('Work order collections found:', workOrderCollections.length)
    console.log('Manual collections found:', manualCollections.length)
    console.log('Expenses found:', expenses.length)
    
    // Combine both collections
    const collections = [...workOrderCollections, ...manualCollections]

    // Calculate summary - only include CASH expenses in totalExpenses
    const totalCollection = collections.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    const totalExpenses = expenses.reduce((sum: number, e: any) => {
      // Only include expenses paid with cash (or if paymentMethod is not set, assume cash for backwards compatibility)
      if (!e.paymentMethod || e.paymentMethod === 'cash') {
        return sum + (e.amount || 0)
      }
      return sum
    }, 0)
    const totalWagesPaid = payrollRecords.reduce((sum: number, p: any) => sum + (p.dailyPayment || 0), 0)
    const totalWageDebt = payrollRecords.reduce((sum: number, p: any) => sum + (p.balance || 0), 0)
    const totalAccruedWages = payrollRecords.reduce((sum: number, p: any) => sum + (p.dailyWage || 0), 0)
    
    console.log('Summary calculated:', {
      totalCollection,
      totalExpenses,
      totalWagesPaid,
      totalWageDebt,
      totalAccruedWages
    })
    
    // Get previous month cash carryover (this would be manually set or calculated)
    const cashSettings = await kv.get('cashflow:settings') || {}
    const previousMonthCash = cashSettings.previousMonthCash || 0
    
    const todayCashTotal = previousMonthCash + totalCollection - totalWagesPaid - totalExpenses

    const summary = {
      totalCollection,
      totalWagesPaid,
      previousMonthCash,
      todayCashTotal,
      totalExpenses,
      totalWageDebt,
      totalAccruedWages
    }

    return c.json({ 
      collections: collections.sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
      expenses: expenses.sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
      summary 
    })
  } catch (error) {
    console.log('Server error fetching cash flow:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Create or update customer collection
app.post('/make-server-882c4243/cash-flow/collection', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()
    const { customerId, customerName, workDate, amount, date, description } = body

    if (!customerId || !amount || !date) {
      return c.json({ error: 'Customer, amount, and date are required' }, 400)
    }

    const recordId = `cashflow:collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const record = {
      id: recordId,
      customerId,
      customerName,
      workDate: workDate || '',
      amount: parseFloat(amount),
      date,
      description: description || '',
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }

    await kv.set(recordId, record)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'collection_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      customerId,
      amount,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, record })
  } catch (error) {
    console.log('Server error creating collection:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Update customer collection
app.put('/make-server-882c4243/cash-flow/collection', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()
    const { id, customerId, customerName, workDate, amount, date, description } = body

    if (!id || !customerId || !amount || !date) {
      return c.json({ error: 'ID, customer, amount, and date are required' }, 400)
    }

    const existingRecord = await kv.get(id)
    if (!existingRecord) {
      return c.json({ error: 'Record not found' }, 404)
    }

    // Check if this collection is related to a work order
    if (existingRecord.relatedWorkOrderId) {
      return c.json({ error: 'Bu tahsilat iş emrinden otomatik oluşturuldu ve düzenlenemez. İş emrini düzenleyiniz.' }, 400)
    }

    const record = {
      ...existingRecord,
      customerId,
      customerName,
      workDate: workDate || '',
      amount: parseFloat(amount),
      date,
      description: description || '',
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      updatedByName: user.user_metadata?.name
    }

    await kv.set(id, record)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'collection_updated',
      userId: user.id,
      userName: user.user_metadata?.name,
      recordId: id,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, record })
  } catch (error) {
    console.log('Server error updating collection:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Delete customer collection
app.delete('/make-server-882c4243/cash-flow/collection/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const id = c.req.param('id')
    
    // Check if this collection is related to a work order
    const collection = await kv.get(id)
    if (collection?.relatedWorkOrderId) {
      return c.json({ error: 'Bu tahsilat iş emrinden otomatik oluşturuldu ve silinemez. İş emrini düzenleyiniz.' }, 400)
    }
    
    await kv.del(id)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'collection_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      recordId: id,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting collection:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Create or update general expense
app.post('/make-server-882c4243/cash-flow/expense', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()
    const { description, invoiceDate, invoiceNo, amount, date, paymentMethod } = body

    if (!description || !amount || !date) {
      return c.json({ error: 'Description, amount, and date are required' }, 400)
    }

    const recordId = `cashflow:expense:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const record = {
      id: recordId,
      description,
      invoiceDate: invoiceDate || '',
      invoiceNo: invoiceNo || '',
      amount: parseFloat(amount),
      date,
      paymentMethod: paymentMethod || 'cash', // Default to cash for backwards compatibility
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }

    await kv.set(recordId, record)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'expense_created',
      userId: user.id,
      userName: user.user_metadata?.name,
      description,
      amount,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, record })
  } catch (error) {
    console.log('Server error creating expense:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Update general expense
app.put('/make-server-882c4243/cash-flow/expense', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const body = await c.req.json()
    const { id, description, invoiceDate, invoiceNo, amount, date, paymentMethod } = body

    if (!id || !description || !amount || !date) {
      return c.json({ error: 'ID, description, amount, and date are required' }, 400)
    }

    const existingRecord = await kv.get(id)
    if (!existingRecord) {
      return c.json({ error: 'Record not found' }, 404)
    }

    const record = {
      ...existingRecord,
      description,
      invoiceDate: invoiceDate || '',
      invoiceNo: invoiceNo || '',
      amount: parseFloat(amount),
      date,
      paymentMethod: paymentMethod || 'cash', // Default to cash for backwards compatibility
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
      updatedByName: user.user_metadata?.name
    }

    await kv.set(id, record)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'expense_updated',
      userId: user.id,
      userName: user.user_metadata?.name,
      recordId: id,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, record })
  } catch (error) {
    console.log('Server error updating expense:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Delete general expense
app.delete('/make-server-882c4243/cash-flow/expense/:id', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const id = c.req.param('id')
    await kv.del(id)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'expense_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      recordId: id,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting expense:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// HISTORY SEARCH ROUTES
// ============================

// Search ALL history records by keyword - GLOBAL SEARCH (no date filter)
app.get('/make-server-882c4243/history-search', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const keyword = c.req.query('keyword') || ''
    const startDate = c.req.query('startDate') || ''
    const endDate = c.req.query('endDate') || ''

    if (!keyword) {
      return c.json({ error: 'Keyword is required' }, 400)
    }

    const hasDateFilter = startDate && endDate
    console.log('History search - keyword:', keyword, hasDateFilter ? `- date range: ${startDate} to ${endDate}` : '- searching ALL records')

    // Get all data sources - NO DATE FILTERING
    const [allCollections, allExpenses, allPayrolls, allTransactions, allWorkOrders, allPersonnel, allCustomers] = await Promise.all([
      getAllByPrefix('cashflow:collection:'),
      getAllByPrefix('cashflow:expense:'),
      getAllByPrefix('payroll:'),
      getAllByPrefix('transaction:'),
      getAllByPrefix('workorder:'),
      getAllByPrefix('personnel:'),
      getAllByPrefix('customer:')
    ])

    // Create lookup maps
    const personnelNameMap: Record<string, string> = {}
    const customerNameMap: Record<string, string> = {}
    const personnelPhoneMap: Record<string, string> = {}
    const customerPhoneMap: Record<string, string> = {}
    
    allPersonnel.forEach((p: any) => {
      personnelNameMap[p.id] = p.name
      if (p.contactInfo?.phone) {
        personnelPhoneMap[p.id] = p.contactInfo.phone
      }
    })
    
    allCustomers.forEach((c: any) => {
      customerNameMap[c.id] = c.name
      if (c.contactInfo?.phone) {
        customerPhoneMap[c.id] = c.contactInfo.phone
      }
    })

    // Check if keyword is numeric
    const keywordLower = keyword.toLowerCase()
    const keywordNumeric = parseFloat(keyword.replace(/[.,]/g, ''))
    const isNumericSearch = !isNaN(keywordNumeric)
    
    // Check if searching for a specific customer or personnel
    let matchedCustomerIds: Set<string> = new Set()
    let matchedPersonnelIds: Set<string> = new Set()
    
    // Search by customer name or phone
    allCustomers.forEach((c: any) => {
      const nameMatch = c.name?.toLowerCase().includes(keywordLower)
      const phoneMatch = c.contactInfo?.phone?.includes(keyword)
      const emailMatch = c.contactInfo?.email?.toLowerCase().includes(keywordLower)
      if (nameMatch || phoneMatch || emailMatch) {
        matchedCustomerIds.add(c.id)
      }
    })
    
    // Search by personnel name or phone
    allPersonnel.forEach((p: any) => {
      const nameMatch = p.name?.toLowerCase().includes(keywordLower)
      const phoneMatch = p.contactInfo?.phone?.includes(keyword)
      const emailMatch = p.contactInfo?.email?.toLowerCase().includes(keywordLower)
      if (nameMatch || phoneMatch || emailMatch) {
        matchedPersonnelIds.add(p.id)
      }
    })

    console.log('Matched customers:', matchedCustomerIds.size, 'Matched personnel:', matchedPersonnelIds.size)
    console.log('Is numeric search:', isNumericSearch, 'Value:', keywordNumeric)

    // Helper function to check if amount matches
    const amountMatches = (amount: number) => {
      if (!isNumericSearch) return false
      const amountStr = amount.toString()
      return amountStr.includes(keyword) || Math.abs(amount - keywordNumeric) < 0.01
    }

    // Helper function to check if date is in range (if date filter is active)
    const isDateInRange = (dateStr: string) => {
      if (!hasDateFilter) return true // No date filter, include all
      if (!dateStr) return false
      const recordDate = dateStr.split('T')[0] // Normalize to YYYY-MM-DD
      return recordDate >= startDate && recordDate <= endDate
    }

    // Filter collections - OPTIONAL DATE FILTER
    const filteredCollections = allCollections.filter((c: any) => {
      if (!c.date) return false
      
      // Check date range if filter is active
      if (!isDateInRange(c.date)) return false
      
      // If customer matched by name/phone, include ALL their collections
      if (matchedCustomerIds.size > 0 && c.customerId && matchedCustomerIds.has(c.customerId)) {
        return true
      }
      
      // Get customer name from record or lookup map (for old records)
      const customerName = c.customerName || customerNameMap[c.customerId] || ''
      const customerNameMatch = customerName.toLowerCase().includes(keywordLower)
      const descriptionMatch = c.description?.toLowerCase().includes(keywordLower)
      const amountMatch = amountMatches(c.amount)
      
      return customerNameMatch || descriptionMatch || amountMatch
    })

    // Filter expenses - OPTIONAL DATE FILTER
    const filteredExpenses = allExpenses.filter((e: any) => {
      if (!e.date) return false
      
      // Check date range if filter is active
      if (!isDateInRange(e.date)) return false
      
      const descriptionMatch = e.description?.toLowerCase().includes(keywordLower)
      const amountMatch = amountMatches(e.amount)
      return descriptionMatch || amountMatch
    })

    // Filter payroll records - OPTIONAL DATE FILTER
    const filteredPayrolls = allPayrolls.filter((p: any) => {
      if (!p.date) return false
      
      // Check date range if filter is active
      if (!isDateInRange(p.date)) return false
      
      // If personnel matched by name/phone, include ALL their payroll records
      if (matchedPersonnelIds.size > 0 && p.personnelId && matchedPersonnelIds.has(p.personnelId)) {
        return true
      }
      
      // Get personnel name from record or lookup map (for old records)
      const personnelName = p.personnelName || personnelNameMap[p.personnelId] || ''
      const personnelNameMatch = personnelName.toLowerCase().includes(keywordLower)
      const dailyWageMatch = amountMatches(p.dailyWage)
      const dailyPaymentMatch = amountMatches(p.dailyPayment)
      const balanceMatch = amountMatches(p.balance)
      
      return personnelNameMatch || dailyWageMatch || dailyPaymentMatch || balanceMatch
    })

    // Filter transactions - OPTIONAL DATE FILTER
    const filteredTransactions = allTransactions.filter((t: any) => {
      if (!t.date) return false
      
      // Check date range if filter is active
      if (!isDateInRange(t.date)) return false
      
      // If related customer/personnel matched, include this transaction
      if (matchedCustomerIds.size > 0 && t.relatedCustomerId && matchedCustomerIds.has(t.relatedCustomerId)) {
        return true
      }
      if (matchedPersonnelIds.size > 0 && t.relatedPersonnelId && matchedPersonnelIds.has(t.relatedPersonnelId)) {
        return true
      }
      
      const categoryMatch = t.category?.toLowerCase().includes(keywordLower)
      const descriptionMatch = t.description?.toLowerCase().includes(keywordLower)
      const amountMatch = amountMatches(t.amount)
      
      return categoryMatch || descriptionMatch || amountMatch
    })

    // Filter work orders - OPTIONAL DATE FILTER
    const filteredWorkOrders = allWorkOrders.filter((w: any) => {
      if (!w.date) return false
      
      // Check date range if filter is active
      if (!isDateInRange(w.date)) return false
      
      // If customer matched by name/phone, include ALL their work orders
      if (matchedCustomerIds.size > 0 && w.customerId && matchedCustomerIds.has(w.customerId)) {
        return true
      }
      
      // Get customer name from record or lookup map (for old records)
      const customerName = w.customerName || customerNameMap[w.customerId] || ''
      const customerNameMatch = customerName.toLowerCase().includes(keywordLower)
      const totalAmountMatch = amountMatches(w.totalAmount)
      const paidAmountMatch = amountMatches(w.paidAmount)
      
      return customerNameMatch || totalAmountMatch || paidAmountMatch
    })

    console.log('Search results:', {
      collections: filteredCollections.length,
      expenses: filteredExpenses.length,
      payrolls: filteredPayrolls.length,
      transactions: filteredTransactions.length,
      workOrders: filteredWorkOrders.length
    })

    // Format results - NO "day" field, just full date
    const collectionResults = filteredCollections.map((c: any) => {
      const customerName = c.customerName || customerNameMap[c.customerId] || 'Bilinmiyor'
      return {
        customerName,
        workDate: c.workDate,
        amount: c.amount,
        date: c.date,
        description: c.description,
        type: 'collection'
      }
    }).sort((a: any, b: any) => b.date.localeCompare(a.date)) // Sort by date descending

    const expenseResults = filteredExpenses.map((e: any) => {
      return {
        description: e.description,
        invoiceDate: e.invoiceDate,
        amount: e.amount,
        date: e.date,
        type: 'expense'
      }
    }).sort((a: any, b: any) => b.date.localeCompare(a.date))

    const payrollResults = filteredPayrolls.map((p: any) => {
      const personnelName = p.personnelName || personnelNameMap[p.personnelId] || 'Bilinmiyor'
      return {
        personnelName,
        dailyWage: p.dailyWage,
        dailyPayment: p.dailyPayment,
        balance: p.balance,
        date: p.date,
        type: 'payroll'
      }
    }).sort((a: any, b: any) => b.date.localeCompare(a.date))

    const transactionResults = filteredTransactions.map((t: any) => {
      return {
        category: t.category,
        description: t.description,
        amount: t.amount,
        transactionType: t.type,
        date: t.date,
        type: 'transaction'
      }
    }).sort((a: any, b: any) => b.date.localeCompare(a.date))

    const workOrderResults = filteredWorkOrders.map((w: any) => {
      const customerName = w.customerName || customerNameMap[w.customerId] || 'Bilinmiyor'
      return {
        customerName,
        totalAmount: w.totalAmount,
        paidAmount: w.paidAmount,
        date: w.date,
        type: 'workorder'
      }
    }).sort((a: any, b: any) => b.date.localeCompare(a.date))

    // Calculate totals
    const totalCollections = collectionResults.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    const totalExpenses = expenseResults.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const totalPayrollWages = payrollResults.reduce((sum: number, p: any) => sum + (p.dailyWage || 0), 0)
    const totalPayrollPayments = payrollResults.reduce((sum: number, p: any) => sum + (p.dailyPayment || 0), 0)
    const totalTransactions = transactionResults.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    const totalWorkOrders = workOrderResults.reduce((sum: number, w: any) => sum + (w.totalAmount || 0), 0)

    return c.json({
      collections: collectionResults,
      expenses: expenseResults,
      payrolls: payrollResults,
      transactions: transactionResults,
      workOrders: workOrderResults,
      totalCollections,
      totalExpenses,
      totalPayrollWages,
      totalPayrollPayments,
      totalTransactions,
      totalWorkOrders
    })
  } catch (error) {
    console.log('Server error during history search:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// PENDING COLLECTIONS ROUTE
// ============================

app.get('/make-server-882c4243/pending-collections', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    console.log('Fetching pending collections...')

    // Get all work orders and customers - use getAllByPrefix to bypass 1000 record limit
    const [allWorkOrders, allCustomers] = await Promise.all([
      getAllByPrefix('workorder:'),
      getAllByPrefix('customer:')
    ])

    // Create customer map
    const customerMap: Record<string, any> = {}
    allCustomers.forEach((customer: any) => {
      customerMap[customer.id] = customer
    })

    // Filter work orders with pending payments (totalAmount > paidAmount)
    const pendingWorkOrders = allWorkOrders.filter((wo: any) => {
      const totalAmount = wo.totalAmount || 0
      const paidAmount = wo.paidAmount || 0
      const remainingAmount = totalAmount - paidAmount
      return remainingAmount > 0.01 // Use 0.01 to handle floating point precision
    })

    console.log('Total work orders:', allWorkOrders.length)
    console.log('Pending work orders:', pendingWorkOrders.length)

    // Group by customer
    const customerDebtsMap: Record<string, {
      customerId: string
      customerName: string
      customerColor?: string
      totalDebt: number
      workOrders: Array<{
        workOrderId: string
        date: string
        totalAmount: number
        paidAmount: number
        remainingAmount: number
        description?: string
      }>
    }> = {}

    pendingWorkOrders.forEach((wo: any) => {
      const customerId = wo.customerId
      const customer = customerMap[customerId]
      const totalAmount = wo.totalAmount || 0
      const paidAmount = wo.paidAmount || 0
      const remainingAmount = totalAmount - paidAmount

      if (!customerDebtsMap[customerId]) {
        customerDebtsMap[customerId] = {
          customerId,
          customerName: customer?.name || 'Bilinmeyen Müşteri',
          customerColor: customer?.color,
          totalDebt: 0,
          workOrders: []
        }
      }

      customerDebtsMap[customerId].totalDebt += remainingAmount
      customerDebtsMap[customerId].workOrders.push({
        workOrderId: wo.id,
        date: wo.date,
        totalAmount,
        paidAmount,
        remainingAmount,
        description: wo.notes || wo.description
      })
    })

    // Convert to array
    const customerDebts = Object.values(customerDebtsMap)

    console.log('Customer debts grouped:', customerDebts.length)

    return c.json({ customerDebts })
  } catch (error) {
    console.log('Server error fetching pending collections:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Record payment for a work order
app.post('/make-server-882c4243/work-orders/:workOrderId/payment', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const userRole = user.user_metadata?.role
    if (userRole !== 'admin' && userRole !== 'secretary') {
      return c.json({ error: 'Forbidden' }, 403)
    }

    const workOrderId = c.req.param('workOrderId')
    const body = await c.req.json()
    const { amount, date } = body

    if (!amount || !date) {
      return c.json({ error: 'Amount and date are required' }, 400)
    }

    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return c.json({ error: 'Invalid payment amount' }, 400)
    }

    // Get work order
    const workOrder = await kv.get(workOrderId)
    if (!workOrder) {
      return c.json({ error: 'Work order not found' }, 404)
    }

    const totalAmount = workOrder.totalAmount || 0
    const currentPaidAmount = workOrder.paidAmount || 0
    const remainingAmount = totalAmount - currentPaidAmount

    if (paymentAmount > remainingAmount + 0.01) { // +0.01 for floating point precision
      return c.json({ error: 'Payment amount exceeds remaining balance' }, 400)
    }

    // Update work order
    const newPaidAmount = currentPaidAmount + paymentAmount
    workOrder.paidAmount = newPaidAmount
    workOrder.updatedAt = new Date().toISOString()
    workOrder.updatedBy = user.id
    workOrder.updatedByName = user.user_metadata?.name

    await kv.set(workOrderId, workOrder)

    // Get customer info
    const customer = await kv.get(workOrder.customerId)
    const customerName = customer?.name || 'Bilinmiyor'

    // Create income transaction
    const transactionId = `transaction:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const transaction = {
      id: transactionId,
      type: 'income',
      amount: paymentAmount,
      date: date,
      category: 'İş Emri Tahsilatı',
      description: `${customerName} - ${workOrder.description || 'Temizlik hizmeti'} (Kısmi ödeme)`,
      relatedCustomerId: workOrder.customerId,
      relatedWorkOrderId: workOrderId,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }
    await kv.set(transactionId, transaction)

    // Create collection record for daily cash flow
    const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const collection = {
      id: collectionId,
      customerId: workOrder.customerId,
      customerName: customerName,
      amount: paymentAmount,
      date: date,
      description: workOrder.description || 'İş emri kısmi ödemesi',
      workDate: workOrder.date,
      relatedWorkOrderId: workOrderId,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }
    await kv.set(collectionId, collection)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'work_order_payment',
      userId: user.id,
      userName: user.user_metadata?.name,
      workOrderId,
      amount: paymentAmount,
      newPaidAmount,
      timestamp: new Date().toISOString()
    })

    console.log('Payment recorded successfully:', {
      workOrderId,
      paymentAmount,
      newPaidAmount,
      remainingAmount: totalAmount - newPaidAmount
    })

    return c.json({ 
      success: true, 
      workOrder,
      transaction,
      collection 
    })
  } catch (error) {
    console.log('Server error recording payment:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// Search collections and expenses by keyword for a specific month - MONTHLY SEARCH (kept for backwards compatibility)
app.get('/make-server-882c4243/monthly-search', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const keyword = c.req.query('keyword') || ''
    const month = parseInt(c.req.query('month') || String(new Date().getMonth() + 1))
    const year = parseInt(c.req.query('year') || String(new Date().getFullYear()))

    if (!keyword) {
      return c.json({ error: 'Keyword is required' }, 400)
    }

    console.log('Monthly search - keyword:', keyword, 'month:', month, 'year:', year)

    // Get all data sources for the specified month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${endDay}`

    const [allCollections, allExpenses, allPayrolls, allTransactions, allWorkOrders, allPersonnel, allCustomers] = await Promise.all([
      getAllByPrefix('cashflow:collection:'),
      getAllByPrefix('cashflow:expense:'),
      getAllByPrefix('payroll:'),
      getAllByPrefix('transaction:'),
      getAllByPrefix('workorder:'),
      getAllByPrefix('personnel:'),
      getAllByPrefix('customer:')
    ])

    // Create lookup maps
    const personnelNameMap: Record<string, string> = {}
    const customerNameMap: Record<string, string> = {}
    const personnelPhoneMap: Record<string, string> = {}
    const customerPhoneMap: Record<string, string> = {}
    
    allPersonnel.forEach((p: any) => {
      personnelNameMap[p.id] = p.name
      if (p.contactInfo?.phone) {
        personnelPhoneMap[p.id] = p.contactInfo.phone
      }
    })
    
    allCustomers.forEach((c: any) => {
      customerNameMap[c.id] = c.name
      if (c.contactInfo?.phone) {
        customerPhoneMap[c.id] = c.contactInfo.phone
      }
    })

    // Check if keyword is numeric
    const keywordLower = keyword.toLowerCase()
    const keywordNumeric = parseFloat(keyword.replace(/[.,]/g, ''))
    const isNumericSearch = !isNaN(keywordNumeric)
    
    // Check if searching for a specific customer or personnel
    let matchedCustomerIds: Set<string> = new Set()
    let matchedPersonnelIds: Set<string> = new Set()
    
    // Search by customer name or phone
    allCustomers.forEach((c: any) => {
      const nameMatch = c.name?.toLowerCase().includes(keywordLower)
      const phoneMatch = c.contactInfo?.phone?.includes(keyword)
      const emailMatch = c.contactInfo?.email?.toLowerCase().includes(keywordLower)
      if (nameMatch || phoneMatch || emailMatch) {
        matchedCustomerIds.add(c.id)
      }
    })
    
    // Search by personnel name or phone
    allPersonnel.forEach((p: any) => {
      const nameMatch = p.name?.toLowerCase().includes(keywordLower)
      const phoneMatch = p.contactInfo?.phone?.includes(keyword)
      const emailMatch = p.contactInfo?.email?.toLowerCase().includes(keywordLower)
      if (nameMatch || phoneMatch || emailMatch) {
        matchedPersonnelIds.add(p.id)
      }
    })

    console.log('Matched customers:', matchedCustomerIds.size, 'Matched personnel:', matchedPersonnelIds.size)
    console.log('Is numeric search:', isNumericSearch, 'Value:', keywordNumeric)

    // Helper function to check if amount matches
    const amountMatches = (amount: number) => {
      if (!isNumericSearch) return false
      const amountStr = amount.toString()
      return amountStr.includes(keyword) || Math.abs(amount - keywordNumeric) < 0.01
    }

    // Filter collections by date range and keyword
    const filteredCollections = allCollections.filter((c: any) => {
      if (!c.date || c.date < startDate || c.date > endDate) return false
      
      // If customer matched by name/phone, include ALL their records
      if (matchedCustomerIds.size > 0 && c.customerId && matchedCustomerIds.has(c.customerId)) {
        return true
      }
      
      const customerNameMatch = c.customerName?.toLowerCase().includes(keywordLower)
      const descriptionMatch = c.description?.toLowerCase().includes(keywordLower)
      const amountMatch = amountMatches(c.amount)
      return customerNameMatch || descriptionMatch || amountMatch
    })

    // Filter expenses by date range and keyword
    const filteredExpenses = allExpenses.filter((e: any) => {
      if (!e.date || e.date < startDate || e.date > endDate) return false
      
      const descriptionMatch = e.description?.toLowerCase().includes(keywordLower)
      const amountMatch = amountMatches(e.amount)
      return descriptionMatch || amountMatch
    })

    // Filter payroll records
    const filteredPayrolls = allPayrolls.filter((p: any) => {
      if (!p.date || p.date < startDate || p.date > endDate) return false
      
      // If personnel matched by name/phone, include ALL their payroll records
      if (matchedPersonnelIds.size > 0 && p.personnelId && matchedPersonnelIds.has(p.personnelId)) {
        return true
      }
      
      // Get personnel name from record or lookup map (for old records)
      const personnelName = p.personnelName || personnelNameMap[p.personnelId] || ''
      const personnelNameMatch = personnelName.toLowerCase().includes(keywordLower)
      const dailyWageMatch = amountMatches(p.dailyWage)
      const dailyPaymentMatch = amountMatches(p.dailyPayment)
      const balanceMatch = amountMatches(p.balance)
      
      return personnelNameMatch || dailyWageMatch || dailyPaymentMatch || balanceMatch
    })

    // Filter transactions
    const filteredTransactions = allTransactions.filter((t: any) => {
      if (!t.date || t.date < startDate || t.date > endDate) return false
      
      // If customer or personnel matched, include their related transactions
      if (matchedCustomerIds.size > 0 && t.relatedCustomerId && matchedCustomerIds.has(t.relatedCustomerId)) {
        return true
      }
      if (matchedPersonnelIds.size > 0 && t.relatedPersonnelId && matchedPersonnelIds.has(t.relatedPersonnelId)) {
        return true
      }
      
      const categoryMatch = t.category?.toLowerCase().includes(keywordLower)
      const descriptionMatch = t.description?.toLowerCase().includes(keywordLower)
      const amountMatch = amountMatches(t.amount)
      
      return categoryMatch || descriptionMatch || amountMatch
    })

    // Filter work orders
    const filteredWorkOrders = allWorkOrders.filter((w: any) => {
      if (!w.date || w.date < startDate || w.date > endDate) return false
      
      // If customer matched by name/phone, include ALL their work orders
      if (matchedCustomerIds.size > 0 && w.customerId && matchedCustomerIds.has(w.customerId)) {
        return true
      }
      
      // If personnel matched, include work orders they're assigned to
      if (matchedPersonnelIds.size > 0 && w.personnelIds && w.personnelIds.length > 0) {
        const hasMatchedPersonnel = w.personnelIds.some((pid: string) => matchedPersonnelIds.has(pid))
        if (hasMatchedPersonnel) {
          return true
        }
      }
      
      const customerNameMatch = w.customerName?.toLowerCase().includes(keywordLower)
      const totalAmountMatch = amountMatches(w.totalAmount)
      const paidAmountMatch = amountMatches(w.paidAmount)
      
      return customerNameMatch || totalAmountMatch || paidAmountMatch
    })

    console.log('Search results:', {
      collections: filteredCollections.length,
      expenses: filteredExpenses.length,
      payrolls: filteredPayrolls.length,
      transactions: filteredTransactions.length,
      workOrders: filteredWorkOrders.length
    })

    // Format results with day information
    const collectionResults = filteredCollections.map((c: any) => {
      const day = new Date(c.date).getDate()
      // Ensure customerName is always set
      const customerName = c.customerName || customerNameMap[c.customerId] || 'Bilinmiyor'
      return {
        day,
        customerName,
        workDate: c.workDate,
        amount: c.amount,
        date: c.date,
        description: c.description,
        type: 'collection'
      }
    }).sort((a: any, b: any) => a.day - b.day)

    const expenseResults = filteredExpenses.map((e: any) => {
      const day = new Date(e.date).getDate()
      return {
        day,
        description: e.description,
        invoiceDate: e.invoiceDate,
        amount: e.amount,
        date: e.date,
        type: 'expense'
      }
    }).sort((a: any, b: any) => a.day - b.day)

    const payrollResults = filteredPayrolls.map((p: any) => {
      const day = new Date(p.date).getDate()
      // Get personnel name from record or lookup map (for old records)
      const personnelName = p.personnelName || personnelNameMap[p.personnelId] || 'Bilinmiyor'
      return {
        day,
        personnelName,
        dailyWage: p.dailyWage,
        dailyPayment: p.dailyPayment,
        balance: p.balance,
        date: p.date,
        type: 'payroll'
      }
    }).sort((a: any, b: any) => a.day - b.day)

    const transactionResults = filteredTransactions.map((t: any) => {
      const day = new Date(t.date).getDate()
      return {
        day,
        category: t.category,
        description: t.description,
        amount: t.amount,
        transactionType: t.type,
        date: t.date,
        type: 'transaction'
      }
    }).sort((a: any, b: any) => a.day - b.day)

    const workOrderResults = filteredWorkOrders.map((w: any) => {
      const day = new Date(w.date).getDate()
      // Ensure customerName is always set
      const customerName = w.customerName || customerNameMap[w.customerId] || 'Bilinmiyor'
      return {
        day,
        customerName,
        totalAmount: w.totalAmount,
        paidAmount: w.paidAmount,
        date: w.date,
        type: 'workorder'
      }
    }).sort((a: any, b: any) => a.day - b.day)

    // Calculate totals
    const totalCollections = collectionResults.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    const totalExpenses = expenseResults.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const totalPayrollWages = payrollResults.reduce((sum: number, p: any) => sum + (p.dailyWage || 0), 0)
    const totalPayrollPayments = payrollResults.reduce((sum: number, p: any) => sum + (p.dailyPayment || 0), 0)
    const totalTransactions = transactionResults.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    const totalWorkOrders = workOrderResults.reduce((sum: number, w: any) => sum + (w.totalAmount || 0), 0)

    return c.json({
      collections: collectionResults,
      expenses: expenseResults,
      payrolls: payrollResults,
      transactions: transactionResults,
      workOrders: workOrderResults,
      totalCollections,
      totalExpenses,
      totalPayrollWages,
      totalPayrollPayments,
      totalTransactions,
      totalWorkOrders,
      searchParams: {
        keyword,
        month,
        year,
        isNumericSearch
      }
    })
  } catch (error) {
    console.log('Server error searching monthly data:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// DASHBOARD ROUTE
// ============================

app.get('/make-server-882c4243/dashboard', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    const today = new Date().toISOString().split('T')[0]
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    // Get all data in parallel
    const [workOrders, transactions, customers, payrolls, collections] = await Promise.all([
      getAllByPrefix('workorder:'),
      getAllByPrefix('transaction:'),
      getAllByPrefix('customer:'),
      getAllByPrefix('payroll:'),
      getAllByPrefix('collection:')
    ])

    // Today's work orders
    const todayWorkOrders = workOrders.filter((wo: any) => 
      wo.date?.startsWith(today) && wo.status !== 'draft'
    ).length

    // Draft count
    const draftCount = workOrders.filter((wo: any) => wo.status === 'draft').length

    // Calculate financials - Use collections for income (more reliable than transactions)
    const incomeTransactions = transactions.filter((t: any) => t.type === 'income')
    const expenseTransactions = transactions.filter((t: any) => t.type === 'expense')
    
    // Income from both collections and income transactions
    const incomeFromCollections = collections.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    const incomeFromTransactions = incomeTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    const income = incomeFromCollections + incomeFromTransactions
    
    const expense = expenseTransactions.reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    const balance = income - expense

    // This month and last month stats
    const thisMonthCollections = collections
      .filter((c: any) => c.date?.startsWith(thisMonth))
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    
    const thisMonthIncomeTransactions = incomeTransactions
      .filter((t: any) => t.date?.startsWith(thisMonth))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    
    const thisMonthIncome = thisMonthCollections + thisMonthIncomeTransactions
    
    const lastMonthCollections = collections
      .filter((c: any) => c.date?.startsWith(lastMonthStr))
      .reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
    
    const lastMonthIncomeTransactions = incomeTransactions
      .filter((t: any) => t.date?.startsWith(lastMonthStr))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    
    const lastMonthIncome = lastMonthCollections + lastMonthIncomeTransactions

    const thisMonthExpense = expenseTransactions
      .filter((t: any) => t.date?.startsWith(thisMonth))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    
    const lastMonthExpense = expenseTransactions
      .filter((t: any) => t.date?.startsWith(lastMonthStr))
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)

    const thisMonthProfit = thisMonthIncome - thisMonthExpense
    const lastMonthProfit = lastMonthIncome - lastMonthExpense

    console.log('Dashboard Stats:', {
      thisMonth,
      lastMonthStr,
      totalWorkOrders: workOrders.length,
      totalTransactions: transactions.length,
      totalCollections: collections.length,
      incomeTransactionsCount: incomeTransactions.length,
      expenseTransactionsCount: expenseTransactions.length,
      thisMonthCollections,
      thisMonthIncomeTransactions,
      thisMonthIncome,
      lastMonthCollections,
      lastMonthIncomeTransactions,
      lastMonthIncome,
      thisMonthExpense,
      lastMonthExpense,
      thisMonthProfit,
      lastMonthProfit,
      income,
      expense,
      balance
    })
    
    console.log('=== FINAL RETURN VALUES ===')
    console.log('thisMonthIncome:', thisMonthIncome)
    console.log('thisMonthExpense:', thisMonthExpense)
    console.log('thisMonthProfit:', thisMonthProfit)

    // Completed this month
    const completedThisMonth = workOrders.filter((wo: any) => 
      wo.status === 'completed' && wo.completedAt?.startsWith(thisMonth)
    ).length

    // Upcoming work orders (next 7 days)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)
    const nextWeekStr = nextWeek.toISOString().split('T')[0]
    const upcomingWorkOrders = workOrders.filter((wo: any) => {
      if (!wo.date || wo.status === 'draft') return false
      return wo.date > today && wo.date <= nextWeekStr
    }).length

    // Problematic customers
    const problematicCustomers = customers.filter((c: any) => c.type === 'problematic').length

    // Total receivables (work orders not fully paid)
    const totalReceivables = workOrders.reduce((sum: number, wo: any) => {
      const remaining = (wo.totalAmount || 0) - (wo.paidAmount || 0)
      return sum + (remaining > 0 ? remaining : 0)
    }, 0)

    // Total payables (personnel balances)
    const totalPayables = payrolls.reduce((sum: number, p: any) => {
      const balance = p.balance || 0
      return sum + (balance > 0 ? balance : 0)
    }, 0)

    // Recent trend (last 7 days of collections)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayCollections = collections.filter((c: any) => c.date === dateStr)
      const amount = dayCollections.reduce((sum: number, c: any) => sum + (c.amount || 0), 0)
      recentTrend.push({
        date: dateStr,
        amount
      })
    }

    // Role-specific data
    let myTasks = undefined
    let todayAssignments = undefined

    if (role === 'cleaner') {
      myTasks = workOrders.filter((wo: any) => 
        wo.date?.startsWith(today) && 
        wo.personnelIds?.includes(user.id)
      )
    }

    if (role === 'driver') {
      todayAssignments = workOrders.filter((wo: any) => 
        wo.date?.startsWith(today) && wo.status !== 'draft'
      ).map((wo: any) => ({
        id: wo.id,
        description: wo.description,
        personnelCount: wo.personnelIds?.length || 0
      }))
    }

    return c.json({
      todayWorkOrders,
      draftCount,
      income,
      expense,
      balance,
      totalReceivables,
      totalPayables,
      thisMonthIncome,
      lastMonthIncome,
      thisMonthExpense,
      lastMonthExpense,
      thisMonthProfit,
      lastMonthProfit,
      completedThisMonth,
      upcomingWorkOrders,
      problematicCustomers,
      recentTrend,
      myTasks,
      todayAssignments
    })
  } catch (error) {
    console.log('Server error fetching dashboard:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// ANALYTICS ROUTE
// ============================

app.get('/make-server-882c4243/analytics', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role
    if (role !== 'admin' && role !== 'secretary') {
      return c.json({ error: 'Unauthorized - Admin or Secretary access required' }, 403)
    }

    const months = parseInt(c.req.query('months') || '6')
    
    console.log('📊 Analytics: Starting data fetch...')
    const startTime = Date.now()
    
    // Get all data in parallel
    const [workOrders, transactions, customers, personnel, collections] = await Promise.all([
      getAllByPrefix('workorder:'),
      getAllByPrefix('transaction:'),
      getAllByPrefix('customer:'),
      getAllByPrefix('personnel:'),
      getAllByPrefix('collection:')
    ])
    
    console.log(`📊 Analytics: Data fetched in ${Date.now() - startTime}ms`, {
      workOrders: workOrders.length,
      transactions: transactions.length,
      customers: customers.length,
      personnel: personnel.length,
      collections: collections.length
    })

    // Calculate date range
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1)
    const startDateStr = startDate.toISOString().split('T')[0]

    // Filter data by date range FIRST to reduce processing
    const filteredWorkOrders = workOrders.filter((wo: any) => wo.date >= startDateStr)
    const filteredTransactions = transactions.filter((t: any) => t.date >= startDateStr)
    const filteredCollections = collections.filter((c: any) => c.date >= startDateStr)
    
    console.log(`📊 Analytics: Filtered to date range ${startDateStr}`, {
      workOrders: filteredWorkOrders.length,
      transactions: filteredTransactions.length,
      collections: filteredCollections.length
    })

    // Monthly trends - optimized with pre-filtered data
    const monthlyTrends = []
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthName = date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short' })

      let monthCollections = 0
      let monthIncomeTransactions = 0
      let monthExpense = 0

      // Single pass through filtered data
      for (const c of filteredCollections) {
        if (c.date?.startsWith(monthStr)) {
          monthCollections += (c.amount || 0)
        }
      }

      for (const t of filteredTransactions) {
        if (t.date?.startsWith(monthStr)) {
          if (t.type === 'income') {
            monthIncomeTransactions += (t.amount || 0)
          } else if (t.type === 'expense') {
            monthExpense += (t.amount || 0)
          }
        }
      }

      const monthIncome = monthCollections + monthIncomeTransactions

      monthlyTrends.push({
        month: monthName,
        income: monthIncome,
        expense: monthExpense,
        profit: monthIncome - monthExpense
      })
    }

    // Customer profitability - Create map for faster lookup
    const customerWorkOrdersMap = new Map<string, any[]>()
    for (const wo of filteredWorkOrders) {
      if (!customerWorkOrdersMap.has(wo.customerId)) {
        customerWorkOrdersMap.set(wo.customerId, [])
      }
      customerWorkOrdersMap.get(wo.customerId)!.push(wo)
    }

    const customerProfitability = []
    for (const customer of customers) {
      const customerWorkOrders = customerWorkOrdersMap.get(customer.id) || []
      if (customerWorkOrders.length === 0) continue

      let totalRevenue = 0
      for (const wo of customerWorkOrders) {
        totalRevenue += (wo.paidAmount || 0)
      }

      customerProfitability.push({
        customerName: customer.name,
        totalRevenue,
        workCount: customerWorkOrders.length
      })
    }

    // Sort and get top 10
    customerProfitability.sort((a, b) => b.totalRevenue - a.totalRevenue)
    const topCustomers = customerProfitability.slice(0, 10).map(c => ({
      name: c.customerName,
      revenue: c.totalRevenue,
      workCount: c.workCount
    }))

    // Personnel performance - Create map for faster lookup
    const personnelWorkOrdersMap = new Map<string, any[]>()
    for (const wo of filteredWorkOrders) {
      if (wo.status === 'completed' && wo.personnelIds) {
        for (const pid of wo.personnelIds) {
          if (!personnelWorkOrdersMap.has(pid)) {
            personnelWorkOrdersMap.set(pid, [])
          }
          personnelWorkOrdersMap.get(pid)!.push(wo)
        }
      }
    }

    const personnelPerformance = []
    for (const person of personnel) {
      if (!person.active) continue

      const personWorkOrders = personnelWorkOrdersMap.get(person.id) || []
      if (personWorkOrders.length === 0) continue

      let totalRevenue = 0
      for (const wo of personWorkOrders) {
        totalRevenue += (wo.paidAmount || 0)
      }

      personnelPerformance.push({
        personnelName: person.name,
        totalRevenue,
        workCount: personWorkOrders.length
      })
    }

    personnelPerformance.sort((a, b) => b.workCount - a.workCount)

    // Service breakdown - optimized
    const serviceMap = new Map()
    
    for (const t of filteredTransactions) {
      if (t.type === 'income') {
        const category = t.category || 'Diğer'
        if (!serviceMap.has(category)) {
          serviceMap.set(category, { count: 0, revenue: 0 })
        }
        const current = serviceMap.get(category)
        current.count++
        current.revenue += t.amount || 0
      }
    }
    
    for (const c of filteredCollections) {
      const category = 'Temizlik Hizmeti'
      if (!serviceMap.has(category)) {
        serviceMap.set(category, { count: 0, revenue: 0 })
      }
      const current = serviceMap.get(category)
      current.count++
      current.revenue += c.amount || 0
    }

    const serviceBreakdown = Array.from(serviceMap.entries())
      .map(([category, data]: [string, any]) => ({
        category,
        count: data.count,
        revenue: data.revenue
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // Collection rates - use ALL work orders for historical accuracy
    let totalBilled = 0
    let totalCollected = 0
    for (const wo of workOrders) {
      totalBilled += (wo.totalAmount || 0)
      totalCollected += (wo.paidAmount || 0)
    }
    const outstanding = totalBilled - totalCollected
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0

    // Monthly stats (this month vs last month)
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`

    let thisMonthCollections = 0
    let thisMonthIncomeTransactions = 0
    let lastMonthCollections = 0
    let lastMonthIncomeTransactions = 0
    let thisMonthExpense = 0
    let lastMonthExpense = 0
    let thisMonthWorkOrders = 0
    let lastMonthWorkOrders = 0

    // Single pass through collections
    for (const c of filteredCollections) {
      if (c.date?.startsWith(thisMonth)) {
        thisMonthCollections += (c.amount || 0)
      } else if (c.date?.startsWith(lastMonthStr)) {
        lastMonthCollections += (c.amount || 0)
      }
    }

    // Single pass through transactions
    for (const t of filteredTransactions) {
      if (t.date?.startsWith(thisMonth)) {
        if (t.type === 'income') {
          thisMonthIncomeTransactions += (t.amount || 0)
        } else if (t.type === 'expense') {
          thisMonthExpense += (t.amount || 0)
        }
      } else if (t.date?.startsWith(lastMonthStr)) {
        if (t.type === 'income') {
          lastMonthIncomeTransactions += (t.amount || 0)
        } else if (t.type === 'expense') {
          lastMonthExpense += (t.amount || 0)
        }
      }
    }

    // Single pass through work orders
    for (const wo of filteredWorkOrders) {
      if (wo.date?.startsWith(thisMonth)) {
        thisMonthWorkOrders++
      } else if (wo.date?.startsWith(lastMonthStr)) {
        lastMonthWorkOrders++
      }
    }

    const thisMonthIncome = thisMonthCollections + thisMonthIncomeTransactions
    const lastMonthIncome = lastMonthCollections + lastMonthIncomeTransactions

    console.log(`📊 Analytics: Completed in ${Date.now() - startTime}ms`)

    return c.json({
      monthlyTrends,
      customerProfitability,
      topCustomers,
      personnelPerformance,
      serviceBreakdown,
      collectionRates: {
        totalBilled,
        totalCollected,
        outstanding,
        collectionRate
      },
      monthlyStats: {
        currentMonth: {
          income: thisMonthIncome,
          expense: thisMonthExpense,
          profit: thisMonthIncome - thisMonthExpense,
          workOrders: thisMonthWorkOrders
        },
        previousMonth: {
          income: lastMonthIncome,
          expense: lastMonthExpense,
          profit: lastMonthIncome - lastMonthExpense,
          workOrders: lastMonthWorkOrders
        }
      }
    })
  } catch (error) {
    console.log('Server error fetching analytics:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// MIGRATION ROUTE - Sync Work Order Collections
// ============================

app.post('/make-server-882c4243/migrate-collections', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    console.log('=== Starting Collection Migration ===')
    
    // Get all work orders and existing collections
    const [allWorkOrders, allCollections] = await Promise.all([
      getAllByPrefix('workorder:'),
      getAllByPrefix('collection:')
    ])

    console.log(`Found ${allWorkOrders.length} total work orders`)
    console.log(`Found ${allCollections.length} existing collections`)
    
    const paidWorkOrders = allWorkOrders.filter((wo: any) => wo.paidAmount && wo.paidAmount > 0)
    const draftWorkOrders = allWorkOrders.filter((wo: any) => wo.status === 'draft')
    console.log(`- ${paidWorkOrders.length} work orders with payments`)
    console.log(`- ${draftWorkOrders.length} draft work orders (will be skipped)`)

    // Create a map of existing collections by work order ID
    const existingCollectionsByWorkOrder = new Map()
    allCollections.forEach((col: any) => {
      if (col.relatedWorkOrderId) {
        if (!existingCollectionsByWorkOrder.has(col.relatedWorkOrderId)) {
          existingCollectionsByWorkOrder.set(col.relatedWorkOrderId, [])
        }
        existingCollectionsByWorkOrder.get(col.relatedWorkOrderId).push(col)
      }
    })

    let created = 0
    let skipped = 0

    for (const workOrder of allWorkOrders) {
      // Skip if work order has no paid amount
      if (!workOrder.paidAmount || workOrder.paidAmount <= 0) {
        skipped++
        continue
      }

      // Skip if status is draft (unless it was auto-approved during creation)
      if (workOrder.status === 'draft') {
        skipped++
        continue
      }

      // Check if collection already exists for this work order
      const existingCollections = existingCollectionsByWorkOrder.get(workOrder.id) || []
      const totalExistingAmount = existingCollections.reduce((sum: number, col: any) => sum + (col.amount || 0), 0)
      
      // If total existing collections match the paid amount, skip
      if (totalExistingAmount >= workOrder.paidAmount) {
        skipped++
        continue
      }

      // Create collection for the missing amount
      const amountToCreate = workOrder.paidAmount - totalExistingAmount

      // Get customer name
      const customer = await kv.get(workOrder.customerId)
      const customerName = customer?.name || 'Bilinmiyor'

      // Create collection record
      const collectionId = `collection:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const collection = {
        id: collectionId,
        customerId: workOrder.customerId,
        customerName: customerName,
        amount: amountToCreate,
        date: workOrder.date,
        description: workOrder.description || 'İş emri tahsilatı',
        workDate: workOrder.date,
        relatedWorkOrderId: workOrder.id,
        createdAt: new Date().toISOString(),
        createdBy: workOrder.createdBy || user.id,
        createdByName: workOrder.createdByName || user.user_metadata?.name
      }
      
      await kv.set(collectionId, collection)
      created++

      console.log(`✓ Created collection for work order ${workOrder.id}: ${amountToCreate} TL`)
      
      // Small delay to ensure unique IDs
      await new Promise(resolve => setTimeout(resolve, 5))
    }

    console.log(`\n=== Migration Complete ===`)
    console.log(`✓ Created: ${created} new collections`)
    console.log(`- Skipped: ${skipped} work orders`)
    console.log(`Total collections now: ${allCollections.length + created}`)

    // Log the migration
    await kv.set(`log:${Date.now()}`, {
      action: 'collections_migrated',
      userId: user.id,
      userName: user.user_metadata?.name,
      created,
      skipped,
      timestamp: new Date().toISOString()
    })

    return c.json({ 
      success: true, 
      created,
      skipped,
      message: `Migration complete: ${created} collections created, ${skipped} work orders skipped`
    })
  } catch (error) {
    console.log('Server error during migration:', error)
    return c.json({ error: String(error) }, 500)
  }
})

Deno.serve(app.fetch)

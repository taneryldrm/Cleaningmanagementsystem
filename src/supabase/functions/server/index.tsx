import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { logger } from 'npm:hono/logger'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as kv from './kv_store.tsx'

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

    const customers = await kv.getByPrefix('customer:')
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
    const { name, type, contactInfo, address, notes } = body

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

    const personnel = await kv.getByPrefix('personnel:')
    return c.json({ personnel })
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
    const { name, role: personnelRole, contactInfo, notes } = body

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
    await kv.del(personnelId)

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'personnel_deleted',
      userId: user.id,
      userName: user.user_metadata?.name,
      personnelId,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true })
  } catch (error) {
    console.log('Server error deleting personnel:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// WORK ORDER ROUTES
// ============================

app.get('/make-server-882c4243/work-orders', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const workOrders = await kv.getByPrefix('workorder:')
    
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
    const { customerId, personnelIds, date, description, estimatedAmount, autoApprove } = body

    if (!customerId || !date) {
      return c.json({ error: 'Customer and date are required' }, 400)
    }

    const workOrderId = `workorder:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const workOrder = {
      id: workOrderId,
      customerId,
      personnelIds: personnelIds || [],
      date,
      description: description || '',
      estimatedAmount: estimatedAmount || 0,
      actualAmount: 0,
      status: autoApprove ? 'approved' : 'draft',
      approvedAt: autoApprove ? new Date().toISOString() : null,
      completedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }

    await kv.set(workOrderId, workOrder)

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

// Auto-approve draft work orders
app.post('/make-server-882c4243/auto-approve', async (c) => {
  try {
    const workOrders = await kv.getByPrefix('workorder:')
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

    const transactions = await kv.getByPrefix('transaction:')
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

// ============================
// INVOICE ROUTES
// ============================

app.get('/make-server-882c4243/invoices', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const invoices = await kv.getByPrefix('invoice:')
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
    const { customerId, amount, dueDate, description, workOrderIds } = body

    if (!customerId || !amount || !dueDate) {
      return c.json({ error: 'Customer, amount, and due date are required' }, 400)
    }

    const invoiceId = `invoice:${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const invoice = {
      id: invoiceId,
      invoiceNumber: `INV-${Date.now()}`,
      customerId,
      amount: parseFloat(amount),
      dueDate,
      description: description || '',
      workOrderIds: workOrderIds || [],
      progressPayments: [],
      totalPaid: 0,
      status: 'pending', // pending, partial, paid
      createdAt: new Date().toISOString(),
      createdBy: user.id,
      createdByName: user.user_metadata?.name
    }

    await kv.set(invoiceId, invoice)

    // Update customer balance
    const customer = await kv.get(customerId)
    if (customer) {
      customer.balance = (customer.balance || 0) + parseFloat(amount)
      await kv.set(customerId, customer)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'invoice_created',
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

app.post('/make-server-882c4243/invoices/:id/payment', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const invoiceId = c.req.param('id')
    const body = await c.req.json()
    const { amount, date, description } = body

    const invoice = await kv.get(invoiceId)
    if (!invoice) {
      return c.json({ error: 'Invoice not found' }, 404)
    }

    const paymentAmount = parseFloat(amount)
    invoice.progressPayments = invoice.progressPayments || []
    invoice.progressPayments.push({
      amount: paymentAmount,
      date,
      description: description || '',
      recordedBy: user.user_metadata?.name,
      recordedAt: new Date().toISOString()
    })

    invoice.totalPaid = (invoice.totalPaid || 0) + paymentAmount
    
    // Update status
    if (invoice.totalPaid >= invoice.amount) {
      invoice.status = 'paid'
      invoice.paidAt = new Date().toISOString()
    } else if (invoice.totalPaid > 0) {
      invoice.status = 'partial'
    }

    await kv.set(invoiceId, invoice)

    // Update customer balance
    const customer = await kv.get(invoice.customerId)
    if (customer) {
      customer.balance = (customer.balance || 0) - paymentAmount
      await kv.set(invoice.customerId, customer)
    }

    // Log the action
    await kv.set(`log:${Date.now()}`, {
      action: 'payment_recorded',
      userId: user.id,
      userName: user.user_metadata?.name,
      invoiceId,
      amount: paymentAmount,
      timestamp: new Date().toISOString()
    })

    return c.json({ success: true, invoice })
  } catch (error) {
    console.log('Server error recording payment:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// DASHBOARD ROUTES
// ============================

app.get('/make-server-882c4243/dashboard', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const role = user.user_metadata?.role

    // Get today's work orders
    const today = new Date().toISOString().split('T')[0]
    const allWorkOrders = await kv.getByPrefix('workorder:')
    const todayWorkOrders = allWorkOrders.filter((wo: any) => 
      wo.date && wo.date.startsWith(today)
    )

    // Get draft work orders count
    const draftCount = allWorkOrders.filter((wo: any) => wo.status === 'draft').length

    // Calculate financial summary
    const transactions = await kv.getByPrefix('transaction:')
    const income = transactions
      .filter((t: any) => t.type === 'income')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)
    const expense = transactions
      .filter((t: any) => t.type === 'expense')
      .reduce((sum: number, t: any) => sum + (t.amount || 0), 0)

    // Get pending invoices
    const invoices = await kv.getByPrefix('invoice:')
    const pendingInvoices = invoices.filter((inv: any) => inv.status !== 'paid')

    // Get overdue invoices
    const overdueInvoices = pendingInvoices.filter((inv: any) => {
      return inv.dueDate && new Date(inv.dueDate) < new Date()
    })

    // Role-specific data
    let roleSpecificData = {}
    if (role === 'driver') {
      roleSpecificData = {
        todayAssignments: todayWorkOrders.map((wo: any) => ({
          ...wo,
          personnelCount: wo.personnelIds?.length || 0
        }))
      }
    } else if (role === 'cleaner') {
      const myWorkOrders = todayWorkOrders.filter((wo: any) => 
        wo.personnelIds && wo.personnelIds.includes(user.id)
      )
      roleSpecificData = {
        myTasks: myWorkOrders
      }
    }

    return c.json({
      todayWorkOrders: todayWorkOrders.length,
      draftCount,
      income,
      expense,
      balance: income - expense,
      pendingInvoices: pendingInvoices.length,
      overdueInvoices: overdueInvoices.length,
      totalOutstanding: pendingInvoices.reduce((sum: number, inv: any) => 
        sum + (inv.amount - (inv.totalPaid || 0)), 0
      ),
      ...roleSpecificData
    })
  } catch (error) {
    console.log('Server error fetching dashboard data:', error)
    return c.json({ error: String(error) }, 500)
  }
})

// ============================
// LOGS ROUTE
// ============================

app.get('/make-server-882c4243/logs', async (c) => {
  try {
    const user = await getAuthUser(c.req.raw)
    if (!user || user.user_metadata?.role !== 'admin') {
      return c.json({ error: 'Unauthorized - Admin access required' }, 401)
    }

    const logs = await kv.getByPrefix('log:')
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

Deno.serve(app.fetch)

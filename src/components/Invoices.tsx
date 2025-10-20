import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, FileText, DollarSign, AlertCircle } from 'lucide-react'
import { Textarea } from './ui/textarea'

interface Invoice {
  id: string
  invoiceNumber: string
  customerId: string
  amount: number
  dueDate: string
  description: string
  progressPayments: Array<{
    amount: number
    date: string
    description: string
    recordedBy: string
    recordedAt: string
  }>
  totalPaid: number
  status: 'pending' | 'partial' | 'paid'
  createdByName: string
  createdAt: string
}

export function Invoices({ user }: { user: any }) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const [formData, setFormData] = useState({
    customerId: '',
    amount: '',
    dueDate: '',
    description: ''
  })

  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [invoicesResult, customersResult] = await Promise.all([
        apiCall('/invoices'),
        apiCall('/customers')
      ])
      
      setInvoices(invoicesResult.invoices || [])
      setCustomers(customersResult.customers || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        customerId: formData.customerId,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate,
        description: formData.description
      }

      await apiCall('/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving invoice:', error)
      alert('Fatura kaydedilirken hata oluştu: ' + (error as Error).message)
    }
  }

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedInvoice) return

    try {
      const payload = {
        amount: parseFloat(paymentFormData.amount),
        date: paymentFormData.date,
        description: paymentFormData.description
      }

      await apiCall(`/invoices/${selectedInvoice.id}/payment`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setIsPaymentDialogOpen(false)
      setSelectedInvoice(null)
      resetPaymentForm()
      loadData()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Ödeme kaydedilirken hata oluştu: ' + (error as Error).message)
    }
  }

  const resetForm = () => {
    setFormData({
      customerId: '',
      amount: '',
      dueDate: '',
      description: ''
    })
  }

  const resetPaymentForm = () => {
    setPaymentFormData({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: ''
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    return customer?.name || 'Bilinmiyor'
  }

  const getStatusBadge = (invoice: Invoice) => {
    const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid'
    
    if (invoice.status === 'paid') {
      return <Badge className="bg-green-100 text-green-800">Ödendi</Badge>
    } else if (isOverdue) {
      return <Badge variant="destructive">Vadesi Geçti</Badge>
    } else if (invoice.status === 'partial') {
      return <Badge className="bg-yellow-100 text-yellow-800">Kısmi Ödeme</Badge>
    } else {
      return <Badge variant="outline">Beklemede</Badge>
    }
  }

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'overdue') {
      return new Date(inv.dueDate) < new Date() && inv.status !== 'paid'
    }
    return inv.status === filterStatus
  })

  const totalPending = invoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + (inv.amount - (inv.totalPaid || 0)), 0)

  const overdueCount = invoices.filter(inv => 
    new Date(inv.dueDate) < new Date() && inv.status !== 'paid'
  ).length

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Fatura Yönetimi</h1>
          <p className="text-gray-500">{invoices.length} fatura kayıtlı</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Fatura
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Fatura Oluştur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer">Müşteri *</Label>
                <Select 
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Müşteri seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Tutar (TL) *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Vade Tarihi *</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Açıklama</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Toplam Alacak</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Bekleyen ve kısmi ödemeli faturalar
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Vadesi Geçmiş</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{overdueCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Vadesi geçmiş fatura sayısı
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Faturalar</SelectItem>
                <SelectItem value="pending">Bekleyen</SelectItem>
                <SelectItem value="partial">Kısmi Ödeme</SelectItem>
                <SelectItem value="paid">Ödenen</SelectItem>
                <SelectItem value="overdue">Vadesi Geçmiş</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices List */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Fatura bulunamadı
            </CardContent>
          </Card>
        ) : (
          filteredInvoices
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((invoice) => {
              const remaining = invoice.amount - (invoice.totalPaid || 0)
              
              return (
                <Card key={invoice.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {invoice.invoiceNumber}
                          {getStatusBadge(invoice)}
                        </CardTitle>
                        <div className="text-sm text-gray-500 mt-2">
                          <div>Müşteri: {getCustomerName(invoice.customerId)}</div>
                          <div>Vade: {new Date(invoice.dueDate).toLocaleDateString('tr-TR')}</div>
                          <div>Oluşturan: {invoice.createdByName || 'Bilinmiyor'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Tutar</div>
                        <div className="text-2xl">{formatCurrency(invoice.amount)}</div>
                        {invoice.totalPaid > 0 && (
                          <>
                            <div className="text-sm text-green-600 mt-1">
                              Ödenen: {formatCurrency(invoice.totalPaid)}
                            </div>
                            <div className="text-sm text-red-600">
                              Kalan: {formatCurrency(remaining)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {invoice.description && (
                      <p className="text-sm text-gray-600">{invoice.description}</p>
                    )}
                    
                    {/* Progress Payments */}
                    {invoice.progressPayments && invoice.progressPayments.length > 0 && (
                      <div className="border-t pt-3">
                        <div className="text-sm font-medium mb-2">Hakediş Ödemeleri:</div>
                        <div className="space-y-1">
                          {invoice.progressPayments.map((payment, idx) => (
                            <div key={idx} className="text-sm text-gray-600 flex justify-between">
                              <span>
                                {new Date(payment.date).toLocaleDateString('tr-TR')} 
                                {payment.description && ` - ${payment.description}`}
                              </span>
                              <span className="text-green-600">
                                {formatCurrency(payment.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {invoice.status !== 'paid' && (
                      <div className="flex gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedInvoice(invoice)
                            setPaymentFormData({
                              ...paymentFormData,
                              amount: remaining.toString()
                            })
                            setIsPaymentDialogOpen(true)
                          }}
                        >
                          <DollarSign className="h-4 w-4 mr-1" />
                          Hakediş Ekle
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={(open) => {
        setIsPaymentDialogOpen(open)
        if (!open) {
          setSelectedInvoice(null)
          resetPaymentForm()
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hakediş Ödeme Ekle</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="mb-4 p-3 bg-gray-50 rounded">
              <div className="text-sm">
                <div>Fatura: {selectedInvoice.invoiceNumber}</div>
                <div>Müşteri: {getCustomerName(selectedInvoice.customerId)}</div>
                <div className="font-medium mt-1">
                  Kalan Tutar: {formatCurrency(selectedInvoice.amount - (selectedInvoice.totalPaid || 0))}
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="paymentAmount">Tutar (TL) *</Label>
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Tarih *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentFormData.date}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDescription">Açıklama</Label>
              <Textarea
                id="paymentDescription"
                value={paymentFormData.description}
                onChange={(e) => setPaymentFormData({ ...paymentFormData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

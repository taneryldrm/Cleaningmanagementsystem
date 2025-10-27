import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, TrendingUp, TrendingDown, Filter, Trash2 } from 'lucide-react'
import { Textarea } from './ui/textarea'

interface Transaction {
  id: string
  type: 'income' | 'expense'
  amount: number
  date: string
  category: string
  description: string
  relatedCustomerId: string | null
  createdByName: string
  createdAt: string
}

export function Finance({ user }: { user: any }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [filterType, setFilterType] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const userRole = user?.user_metadata?.role
  const canDelete = userRole === 'admin'

  const [formData, setFormData] = useState({
    type: 'income' as 'income' | 'expense',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    relatedCustomerId: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [transactionsResult, customersResult] = await Promise.all([
        apiCall('/transactions'),
        apiCall('/customers')
      ])
      
      setTransactions(transactionsResult.transactions || [])
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
        type: formData.type,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        description: formData.description,
        relatedCustomerId: formData.relatedCustomerId && formData.relatedCustomerId !== 'none' ? formData.relatedCustomerId : null
      }

      await apiCall('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert('İşlem kaydedilirken hata oluştu: ' + (error as Error).message)
    }
  }

  const resetForm = () => {
    setFormData({
      type: 'income',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      relatedCustomerId: ''
    })
  }

  const handleDelete = async (transactionId: string) => {
    if (!confirm('Bu işlemi silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/transactions/${transactionId}`, { method: 'DELETE' })
      loadData()
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('İşlem silinirken hata oluştu: ' + (error as Error).message)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return null
    const customer = customers.find(c => c.id === customerId)
    return customer?.name
  }

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (startDate && t.date < startDate) return false
    if (endDate && t.date > endDate) return false
    return true
  })

  // Calculate totals
  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  const balance = totalIncome - totalExpense

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Gelir-Gider Yönetimi</h1>
          <p className="text-gray-500">{transactions.length} işlem kayıtlı</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni İşlem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Yeni Gelir/Gider Kaydı</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">İşlem Tipi *</Label>
                <Select 
                  value={formData.type}
                  onValueChange={(value: 'income' | 'expense') => 
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Gelir</SelectItem>
                    <SelectItem value="expense">Gider</SelectItem>
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
                  <Label htmlFor="date">Tarih *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="ör: Personel Maaşı, Müşteri Ödemesi"
                />
              </div>
              {formData.type === 'income' && (
                <div className="space-y-2">
                  <Label htmlFor="customer">İlgili Müşteri (Opsiyonel)</Label>
                  <Select 
                    value={formData.relatedCustomerId}
                    onValueChange={(value) => 
                      setFormData({ ...formData, relatedCustomerId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Müşteri seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seçim Yok</SelectItem>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Toplam Gelir</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-green-600">{formatCurrency(totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Toplam Gider</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{formatCurrency(totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Net Bakiye</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl ${balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {formatCurrency(balance)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label>İşlem Tipi</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="income">Gelir</SelectItem>
                  <SelectItem value="expense">Gider</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Başlangıç Tarihi</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Bitiş Tarihi</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setFilterType('all')
                setStartDate('')
                setEndDate('')
              }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <div className="space-y-3">
        {filteredTransactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              İşlem bulunamadı
            </CardContent>
          </Card>
        ) : (
          filteredTransactions
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((transaction) => (
              <Card key={transaction.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {transaction.type === 'income' ? (
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className="font-medium">
                          {transaction.category || (transaction.type === 'income' ? 'Gelir' : 'Gider')}
                        </span>
                        <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                          {transaction.type === 'income' ? 'Gelir' : 'Gider'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {transaction.description || 'Açıklama yok'}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm text-gray-500">
                        <span>
                          {new Date(transaction.date).toLocaleDateString('tr-TR')}
                        </span>
                        {getCustomerName(transaction.relatedCustomerId) && (
                          <span>Müşteri: {getCustomerName(transaction.relatedCustomerId)}</span>
                        )}
                        <span>Kaydeden: {transaction.createdByName || 'Bilinmiyor'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`text-2xl ${
                        transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(transaction.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>
    </div>
  )
}

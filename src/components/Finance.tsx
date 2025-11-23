import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Plus, Search } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { TransactionCard } from './finance/TransactionCard'
import { TransactionCardSkeleton } from './finance/TransactionCardSkeleton'
import { TransactionSummary } from './finance/TransactionSummary'
import { TransactionFilters } from './finance/TransactionFilters'
import { LoadingSpinner } from './finance/LoadingSpinner'

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
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  
  // Infinite scroll states
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const observerTarget = useRef<HTMLDivElement>(null)

  // Global summary (never changes with scroll)
  const [globalSummary, setGlobalSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0
  })

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
    loadInitialData()
  }, [])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMoreTransactions()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current)
      }
    }
  }, [hasMore, loadingMore, loading])

  const loadInitialData = async () => {
    setLoading(true)
    try {
      const [transactionsResult, customersResult, summaryResult] = await Promise.all([
        apiCall('/transactions?offset=0&limit=30'),
        apiCall('/customers'),
        apiCall('/transactions/summary')
      ])
      
      setTransactions(transactionsResult.transactions || [])
      setCustomers(customersResult.customers || [])
      setHasMore(transactionsResult.hasMore || false)
      setTotalCount(transactionsResult.total || 0)
      setPage(1)
      
      // Set global summary (never changes with scroll)
      setGlobalSummary({
        totalIncome: summaryResult.totalIncome || 0,
        totalExpense: summaryResult.totalExpense || 0,
        balance: summaryResult.balance || 0
      })
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMoreTransactions = useCallback(async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    try {
      const offset = page * 30
      const result = await apiCall(`/transactions?offset=${offset}&limit=30`)
      
      setTransactions(prev => [...prev, ...(result.transactions || [])])
      setHasMore(result.hasMore || false)
      setPage(prev => prev + 1)
    } catch (error) {
      console.error('Error loading more transactions:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [page, hasMore, loadingMore])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        type: formData.type,
        amount: parseFloat(formData.amount),
        date: formData.date,
        category: formData.category,
        description: formData.description,
        relatedCustomerId: formData.relatedCustomerId && formData.relatedCustomerId !== 'none' 
          ? formData.relatedCustomerId 
          : null
      }

      await apiCall('/transactions', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setIsDialogOpen(false)
      resetForm()
      
      // Reset and reload
      setPage(0)
      setHasMore(true)
      loadInitialData()
    } catch (error) {
      console.error('Error saving transaction:', error)
      alert('İşlem kaydedilirken hata oluştu: ' + (error as Error).message)
    }
  }, [formData])

  const resetForm = () => {
    setFormData({
      type: 'income',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      category: '',
      description: '',
      relatedCustomerId: ''
    })
    setCustomerSearchQuery('')
  }

  const handleDelete = useCallback(async (transactionId: string) => {
    if (!confirm('Bu işlemi silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/transactions/${transactionId}`, { method: 'DELETE' })
      
      // Reset and reload
      setPage(0)
      setHasMore(true)
      loadInitialData()
    } catch (error) {
      console.error('Error deleting transaction:', error)
      alert('İşlem silinirken hata oluştu: ' + (error as Error).message)
    }
  }, [])

  const getCustomerName = useCallback((customerId: string | null) => {
    if (!customerId) return null
    const customer = customers.find(c => c.id === customerId)
    return customer?.name
  }, [customers])

  const clearFilters = () => {
    setFilterType('all')
    setStartDate('')
    setEndDate('')
  }

  // Filter transactions - Memoized to prevent recalculation on every render
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.type !== filterType) return false
      if (startDate && t.date < startDate) return false
      if (endDate && t.date > endDate) return false
      return true
    })
  }, [transactions, filterType, startDate, endDate])

  // Check if filters are active - Memoized
  const hasActiveFilters = useMemo(() => {
    return filterType !== 'all' || startDate !== '' || endDate !== ''
  }, [filterType, startDate, endDate])

  // Calculate display totals based on filter status - Memoized
  const displayTotals = useMemo(() => {
    if (hasActiveFilters) {
      // If filters are active, calculate from filtered transactions
      const displayIncome = filteredTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const displayExpense = filteredTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const displayBalance = displayIncome - displayExpense

      return { displayIncome, displayExpense, displayBalance }
    } else {
      // If no filters, use global summary (all data from database)
      return {
        displayIncome: globalSummary.totalIncome,
        displayExpense: globalSummary.totalExpense,
        displayBalance: globalSummary.balance
      }
    }
  }, [hasActiveFilters, filteredTransactions, globalSummary])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner text="Veriler yükleniyor..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Sticky on mobile */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl">Gelir-Gider Yönetimi</h1>
              <p className="text-sm text-gray-500 mt-1">
                {totalCount.toLocaleString('tr-TR')} işlem kayıtlı
                {filteredTransactions.length !== transactions.length && (
                  <span className="ml-2">
                    • {filteredTransactions.length.toLocaleString('tr-TR')} gösteriliyor
                  </span>
                )}
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button className="shadow-md">
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni İşlem
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  
                  {formData.type === 'income' && (() => {
                    const filteredCustomers = customerSearchQuery.trim() 
                      ? customers.filter(customer => {
                          const query = customerSearchQuery.toLowerCase()
                          const nameMatch = customer.name?.toLowerCase().includes(query)
                          const phoneMatch = customer.contactInfo?.phone?.includes(query)
                          return nameMatch || phoneMatch
                        })
                      : []
                    
                    return (
                      <div className="space-y-2">
                        <Label htmlFor="customer">İlgili Müşteri (Opsiyonel)</Label>
                        <Select 
                          value={formData.relatedCustomerId}
                          onValueChange={(value) => {
                            setFormData({ ...formData, relatedCustomerId: value })
                            setCustomerSearchQuery('')
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Müşteri seçin" />
                          </SelectTrigger>
                          <SelectContent>
                            <div className="sticky top-0 z-10 bg-white p-2 border-b">
                              <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  placeholder="Müşteri adı veya telefon..."
                                  value={customerSearchQuery}
                                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                  className="pl-10 h-9"
                                />
                              </div>
                            </div>
                            
                            <div className="max-h-[300px] overflow-y-auto">
                              <SelectItem value="none">Seçim Yok</SelectItem>
                              {customerSearchQuery.trim() === '' ? (
                                <div className="p-4 text-center text-sm text-gray-500">
                                  Aramak için müşteri adı veya telefon giriniz
                                </div>
                              ) : filteredCustomers.length > 0 ? (
                                filteredCustomers.map((customer) => (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name} {customer.contactInfo?.phone && `(${customer.contactInfo.phone})`}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-4 text-center text-sm text-gray-500">
                                  Sonuç bulunamadı
                                </div>
                              )}
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                    )
                  })()}
                  
                  <div className="space-y-2">
                    <Label htmlFor="description">Açıklama</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      İptal
                    </Button>
                    <Button type="submit">Kaydet</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <TransactionSummary
          totalIncome={displayTotals.displayIncome}
          totalExpense={displayTotals.displayExpense}
          balance={displayTotals.displayBalance}
        />

        {/* Filters */}
        <TransactionFilters
          filterType={filterType}
          startDate={startDate}
          endDate={endDate}
          onFilterTypeChange={setFilterType}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClearFilters={clearFilters}
        />

        {/* Transactions Feed */}
        <div className="space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-500">İşlem bulunamadı</p>
              {(filterType !== 'all' || startDate || endDate) && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  Filtreleri Temizle
                </Button>
              )}
            </div>
          ) : (
            <>
              {filteredTransactions.map((transaction) => (
                <TransactionCard
                  key={transaction.id}
                  transaction={transaction}
                  customerName={getCustomerName(transaction.relatedCustomerId)}
                  canDelete={canDelete}
                  onDelete={handleDelete}
                />
              ))}
              
              {/* Loading More Indicator */}
              {loadingMore && (
                <div className="space-y-3">
                  <TransactionCardSkeleton />
                  <TransactionCardSkeleton />
                  <TransactionCardSkeleton />
                </div>
              )}
              
              {/* Scroll Observer Target */}
              <div ref={observerTarget} className="h-10" />
              
              {/* End Message */}
              {!hasMore && filteredTransactions.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    Tüm işlemler yüklendi ({filteredTransactions.length} kayıt)
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
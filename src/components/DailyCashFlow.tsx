import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Calendar, Edit, Plus, Trash2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

interface Customer {
  id: string
  name: string
}

interface CustomerCollection {
  id: string
  customerId: string
  customerName: string
  workDate: string
  amount: number
  date: string
  description?: string
  relatedWorkOrderId?: string
}

interface GeneralExpense {
  id: string
  description: string
  invoiceDate: string
  invoiceNo: string
  amount: number
  date: string
}

interface CashFlowSummary {
  totalCollection: number
  totalWagesPaid: number
  previousMonthCash: number
  todayCashTotal: number
  totalExpenses: number
  totalWageDebt: number
  totalAccruedWages: number
}

export function DailyCashFlow({ user }: { user: any }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [collections, setCollections] = useState<CustomerCollection[]>([])
  const [expenses, setExpenses] = useState<GeneralExpense[]>([])
  const [summary, setSummary] = useState<CashFlowSummary>({
    totalCollection: 0,
    totalWagesPaid: 0,
    previousMonthCash: 0,
    todayCashTotal: 0,
    totalExpenses: 0,
    totalWageDebt: 0,
    totalAccruedWages: 0
  })
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  
  // Collection dialog state
  const [isCollectionDialogOpen, setIsCollectionDialogOpen] = useState(false)
  const [editingCollection, setEditingCollection] = useState<CustomerCollection | null>(null)
  const [collectionFormData, setCollectionFormData] = useState({
    customerId: '',
    workDate: '',
    amount: '',
    description: ''
  })

  // Expense dialog state
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<GeneralExpense | null>(null)
  const [expenseFormData, setExpenseFormData] = useState({
    description: '',
    invoiceDate: '',
    invoiceNo: '',
    amount: ''
  })

  const userRole = user?.user_metadata?.role
  const canEdit = userRole === 'admin' || userRole === 'secretary'

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = async () => {
    try {
      console.log('Loading cash flow data for date:', selectedDate)
      
      const [customersResult, cashFlowResult] = await Promise.all([
        apiCall('/customers'),
        apiCall(`/cash-flow?date=${selectedDate}`)
      ])
      
      console.log('Cash flow result received:', cashFlowResult)
      console.log('Collections:', cashFlowResult.collections?.map(c => ({ date: c.date, workDate: c.workDate, amount: c.amount })))
      console.log('Expenses:', cashFlowResult.expenses?.map(e => ({ date: e.date, invoiceDate: e.invoiceDate, amount: e.amount })))
      
      setCustomers(customersResult.customers || [])
      setCollections(cashFlowResult.collections || [])
      setExpenses(cashFlowResult.expenses || [])
      setSummary(cashFlowResult.summary || {
        totalCollection: 0,
        totalWagesPaid: 0,
        previousMonthCash: 0,
        todayCashTotal: 0,
        totalExpenses: 0,
        totalWageDebt: 0,
        totalAccruedWages: 0
      })
      
      console.log('Summary set to:', cashFlowResult.summary)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Collection handlers
  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!collectionFormData.customerId || !collectionFormData.amount) {
      alert('Lütfen müşteri ve tutar bilgilerini giriniz')
      return
    }

    try {
      const customer = customers.find(c => c.id === collectionFormData.customerId)
      // Use workDate if provided, otherwise use selectedDate
      const collectionDate = collectionFormData.workDate || selectedDate
      await apiCall('/cash-flow/collection', {
        method: editingCollection ? 'PUT' : 'POST',
        body: JSON.stringify({
          id: editingCollection?.id,
          customerId: collectionFormData.customerId,
          customerName: customer?.name || '',
          workDate: collectionFormData.workDate,
          amount: parseFloat(collectionFormData.amount),
          date: collectionDate,
          description: collectionFormData.description
        })
      })

      setIsCollectionDialogOpen(false)
      resetCollectionForm()
      loadData()
    } catch (error) {
      console.error('Error saving collection:', error)
      alert('Tahsilat kaydedilirken hata oluştu')
    }
  }

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('Bu tahsilat kaydını silmek istediğinize emin misiniz?')) return

    try {
      await apiCall(`/cash-flow/collection/${id}`, { method: 'DELETE' })
      loadData()
    } catch (error) {
      console.error('Error deleting collection:', error)
      alert('Tahsilat silinirken hata oluştu')
    }
  }

  const openCollectionDialog = (collection?: CustomerCollection) => {
    if (collection) {
      setEditingCollection(collection)
      setCollectionFormData({
        customerId: collection.customerId,
        workDate: collection.workDate,
        amount: collection.amount.toString(),
        description: collection.description || ''
      })
    } else {
      resetCollectionForm()
    }
    setIsCollectionDialogOpen(true)
  }

  const resetCollectionForm = () => {
    setCollectionFormData({
      customerId: '',
      workDate: '',
      amount: '',
      description: ''
    })
    setEditingCollection(null)
  }

  // Expense handlers
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expenseFormData.description || !expenseFormData.amount) {
      alert('Lütfen açıklama ve tutar bilgilerini giriniz')
      return
    }

    try {
      // Use invoiceDate if provided, otherwise use selectedDate
      const expenseDate = expenseFormData.invoiceDate || selectedDate
      await apiCall('/cash-flow/expense', {
        method: editingExpense ? 'PUT' : 'POST',
        body: JSON.stringify({
          id: editingExpense?.id,
          description: expenseFormData.description,
          invoiceDate: expenseFormData.invoiceDate,
          invoiceNo: expenseFormData.invoiceNo,
          amount: parseFloat(expenseFormData.amount),
          date: expenseDate
        })
      })

      setIsExpenseDialogOpen(false)
      resetExpenseForm()
      loadData()
    } catch (error) {
      console.error('Error saving expense:', error)
      alert('Gider kaydedilirken hata oluştu')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return

    try {
      await apiCall(`/cash-flow/expense/${id}`, { method: 'DELETE' })
      loadData()
    } catch (error) {
      console.error('Error deleting expense:', error)
      alert('Gider silinirken hata oluştu')
    }
  }

  const openExpenseDialog = (expense?: GeneralExpense) => {
    if (expense) {
      setEditingExpense(expense)
      setExpenseFormData({
        description: expense.description,
        invoiceDate: expense.invoiceDate,
        invoiceNo: expense.invoiceNo,
        amount: expense.amount.toString()
      })
    } else {
      resetExpenseForm()
    }
    setIsExpenseDialogOpen(true)
  }

  const resetExpenseForm = () => {
    setExpenseFormData({
      description: '',
      invoiceDate: '',
      invoiceNo: '',
      amount: ''
    })
    setEditingExpense(null)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Date Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Calendar className="h-5 w-5 text-gray-500" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto"
              />
              <Button
                variant="outline"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              >
                Bugün
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Two-Column Layout */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6">
        {/* Left Column - Customer Collections */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>GÜNLÜK MÜŞTERİ TAHSİLAT</span>
              {canEdit && (
                <Button size="sm" onClick={() => openCollectionDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ekle
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-2 text-left text-xs">SIRA NO</th>
                    <th className="border px-2 py-2 text-left text-xs">MÜŞTERİ İSMİ</th>
                    <th className="border px-2 py-2 text-left text-xs">AÇIKLAMA</th>
                    <th className="border px-2 py-2 text-left text-xs">İŞ TARİHİ</th>
                    <th className="border px-2 py-2 text-right text-xs">TAHSİLAT</th>
                    {canEdit && <th className="border px-2 py-2 text-center text-xs">İŞLEM</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(15)].map((_, idx) => {
                    const collection = collections[idx]
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border px-2 py-2 text-sm">{idx + 1}</td>
                        <td className="border px-2 py-2 text-sm">{collection?.customerName || ''}</td>
                        <td className="border px-2 py-2 text-sm text-gray-600 italic">
                          {collection?.description || ''}
                        </td>
                        <td className="border px-2 py-2 text-sm">
                          {collection?.workDate ? new Date(collection.workDate).toLocaleDateString('tr-TR') : ''}
                        </td>
                        <td className="border px-2 py-2 text-sm text-right">
                          {collection ? collection.amount.toLocaleString('tr-TR') : '0'}
                        </td>
                        {canEdit && (
                          <td className="border px-2 py-2 text-center">
                            {collection && (
                              <div className="flex items-center justify-center gap-1">
                                {collection.relatedWorkOrderId ? (
                                  <span className="text-xs text-blue-600" title="Bu tahsilat iş emrinden otomatik oluşturuldu">
                                    🔒 Otomatik
                                  </span>
                                ) : (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => openCollectionDialog(collection)}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteCollection(collection.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {/* Summary rows */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td colSpan={4} className="border px-2 py-2 text-sm">BUGÜN TAHSİLAT TOPLAMI</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.totalCollection.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                  <tr className="bg-yellow-50 font-semibold">
                    <td colSpan={4} className="border px-2 py-2 text-sm">BUGÜN ÖDENEN YÖMİYELER TOPLAMI</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.totalWagesPaid.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                  <tr className="bg-yellow-50 font-semibold">
                    <td colSpan={4} className="border px-2 py-2 text-sm">GEÇEN AY KASA DEVRİ</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.previousMonthCash.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                  <tr className="bg-blue-100 font-semibold">
                    <td colSpan={4} className="border px-2 py-2 text-sm">BUGÜN KASA TOPLAMI</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.todayCashTotal.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Right Column - General Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>GÜNLÜK NAKİT GENEL GİDERLER</span>
              {canEdit && (
                <Button size="sm" onClick={() => openExpenseDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ekle
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-2 py-2 text-left text-xs">HARCAMA DETAYI</th>
                    <th className="border px-2 py-2 text-left text-xs">TARİHİ VE FİŞ NO</th>
                    <th className="border px-2 py-2 text-right text-xs">HARCAMA TUTARI</th>
                    {canEdit && <th className="border px-2 py-2 text-center text-xs">İŞLEM</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(15)].map((_, idx) => {
                    const expense = expenses[idx]
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border px-2 py-2 text-sm">{expense?.description || ''}</td>
                        <td className="border px-2 py-2 text-sm">
                          {expense ? `${expense.invoiceDate ? new Date(expense.invoiceDate).toLocaleDateString('tr-TR') : ''} ${expense.invoiceNo || ''}` : ''}
                        </td>
                        <td className="border px-2 py-2 text-sm text-right">
                          {expense ? expense.amount.toLocaleString('tr-TR') : '0'}
                        </td>
                        {canEdit && (
                          <td className="border px-2 py-2 text-center">
                            {expense && (
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openExpenseDialog(expense)}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteExpense(expense.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {/* Summary rows */}
                  <tr className="bg-yellow-50 font-semibold">
                    <td colSpan={2} className="border px-2 py-2 text-sm">BUGÜN ÖDENEN GİDERLER TOPLAMI</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.totalExpenses.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                  <tr className="bg-yellow-50 font-semibold">
                    <td colSpan={2} className="border px-2 py-2 text-sm">BUGÜN İTİBARİYLE TOPLAM YÖMİYE BORCU</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.totalWageDebt.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                  <tr className="bg-blue-100 font-semibold">
                    <td colSpan={2} className="border px-2 py-2 text-sm">BUGÜN TAHAKKUK ÖDEN YÖMİYE TOPLAMI</td>
                    <td className="border px-2 py-2 text-sm text-right">
                      {summary.totalAccruedWages.toLocaleString('tr-TR')}
                    </td>
                    {canEdit && <td className="border"></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile View - Stacked Cards */}
      <div className="lg:hidden space-y-6">
        {/* Customer Collections Mobile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>MÜŞTERİ TAHSİLAT</span>
              {canEdit && (
                <Button size="sm" onClick={() => openCollectionDialog()}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {collections.map((collection, idx) => (
              <div key={collection.id} className="p-3 border rounded-md">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm">{idx + 1}. {collection.customerName}</div>
                    {collection.description && (
                      <div className="text-xs text-gray-600 italic mt-1">
                        {collection.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(collection.workDate).toLocaleDateString('tr-TR')}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      {collection.relatedWorkOrderId ? (
                        <span className="text-xs text-blue-600 px-2 py-1 bg-blue-50 rounded" title="Bu tahsilat iş emrinden otomatik oluşturuldu">
                          🔒 Otomatik
                        </span>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openCollectionDialog(collection)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteCollection(collection.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="text-right font-semibold">{collection.amount.toLocaleString('tr-TR')} ₺</div>
              </div>
            ))}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span>Tahsilat Toplamı:</span>
                <span className="font-semibold">{summary.totalCollection.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Ödenen Yömiyeler:</span>
                <span className="font-semibold">{summary.totalWagesPaid.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Geçen Ay Devir:</span>
                <span className="font-semibold">{summary.previousMonthCash.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-sm font-semibold bg-blue-50 p-2 rounded">
                <span>Kasa Toplamı:</span>
                <span>{summary.todayCashTotal.toLocaleString('tr-TR')} ₺</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* General Expenses Mobile */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>GENEL GİDERLER</span>
              {canEdit && (
                <Button size="sm" onClick={() => openExpenseDialog()}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenses.map((expense) => (
              <div key={expense.id} className="p-3 border rounded-md">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm">{expense.description}</div>
                    <div className="text-xs text-gray-500">
                      {expense.invoiceDate && new Date(expense.invoiceDate).toLocaleDateString('tr-TR')} {expense.invoiceNo}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openExpenseDialog(expense)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteExpense(expense.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="text-right font-semibold">{expense.amount.toLocaleString('tr-TR')} ₺</div>
              </div>
            ))}
            <div className="space-y-2 pt-3 border-t">
              <div className="flex justify-between text-sm">
                <span>Giderler Toplamı:</span>
                <span className="font-semibold">{summary.totalExpenses.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Toplam Yömiye Borcu:</span>
                <span className="font-semibold">{summary.totalWageDebt.toLocaleString('tr-TR')} ₺</span>
              </div>
              <div className="flex justify-between text-sm font-semibold bg-blue-50 p-2 rounded">
                <span>Tahakkuk Yömiye:</span>
                <span>{summary.totalAccruedWages.toLocaleString('tr-TR')} ₺</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection Dialog */}
      <Dialog open={isCollectionDialogOpen} onOpenChange={(open) => {
        setIsCollectionDialogOpen(open)
        if (!open) resetCollectionForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCollection ? 'Tahsilat Düzenle' : 'Yeni Tahsilat'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCollection} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerId">Müşteri *</Label>
              <Select
                value={collectionFormData.customerId}
                onValueChange={(value) => setCollectionFormData({ ...collectionFormData, customerId: value })}
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
            <div className="space-y-2">
              <Label htmlFor="workDate">İşin Yapıldığı Tarih</Label>
              <Input
                id="workDate"
                type="date"
                value={collectionFormData.workDate}
                onChange={(e) => setCollectionFormData({ ...collectionFormData, workDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collectionDescription">Açıklama</Label>
              <Input
                id="collectionDescription"
                type="text"
                value={collectionFormData.description}
                onChange={(e) => setCollectionFormData({ ...collectionFormData, description: e.target.value })}
                placeholder="Ödeme açıklaması (opsiyonel)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collectionAmount">Tahsilat Miktarı (₺) *</Label>
              <Input
                id="collectionAmount"
                type="number"
                step="0.01"
                value={collectionFormData.amount}
                onChange={(e) => setCollectionFormData({ ...collectionFormData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCollectionDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={(open) => {
        setIsExpenseDialogOpen(open)
        if (!open) resetExpenseForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingExpense ? 'Gider Düzenle' : 'Yeni Gider'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExpense} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Harcama Detayı *</Label>
              <Input
                id="description"
                value={expenseFormData.description}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, description: e.target.value })}
                placeholder="Açıklama giriniz"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">Fatura Tarihi</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={expenseFormData.invoiceDate}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, invoiceDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceNo">Fiş No</Label>
              <Input
                id="invoiceNo"
                value={expenseFormData.invoiceNo}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, invoiceNo: e.target.value })}
                placeholder="Fiş numarası"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expenseAmount">Harcama Tutarı (₺) *</Label>
              <Input
                id="expenseAmount"
                type="number"
                step="0.01"
                value={expenseFormData.amount}
                onChange={(e) => setExpenseFormData({ ...expenseFormData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
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

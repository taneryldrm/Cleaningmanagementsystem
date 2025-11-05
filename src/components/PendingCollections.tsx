import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { DollarSign, Search, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'

interface WorkOrderDebt {
  workOrderId: string
  date: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  description?: string
}

interface CustomerDebt {
  customerId: string
  customerName: string
  customerColor?: string
  totalDebt: number
  workOrders: WorkOrderDebt[]
}

export function PendingCollections({ user }: { user: any }) {
  const [customerDebts, setCustomerDebts] = useState<CustomerDebt[]>([])
  const [filteredDebts, setFilteredDebts] = useState<CustomerDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set())
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<{ customerId: string, workOrderId: string, remainingAmount: number } | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])

  const userRole = user?.user_metadata?.role
  const canCollect = userRole === 'admin' || userRole === 'secretary'

  useEffect(() => {
    loadDebts()
  }, [])

  useEffect(() => {
    filterDebts()
  }, [searchQuery, customerDebts])

  const loadDebts = async () => {
    try {
      const response = await apiCall('/pending-collections')
      console.log('Pending collections response:', response)
      setCustomerDebts(response.customerDebts || [])
    } catch (error) {
      console.error('Error loading pending collections:', error)
      if (error instanceof Error) {
        alert(error.message)
      } else {
        alert('Bekleyen tahsilatlar yüklenirken hata oluştu. Lütfen sayfayı yenileyin.')
      }
    } finally {
      setLoading(false)
    }
  }

  const filterDebts = () => {
    if (!searchQuery.trim()) {
      setFilteredDebts(customerDebts)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = customerDebts.filter(debt => 
      debt.customerName.toLowerCase().includes(query) ||
      debt.totalDebt.toString().includes(query)
    )
    setFilteredDebts(filtered)
  }

  const toggleCustomer = (customerId: string) => {
    const newExpanded = new Set(expandedCustomers)
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId)
    } else {
      newExpanded.add(customerId)
    }
    setExpandedCustomers(newExpanded)
  }

  const openPaymentDialog = (customerId: string, workOrderId: string, remainingAmount: number) => {
    setSelectedWorkOrder({ customerId, workOrderId, remainingAmount })
    setPaymentAmount(remainingAmount.toString())
    setPaymentDate(new Date().toISOString().split('T')[0])
    setIsPaymentDialogOpen(true)
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedWorkOrder) return

    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) {
      alert('Geçerli bir tutar giriniz')
      return
    }

    if (amount > selectedWorkOrder.remainingAmount) {
      alert('Ödeme tutarı kalan tutardan fazla olamaz')
      return
    }

    try {
      await apiCall(`/work-orders/${selectedWorkOrder.workOrderId}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          date: paymentDate
        })
      })

      setIsPaymentDialogOpen(false)
      setSelectedWorkOrder(null)
      setPaymentAmount('')
      loadDebts()
    } catch (error) {
      console.error('Error recording payment:', error)
      alert('Ödeme kaydedilirken hata oluştu: ' + (error as Error).message)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  const getColorBadge = (color?: string) => {
    switch (color) {
      case 'blue':
        return <Badge className="bg-blue-500">Düzenli</Badge>
      case 'red':
        return <Badge variant="destructive">Sıkıntılı</Badge>
      case 'white':
      default:
        return <Badge variant="outline">Normal</Badge>
    }
  }

  const totalDebt = filteredDebts.reduce((sum, debt) => sum + debt.totalDebt, 0)
  const totalCustomers = filteredDebts.length
  const totalWorkOrders = filteredDebts.reduce((sum, debt) => sum + debt.workOrders.length, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-pulse text-2xl">💰</div>
          <p className="text-gray-500">Bekleyen tahsilatlar yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Bekleyen Tahsilatlar</h1>
          <p className="text-gray-500">
            {totalCustomers} müşteriden {totalWorkOrders} iş emri için toplam {formatCurrency(totalDebt)} alacak
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Toplam Alacak</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-red-600">{formatCurrency(totalDebt)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bekleyen Müşteri</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-orange-600">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bekleyen İş Emri</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl text-blue-600">{totalWorkOrders}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Müşteri Ara</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Müşteri adı veya tutar..."
                  className="pl-10"
                />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setSearchQuery('')}
            >
              Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customer Debts List */}
      <div className="space-y-3">
        {filteredDebts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              {searchQuery ? (
                <div className="text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>"{searchQuery}" için sonuç bulunamadı</p>
                </div>
              ) : (
                <div className="text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                  <p>Bekleyen tahsilat bulunmuyor</p>
                  <p className="text-sm mt-2">Tüm ödemeler tamamlanmış! 🎉</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredDebts
            .sort((a, b) => b.totalDebt - a.totalDebt)
            .map((debt) => (
              <Card key={debt.customerId}>
                <Collapsible
                  open={expandedCustomers.has(debt.customerId)}
                  onOpenChange={() => toggleCustomer(debt.customerId)}
                >
                  <CardContent className="py-4">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between hover:bg-gray-50 -mx-4 px-4 py-2 rounded">
                        <div className="flex items-center gap-4">
                          {expandedCustomers.has(debt.customerId) ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                          <div className="text-left">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{debt.customerName}</span>
                              {getColorBadge(debt.customerColor)}
                            </div>
                            <p className="text-sm text-gray-500">
                              {debt.workOrders.length} iş emri
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl text-red-600">
                            {formatCurrency(debt.totalDebt)}
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="mt-4 ml-9 space-y-2">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-2 text-xs text-gray-500">TARİH</th>
                                <th className="text-left py-2 px-2 text-xs text-gray-500">AÇIKLAMA</th>
                                <th className="text-right py-2 px-2 text-xs text-gray-500">TOPLAM</th>
                                <th className="text-right py-2 px-2 text-xs text-gray-500">ÖDENDİ</th>
                                <th className="text-right py-2 px-2 text-xs text-gray-500">KALAN</th>
                                {canCollect && <th className="text-center py-2 px-2 text-xs text-gray-500">İŞLEM</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {debt.workOrders
                                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                                .map((wo) => (
                                  <tr key={wo.workOrderId} className="border-b hover:bg-gray-50">
                                    <td className="py-2 px-2 text-sm">
                                      {new Date(wo.date).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td className="py-2 px-2 text-sm text-gray-600">
                                      {wo.description || 'Açıklama yok'}
                                    </td>
                                    <td className="py-2 px-2 text-sm text-right">
                                      {formatCurrency(wo.totalAmount)}
                                    </td>
                                    <td className="py-2 px-2 text-sm text-right text-green-600">
                                      {formatCurrency(wo.paidAmount)}
                                    </td>
                                    <td className="py-2 px-2 text-sm text-right text-red-600">
                                      {formatCurrency(wo.remainingAmount)}
                                    </td>
                                    {canCollect && (
                                      <td className="py-2 px-2 text-center">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            openPaymentDialog(debt.customerId, wo.workOrderId, wo.remainingAmount)
                                          }}
                                        >
                                          Tahsil Et
                                        </Button>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              <tr className="bg-red-50 font-semibold">
                                <td colSpan={4} className="py-2 px-2 text-sm text-right">
                                  MÜŞTERİ TOPLAMI:
                                </td>
                                <td className="py-2 px-2 text-sm text-right text-red-600">
                                  {formatCurrency(debt.totalDebt)}
                                </td>
                                {canCollect && <td></td>}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CollapsibleContent>
                  </CardContent>
                </Collapsible>
              </Card>
            ))
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tahsilat Kaydı</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>Kalan Tutar</Label>
              <div className="text-2xl text-red-600">
                {selectedWorkOrder && formatCurrency(selectedWorkOrder.remainingAmount)}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Tahsil Edilecek Tutar (₺) *</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Tahsilat Tarihi *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                İptal
              </Button>
              <Button type="submit">Tahsil Et</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

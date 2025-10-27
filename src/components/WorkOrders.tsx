import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Calendar, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react'
import { Textarea } from './ui/textarea'

interface WorkOrder {
  id: string
  customerId: string
  personnelIds: string[]
  date: string
  description: string
  totalAmount: number
  paidAmount: number
  status: string
  approvedAt: string | null
  completedAt: string | null
  createdByName: string
}

export function WorkOrders({ user }: { user: any }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null)
  const [completingOrder, setCompletingOrder] = useState<WorkOrder | null>(null)
  const [completionPayment, setCompletionPayment] = useState('')

  const [formData, setFormData] = useState({
    customerId: '',
    personnelIds: [] as string[],
    date: '', // Don't pre-fill with today - force user to select a date
    description: '',
    totalAmount: '',
    paidAmount: '',
    autoApprove: false,
    isRecurring: false,
    recurrenceType: 'weekly' as 'weekly' | 'biweekly' | 'monthly-date' | 'monthly-weekday',
    recurrenceDay: 3, // Wednesday
    recurrenceDate: 1,
    recurrenceWeek: 1,
    recurrenceWeekday: 0, // Sunday
    endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0] // End of current year
  })

  const userRole = user?.user_metadata?.role
  const canEdit = userRole === 'admin' || userRole === 'secretary'

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [workOrdersResult, customersResult, personnelResult] = await Promise.all([
        apiCall('/work-orders'),
        apiCall('/customers'),
        apiCall('/personnel')
      ])
      
      setWorkOrders(workOrdersResult.workOrders || [])
      setCustomers(customersResult.customers || [])
      setPersonnel(personnelResult.personnel?.filter((p: any) => p.active) || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.customerId) {
      alert('Lütfen müşteri seçin')
      return
    }

    if (!formData.date) {
      alert('Lütfen tarih seçin')
      return
    }

    const totalAmount = parseFloat(formData.totalAmount)
    const paidAmount = parseFloat(formData.paidAmount)
    
    if (isNaN(totalAmount) || totalAmount < 0) {
      alert('Lütfen geçerli bir toplam tutar girin (0 veya pozitif değer)')
      return
    }

    if (isNaN(paidAmount) || paidAmount < 0) {
      alert('Lütfen geçerli bir ödenen tutar girin (0 veya pozitif değer)')
      return
    }

    if (paidAmount > totalAmount) {
      alert('Ödenen tutar toplam tutardan fazla olamaz')
      return
    }

    try {
      if (formData.isRecurring && !editingOrder) {
        // Create recurring work orders
        const payload = {
          customerId: formData.customerId,
          personnelIds: formData.personnelIds,
          startDate: formData.date,
          description: formData.description,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          paidAmount: parseFloat(formData.paidAmount) || 0,
          autoApprove: formData.autoApprove,
          recurrenceType: formData.recurrenceType,
          recurrenceDay: formData.recurrenceDay,
          recurrenceDate: formData.recurrenceDate,
          recurrenceWeek: formData.recurrenceWeek,
          recurrenceWeekday: formData.recurrenceWeekday,
          endDate: formData.endDate
        }

        const result = await apiCall('/work-orders/recurring', {
          method: 'POST',
          body: JSON.stringify(payload)
        })

        alert(`${result.count} adet tekrarlayan iş emri oluşturuldu`)
      } else {
        // Create single work order or update existing
        const payload = {
          customerId: formData.customerId,
          personnelIds: formData.personnelIds,
          date: formData.date,
          description: formData.description,
          totalAmount: parseFloat(formData.totalAmount) || 0,
          paidAmount: parseFloat(formData.paidAmount) || 0,
          autoApprove: formData.autoApprove
        }

        if (editingOrder) {
          await apiCall(`/work-orders/${editingOrder.id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
          })
        } else {
          await apiCall('/work-orders', {
            method: 'POST',
            body: JSON.stringify(payload)
          })
        }
      }

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving work order:', error)
      alert('İş emri kaydedilirken hata oluştu')
    }
  }

  const handleApprove = async (orderId: string) => {
    try {
      await apiCall(`/work-orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'approved',
          approvedAt: new Date().toISOString()
        })
      })
      loadData()
    } catch (error) {
      console.error('Error approving work order:', error)
      alert('İş emri onaylanırken hata oluştu')
    }
  }

  const handleCompleteClick = (order: WorkOrder) => {
    setCompletingOrder(order)
    // Pre-fill with remaining amount
    const remainingAmount = (order.totalAmount || 0) - (order.paidAmount || 0)
    setCompletionPayment(remainingAmount > 0 ? remainingAmount.toString() : '0')
  }

  const handleCompleteSubmit = async () => {
    if (!completingOrder) return

    const paymentAmount = parseFloat(completionPayment)
    
    if (isNaN(paymentAmount) || paymentAmount < 0) {
      alert('Lütfen geçerli bir tutar girin (0 veya pozitif değer)')
      return
    }

    const newPaidAmount = (completingOrder.paidAmount || 0) + paymentAmount
    
    if (newPaidAmount > (completingOrder.totalAmount || 0)) {
      alert('Toplam ödenen tutar, iş emrinin toplam tutarından fazla olamaz')
      return
    }

    try {
      await apiCall(`/work-orders/${completingOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString(),
          paidAmount: newPaidAmount
        })
      })
      
      // Show success message
      if (paymentAmount > 0) {
        alert(`İş emri tamamlandı! ${paymentAmount.toFixed(2)} TL tahsilat günlük nakit akışına otomatik olarak kaydedildi.`)
      } else {
        alert('İş emri tamamlandı!')
      }
      
      setCompletingOrder(null)
      setCompletionPayment('')
      loadData()
    } catch (error) {
      console.error('Error completing work order:', error)
      alert('İş emri tamamlanırken hata oluştu')
    }
  }

  const handleEdit = (order: WorkOrder) => {
    setEditingOrder(order)
    setFormData({
      customerId: order.customerId,
      personnelIds: order.personnelIds || [],
      date: order.date?.split('T')[0] || '',
      description: order.description || '',
      totalAmount: order.totalAmount?.toString() || '0',
      paidAmount: order.paidAmount?.toString() || '0',
      autoApprove: false,
      isRecurring: false,
      recurrenceType: 'weekly',
      recurrenceDay: 3,
      recurrenceDate: 1,
      recurrenceWeek: 1,
      recurrenceWeekday: 0,
      endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (orderId: string) => {
    if (!confirm('Bu iş emrini silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/work-orders/${orderId}`, {
        method: 'DELETE'
      })
      loadData()
    } catch (error: any) {
      console.error('Error deleting work order:', error)
      alert(error.message || 'İş emri silinirken hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      customerId: '',
      personnelIds: [],
      date: '', // Don't pre-fill with today - force user to select a date
      description: '',
      totalAmount: '',
      paidAmount: '',
      autoApprove: false,
      isRecurring: false,
      recurrenceType: 'weekly',
      recurrenceDay: 3,
      recurrenceDate: 1,
      recurrenceWeek: 1,
      recurrenceWeekday: 0,
      endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
    })
    setEditingOrder(null)
  }

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    return customer?.name || 'Bilinmiyor'
  }

  const getPersonnelNames = (personnelIds: string[]) => {
    return personnelIds
      .map(id => personnel.find(p => p.id === id)?.name)
      .filter(Boolean)
      .join(', ') || 'Atanmadı'
  }

  // Check if personnel is assigned to another work order on the same date
  const isPersonnelAssignedOnDate = (personnelId: string, date: string): { assigned: boolean, customerName: string } => {
    const dateOnly = date.split('T')[0]
    const assignedOrder = workOrders.find(wo => {
      const woDateOnly = wo.date?.split('T')[0]
      // Skip if it's the order being edited
      if (editingOrder && wo.id === editingOrder.id) return false
      // Check if date matches and personnel is assigned and order is not cancelled
      return woDateOnly === dateOnly && 
             wo.personnelIds?.includes(personnelId) &&
             (wo.status === 'draft' || wo.status === 'approved' || wo.status === 'completed')
    })
    
    if (assignedOrder) {
      const customerName = getCustomerName(assignedOrder.customerId)
      return { assigned: true, customerName }
    }
    return { assigned: false, customerName: '' }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Taslak</Badge>
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800">Onaylandı</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Tamamlandı</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const filteredOrders = workOrders.filter(wo => {
    if (!selectedDate) return true
    return wo.date?.startsWith(selectedDate)
  })

  const groupedByDate = filteredOrders.reduce((acc, order) => {
    const date = order.date?.split('T')[0] || 'unknown'
    if (!acc[date]) acc[date] = []
    acc[date].push(order)
    return acc
  }, {} as Record<string, WorkOrder[]>)

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>İş Emirleri</h1>
          <p className="text-gray-500">{workOrders.length} iş emri</p>
        </div>
        {canEdit && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni İş Emri
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingOrder ? 'İş Emrini Düzenle' : 'Yeni İş Emri Oluştur'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Müşteri *</Label>
                    <Select 
                      value={formData.customerId}
                      onValueChange={(value) => setFormData({ ...formData, customerId: value })}
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
                    <Label htmlFor="date">{formData.isRecurring ? 'Başlangıç Tarihi *' : 'Tarih *'}</Label>
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
                  <Label>Personel Ata</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                    {personnel.map(person => {
                      const assignmentCheck = isPersonnelAssignedOnDate(person.id, formData.date)
                      const isAssigned = assignmentCheck.assigned
                      
                      return (
                        <label 
                          key={person.id} 
                          className={`flex items-center gap-2 ${isAssigned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.personnelIds.includes(person.id)}
                            disabled={isAssigned}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  personnelIds: [...formData.personnelIds, person.id]
                                })
                              } else {
                                setFormData({
                                  ...formData,
                                  personnelIds: formData.personnelIds.filter(id => id !== person.id)
                                })
                              }
                            }}
                            className="rounded"
                          />
                          <span className="flex-1">
                            {person.name} - {person.role}
                            {isAssigned && (
                              <span className="ml-2 text-xs text-red-600">
                                ({assignmentCheck.customerName} için atanmış)
                              </span>
                            )}
                          </span>
                        </label>
                      )
                    })}
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Toplam Tutar (TL)</Label>
                    <Input
                      id="totalAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.totalAmount}
                      onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paidAmount">Ödenen Tutar (TL)</Label>
                    <Input
                      id="paidAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.paidAmount}
                      onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoApprove"
                    checked={formData.autoApprove}
                    onChange={(e) => setFormData({ ...formData, autoApprove: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="autoApprove" className="cursor-pointer">
                    Otomatik onayla (Taslak olarak kaydetme)
                  </Label>
                </div>
                {!editingOrder && (
                  <>
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          id="isRecurring"
                          checked={formData.isRecurring}
                          onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="isRecurring" className="cursor-pointer">
                          🔁 Tekrarlayan İş Emri (Düzenli müşteri için otomatik iş emirleri oluştur)
                        </Label>
                      </div>
                      {formData.isRecurring && (
                        <div className="space-y-4 bg-blue-50 p-4 rounded-md">
                          <div className="space-y-2">
                            <Label htmlFor="recurrenceType">Sıklık</Label>
                            <Select 
                              value={formData.recurrenceType}
                              onValueChange={(value: any) => setFormData({ ...formData, recurrenceType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="weekly">Her Hafta</SelectItem>
                                <SelectItem value="biweekly">İki Haftada Bir</SelectItem>
                                <SelectItem value="monthly-date">Her Ayın Belirli Günü</SelectItem>
                                <SelectItem value="monthly-weekday">Her Ayın Belirli Haftası</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {(formData.recurrenceType === 'weekly' || formData.recurrenceType === 'biweekly') && (
                            <div className="space-y-2">
                              <Label htmlFor="recurrenceDay">Hangi Gün</Label>
                              <Select 
                                value={formData.recurrenceDay.toString()}
                                onValueChange={(value) => setFormData({ ...formData, recurrenceDay: parseInt(value) })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">Pazar</SelectItem>
                                  <SelectItem value="1">Pazartesi</SelectItem>
                                  <SelectItem value="2">Salı</SelectItem>
                                  <SelectItem value="3">Çarşamba</SelectItem>
                                  <SelectItem value="4">Perşembe</SelectItem>
                                  <SelectItem value="5">Cuma</SelectItem>
                                  <SelectItem value="6">Cumartesi</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {formData.recurrenceType === 'monthly-date' && (
                            <div className="space-y-2">
                              <Label htmlFor="recurrenceDate">Ayın Hangi Günü (1-31)</Label>
                              <Input
                                id="recurrenceDate"
                                type="number"
                                min="1"
                                max="31"
                                value={formData.recurrenceDate}
                                onChange={(e) => setFormData({ ...formData, recurrenceDate: parseInt(e.target.value) })}
                              />
                            </div>
                          )}

                          {formData.recurrenceType === 'monthly-weekday' && (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="recurrenceWeek">Hangi Hafta</Label>
                                <Select 
                                  value={formData.recurrenceWeek.toString()}
                                  onValueChange={(value) => setFormData({ ...formData, recurrenceWeek: parseInt(value) })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">İlk Hafta</SelectItem>
                                    <SelectItem value="2">İkinci Hafta</SelectItem>
                                    <SelectItem value="3">Üçüncü Hafta</SelectItem>
                                    <SelectItem value="4">Dördüncü Hafta</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="recurrenceWeekday">Hangi Gün</Label>
                                <Select 
                                  value={formData.recurrenceWeekday.toString()}
                                  onValueChange={(value) => setFormData({ ...formData, recurrenceWeekday: parseInt(value) })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="0">Pazar</SelectItem>
                                    <SelectItem value="1">Pazartesi</SelectItem>
                                    <SelectItem value="2">Salı</SelectItem>
                                    <SelectItem value="3">Çarşamba</SelectItem>
                                    <SelectItem value="4">Perşembe</SelectItem>
                                    <SelectItem value="5">Cuma</SelectItem>
                                    <SelectItem value="6">Cumartesi</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          )}

                          <div className="space-y-2">
                            <Label htmlFor="endDate">Bitiş Tarihi (Son iş emri tarihi)</Label>
                            <Input
                              id="endDate"
                              type="date"
                              value={formData.endDate}
                              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                            />
                            <p className="text-xs text-gray-500">
                              Bu tarih dahil olmak üzere iş emirleri oluşturulacak
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit">{formData.isRecurring && !editingOrder ? 'Tekrarlayan İş Emirleri Oluştur' : 'Kaydet'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Date Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="outline"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            >
              Bugün
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders by Date */}
      <div className="space-y-6">
        {Object.keys(groupedByDate).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Seçilen tarih için iş emri bulunamadı
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, orders]) => (
              <div key={date}>
                <h3 className="mb-4">
                  {new Date(date).toLocaleDateString('tr-TR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </h3>
                <div className="grid gap-4">
                  {orders.map(order => (
                    <Card key={order.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="flex items-center gap-2">
                              {getCustomerName(order.customerId)}
                              {getStatusBadge(order.status)}
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                              Oluşturan: {order.createdByName || 'Bilinmiyor'}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500">Personel: </span>
                            {getPersonnelNames(order.personnelIds || [])}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <span className="text-gray-500">Toplam: </span>
                              <span>{order.totalAmount ? `${order.totalAmount.toFixed(2)} TL` : '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Ödenen: </span>
                              <span>{order.paidAmount ? `${order.paidAmount.toFixed(2)} TL` : '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Kalan: </span>
                              <span className={(order.totalAmount - order.paidAmount) > 0 ? 'text-red-600' : 'text-green-600'}>
                                {order.totalAmount !== undefined && order.paidAmount !== undefined ? `${(order.totalAmount - order.paidAmount).toFixed(2)} TL` : '-'}
                              </span>
                            </div>
                          </div>
                        </div>
                        {order.description && (
                          <p className="text-sm text-gray-600">{order.description}</p>
                        )}
                        {canEdit && (
                          <div className="flex gap-2 pt-2 border-t">
                            {order.status === 'draft' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEdit(order)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  Düzenle
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprove(order.id)}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Onayla
                                </Button>
                              </>
                            )}
                            {order.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCompleteClick(order)}
                              >
                                Tamamla
                              </Button>
                            )}
                            {userRole === 'admin' && (order.status === 'approved' || order.status === 'completed') && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(order.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Sil
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>

      {/* Completion Payment Dialog */}
      <Dialog open={!!completingOrder} onOpenChange={(open) => {
        if (!open) {
          setCompletingOrder(null)
          setCompletionPayment('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İş Emrini Tamamla</DialogTitle>
          </DialogHeader>
          {completingOrder && (
            <div className="space-y-4">
              <div className="space-y-2 p-4 bg-gray-50 rounded-md">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Müşteri:</span>
                  <span className="text-sm font-medium">{getCustomerName(completingOrder.customerId)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Toplam Tutar:</span>
                  <span className="text-sm font-medium">{(completingOrder.totalAmount || 0).toFixed(2)} TL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Önceden Ödenen:</span>
                  <span className="text-sm font-medium">{(completingOrder.paidAmount || 0).toFixed(2)} TL</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-gray-600">Kalan Tutar:</span>
                  <span className="text-sm font-medium text-red-600">
                    {((completingOrder.totalAmount || 0) - (completingOrder.paidAmount || 0)).toFixed(2)} TL
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="completionPayment">Müşteriden Alınan Tutar (TL)</Label>
                <Input
                  id="completionPayment"
                  type="number"
                  step="0.01"
                  min="0"
                  value={completionPayment}
                  onChange={(e) => setCompletionPayment(e.target.value)}
                  placeholder="0.00"
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  Bu işte müşteriden ne kadar tahsilat yaptınız?
                </p>
                {parseFloat(completionPayment) > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-xs text-blue-800">
                    💡 <strong>Bilgi:</strong> Girdiğiniz {parseFloat(completionPayment).toFixed(2)} TL tahsilat, bugünün tarihinde günlük nakit akışına ve Finance bölümüne otomatik olarak kaydedilecektir.
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCompletingOrder(null)
                    setCompletionPayment('')
                  }}
                >
                  İptal
                </Button>
                <Button onClick={handleCompleteSubmit}>
                  İş Emrini Tamamla
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

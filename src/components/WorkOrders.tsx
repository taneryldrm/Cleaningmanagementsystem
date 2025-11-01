import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Calendar, CheckCircle, Clock, Edit, Trash2, Search, UserPlus, Users, AlertCircle } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { toast } from 'sonner@2.0.3'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false)
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    type: 'normal' as 'regular' | 'problematic' | 'normal'
  })

  const [formData, setFormData] = useState({
    customerId: '',
    personnelIds: [] as string[],
    personnelCount: '1',
    date: '',
    description: '',
    totalAmount: '',
    paidAmount: '',
    autoApprove: false,
    isRecurring: false,
    recurrenceType: 'weekly' as 'weekly' | 'biweekly' | 'monthly-date' | 'monthly-weekday',
    recurrenceDay: 3,
    recurrenceDate: 1,
    recurrenceWeek: 1,
    recurrenceWeekday: 0,
    endDate: new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0]
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

    if (!formData.customerId) {
      toast.error('Lütfen müşteri seçin')
      return
    }

    if (!formData.date) {
      toast.error('Lütfen tarih seçin')
      return
    }

    const totalAmount = parseFloat(formData.totalAmount)
    const paidAmount = parseFloat(formData.paidAmount)
    
    if (isNaN(totalAmount) || totalAmount < 0) {
      toast.error('Lütfen geçerli bir toplam tutar girin')
      return
    }

    if (isNaN(paidAmount) || paidAmount < 0) {
      toast.error('Lütfen geçerli bir ödenen tutar girin')
      return
    }

    if (paidAmount > totalAmount) {
      toast.error('Ödenen tutar toplam tutardan fazla olamaz')
      return
    }

    try {
      if (formData.isRecurring && !editingOrder) {
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

        toast.success(`${result.count} adet tekrarlayan iş emri oluşturuldu`)
      } else {
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
          toast.success('İş emri güncellendi')
        } else {
          await apiCall('/work-orders', {
            method: 'POST',
            body: JSON.stringify(payload)
          })
          toast.success('İş emri oluşturuldu')
        }
      }

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving work order:', error)
      toast.error('İş emri kaydedilirken hata oluştu')
    }
  }



  const handleEdit = (order: WorkOrder) => {
    setEditingOrder(order)
    setFormData({
      customerId: order.customerId,
      personnelIds: order.personnelIds || [],
      personnelCount: (order.personnelIds?.length || 1).toString(),
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
      toast.success('İş emri silindi')
    } catch (error: any) {
      console.error('Error deleting work order:', error)
      toast.error(error.message || 'İş emri silinirken hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      customerId: '',
      personnelIds: [],
      personnelCount: '1',
      date: '',
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
    setSearchQuery('')
    setShowNewCustomerForm(false)
    setNewCustomerData({
      name: '',
      phone: '',
      address: '',
      type: 'normal'
    })
  }

  const handleCreateNewCustomer = async () => {
    if (!newCustomerData.name || !newCustomerData.phone) {
      toast.error('Müşteri adı ve telefon numarası gereklidir')
      return
    }

    try {
      const payload = {
        name: newCustomerData.name,
        contactInfo: {
          phone: newCustomerData.phone,
          address: newCustomerData.address || ''
        },
        type: newCustomerData.type
      }

      const result = await apiCall('/customers', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      toast.success('Yeni müşteri oluşturuldu!')
      
      const customersResult = await apiCall('/customers')
      setCustomers(customersResult.customers || [])
      
      setFormData({ ...formData, customerId: result.customer.id })
      setShowNewCustomerForm(false)
      setNewCustomerData({
        name: '',
        phone: '',
        address: '',
        type: 'normal'
      })
    } catch (error) {
      console.error('Error creating customer:', error)
      toast.error('Müşteri oluşturulurken hata oluştu')
    }
  }

  const filteredCustomers = customers.filter(customer => {
    const query = searchQuery.toLowerCase()
    const nameMatch = customer.name?.toLowerCase().includes(query)
    const phoneMatch = customer.contactInfo?.phone?.includes(query)
    return nameMatch || phoneMatch
  })

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

  const getPersonnelAssignmentsOnDate = (personnelId: string, date: string): string[] => {
    if (!date) return []
    const dateOnly = date.split('T')[0]
    const assignedOrders = workOrders.filter(wo => {
      const woDateOnly = wo.date?.split('T')[0]
      if (editingOrder && wo.id === editingOrder.id) return false
      return woDateOnly === dateOnly && 
             wo.personnelIds?.includes(personnelId) &&
             (wo.status === 'draft' || wo.status === 'approved' || wo.status === 'completed')
    })
    
    return assignedOrders.map(order => getCustomerName(order.customerId))
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
                {/* Müşteri Seçimi veya Yeni Müşteri */}
                <div className="space-y-2">
                  <Label>Müşteri *</Label>
                  {!showNewCustomerForm ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Müşteri adı veya telefon numarası ile ara..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select 
                        value={formData.customerId}
                        onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Müşteri seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCustomers.length > 0 ? (
                            filteredCustomers.map(customer => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} {customer.contactInfo?.phone && `(${customer.contactInfo.phone})`}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-results" disabled>
                              Sonuç bulunamadı
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowNewCustomerForm(true)}
                        className="w-full"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Yeni Müşteri Oluştur
                      </Button>
                    </div>
                  ) : (
                    <Card className="p-4 space-y-3 bg-blue-50 border-blue-200">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium">Yeni Müşteri</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowNewCustomerForm(false)}
                        >
                          İptal
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Input
                          placeholder="Müşteri Adı *"
                          value={newCustomerData.name}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                        />
                        <Input
                          placeholder="Telefon *"
                          value={newCustomerData.phone}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                        />
                        <Input
                          placeholder="Adres (Opsiyonel)"
                          value={newCustomerData.address}
                          onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                        />
                        <Select
                          value={newCustomerData.type}
                          onValueChange={(value: any) => setNewCustomerData({ ...newCustomerData, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="regular">Düzenli</SelectItem>
                            <SelectItem value="problematic">Sıkıntılı</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        onClick={handleCreateNewCustomer}
                        className="w-full"
                      >
                        Müşteri Oluştur ve Seç
                      </Button>
                    </Card>
                  )}
                </div>

                {/* Tarih ve Eleman Sayısı */}
                <div className="grid grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="personnelCount">
                      <Users className="h-4 w-4 inline mr-1" />
                      Eleman Sayısı
                    </Label>
                    <Input
                      id="personnelCount"
                      type="number"
                      min="1"
                      value={formData.personnelCount}
                      onChange={(e) => setFormData({ ...formData, personnelCount: e.target.value })}
                    />
                  </div>
                </div>

                {/* Personel Seçimi */}
                <div className="space-y-2">
                  <Label>Personel Ata (Temizlikçiler)</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-64 overflow-y-auto">
                    {personnel.filter(p => p.role === 'cleaner').map(person => {
                      const otherAssignments = getPersonnelAssignmentsOnDate(person.id, formData.date)
                      const hasOtherJobs = otherAssignments.length > 0
                      
                      return (
                        <label 
                          key={person.id} 
                          className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={formData.personnelIds.includes(person.id)}
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
                            className="rounded mt-1"
                          />
                          <div className="flex-1">
                            <div>{person.name}</div>
                            {hasOtherJobs && (
                              <div className="flex items-start gap-1 mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                <span>
                                  Bugün şu müşterilerde de çalışıyor: {otherAssignments.join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
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
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false)
                    resetForm()
                  }}>
                    İptal
                  </Button>
                  <Button type="submit">
                    {editingOrder ? 'Güncelle' : formData.isRecurring ? 'Tekrarlayan İş Emirleri Oluştur' : 'Oluştur'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <Label htmlFor="date">Tarih</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Work Orders List */}
      <div className="space-y-4">
        {Object.keys(groupedByDate).length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              Seçili tarih için iş emri bulunamadı
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedByDate).map(([date, orders]) => (
            <Card key={date}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  <span className="text-sm text-gray-500">({orders.length} iş emri)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {orders.map(order => (
                  <div key={order.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-medium">{getCustomerName(order.customerId)}</h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><strong>Personel:</strong> {getPersonnelNames(order.personnelIds)}</p>
                          {order.description && <p><strong>Açıklama:</strong> {order.description}</p>}
                          <p><strong>Tutar:</strong> {order.totalAmount?.toFixed(2)} TL</p>
                          <p><strong>Ödenen:</strong> {order.paidAmount?.toFixed(2)} TL</p>
                          {order.paidAmount < order.totalAmount && (
                            <p className="text-red-600">
                              <strong>Kalan:</strong> {(order.totalAmount - order.paidAmount).toFixed(2)} TL
                            </p>
                          )}
                          <p className="text-xs text-gray-500">Oluşturan: {order.createdByName}</p>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(order)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(order.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Calendar, CheckCircle, Clock, Edit } from 'lucide-react'
import { Textarea } from './ui/textarea'

interface WorkOrder {
  id: string
  customerId: string
  personnelIds: string[]
  date: string
  description: string
  estimatedAmount: number
  actualAmount: number
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

  const [formData, setFormData] = useState({
    customerId: '',
    personnelIds: [] as string[],
    date: new Date().toISOString().split('T')[0],
    description: '',
    estimatedAmount: '',
    autoApprove: false
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

    try {
      const payload = {
        customerId: formData.customerId,
        personnelIds: formData.personnelIds,
        date: formData.date,
        description: formData.description,
        estimatedAmount: parseFloat(formData.estimatedAmount) || 0,
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

  const handleComplete = async (orderId: string, actualAmount: number) => {
    try {
      await apiCall(`/work-orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString(),
          actualAmount
        })
      })
      loadData()
    } catch (error) {
      console.error('Error completing work order:', error)
      alert('İş emri tamamlanırken hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      customerId: '',
      personnelIds: [],
      date: new Date().toISOString().split('T')[0],
      description: '',
      estimatedAmount: '',
      autoApprove: false
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
            <DialogContent className="max-w-2xl">
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
                  <Label>Personel Ata</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                    {personnel.map(person => (
                      <label key={person.id} className="flex items-center gap-2 cursor-pointer">
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
                          className="rounded"
                        />
                        <span>{person.name} - {person.role}</span>
                      </label>
                    ))}
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
                <div className="space-y-2">
                  <Label htmlFor="amount">Tahmini Tutar (TL)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.estimatedAmount}
                    onChange={(e) => setFormData({ ...formData, estimatedAmount: e.target.value })}
                  />
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
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    İptal
                  </Button>
                  <Button type="submit">Kaydet</Button>
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
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Personel: </span>
                            {getPersonnelNames(order.personnelIds || [])}
                          </div>
                          <div>
                            <span className="text-gray-500">Tahmini Tutar: </span>
                            {order.estimatedAmount ? `${order.estimatedAmount} TL` : '-'}
                          </div>
                        </div>
                        {order.description && (
                          <p className="text-sm text-gray-600">{order.description}</p>
                        )}
                        {canEdit && (
                          <div className="flex gap-2 pt-2 border-t">
                            {order.status === 'draft' && (
                              <Button
                                size="sm"
                                onClick={() => handleApprove(order.id)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Onayla
                              </Button>
                            )}
                            {order.status === 'approved' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const amount = prompt('Gerçekleşen tutarı girin (TL):')
                                  if (amount) {
                                    handleComplete(order.id, parseFloat(amount))
                                  }
                                }}
                              >
                                Tamamla
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
    </div>
  )
}

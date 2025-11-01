import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Users, Calendar, DollarSign, Copy, X, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { toast } from 'sonner@2.0.3'

interface Customer {
  id: string
  name: string
  type: 'regular' | 'problematic' | 'normal'
  contactInfo: any
  address: string
  notes: string
  balance: number
  createdAt: string
}

interface WorkOrder {
  id: string
  date: string
  status: string
  totalAmount: number
  paidAmount: number
  description: string
  personnelIds: string[]
  personnelPayments: { [key: string]: number }
  customerId: string
}

interface Personnel {
  id: string
  name: string
}

export function Customers({ user }: { user: any }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  // Detail view states
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null)
  const [customerWorkOrders, setCustomerWorkOrders] = useState<WorkOrder[]>([])
  const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  
  // Duplicate work order states
  const [duplicatingWorkOrder, setDuplicatingWorkOrder] = useState<WorkOrder | null>(null)
  const [duplicateFormData, setDuplicateFormData] = useState<any>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'normal',
    phone: '',
    email: '',
    address: '',
    notes: ''
  })

  const role = user?.user_metadata?.role
  const canEdit = role === 'admin' || role === 'secretary'

  useEffect(() => {
    loadCustomers()
    loadPersonnel()
  }, [])

  useEffect(() => {
    filterCustomers()
  }, [searchTerm, filterType, customers])

  const loadCustomers = async () => {
    try {
      const result = await apiCall('/customers')
      setCustomers(result.customers || [])
    } catch (error) {
      console.error('Error loading customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPersonnel = async () => {
    try {
      const result = await apiCall('/personnel')
      setAllPersonnel(result.personnel || [])
    } catch (error) {
      console.error('Error loading personnel:', error)
    }
  }

  const loadCustomerDetails = async (customer: Customer) => {
    setViewingCustomer(customer)
    setLoadingDetails(true)
    
    try {
      // Load all work orders
      const result = await apiCall('/work-orders')
      const allWorkOrders = result.workOrders || []
      
      // Filter work orders for this customer
      const customerOrders = allWorkOrders
        .filter((wo: WorkOrder) => wo.customerId === customer.id)
        .sort((a: WorkOrder, b: WorkOrder) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      setCustomerWorkOrders(customerOrders)
    } catch (error) {
      console.error('Error loading customer details:', error)
      toast.error('Müşteri detayları yüklenirken hata oluştu')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleDuplicateWorkOrder = (workOrder: WorkOrder) => {
    setDuplicatingWorkOrder(workOrder)
    
    // Pre-fill form with work order data
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    setDuplicateFormData({
      date: tomorrow.toISOString().split('T')[0],
      time: '09:00',
      description: workOrder.description || '',
      totalAmount: workOrder.totalAmount || 0,
      paidAmount: 0, // Reset paid amount for new order
      personnelIds: workOrder.personnelIds || [],
      personnelPayments: { ...workOrder.personnelPayments } || {}
    })
  }

  const handleSubmitDuplicate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!duplicateFormData || !duplicatingWorkOrder) return
    
    try {
      const payload = {
        customerId: duplicatingWorkOrder.customerId,
        date: `${duplicateFormData.date}T${duplicateFormData.time}:00`,
        description: duplicateFormData.description,
        totalAmount: parseFloat(duplicateFormData.totalAmount),
        paidAmount: parseFloat(duplicateFormData.paidAmount || 0),
        personnelIds: duplicateFormData.personnelIds,
        personnelPayments: duplicateFormData.personnelPayments,
        status: 'draft'
      }
      
      await apiCall('/work-orders', {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      toast.success('İş emri başarıyla kopyalandı!')
      setDuplicatingWorkOrder(null)
      setDuplicateFormData(null)
      
      // Reload customer details
      if (viewingCustomer) {
        loadCustomerDetails(viewingCustomer)
      }
    } catch (error) {
      console.error('Error duplicating work order:', error)
      toast.error('İş emri kopyalanırken hata oluştu')
    }
  }

  const filterCustomers = () => {
    let filtered = customers

    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.contactInfo?.phone?.includes(searchTerm) ||
        c.contactInfo?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(c => c.type === filterType)
    }

    setFilteredCustomers(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        contactInfo: {
          phone: formData.phone,
          email: formData.email
        },
        address: formData.address,
        notes: formData.notes
      }

      if (editingCustomer) {
        await apiCall(`/customers/${editingCustomer.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await apiCall('/customers', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }

      setIsDialogOpen(false)
      resetForm()
      loadCustomers()
      toast.success('Müşteri başarıyla kaydedildi!')
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Müşteri kaydedilirken hata oluştu')
    }
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      type: customer.type,
      phone: customer.contactInfo?.phone || '',
      email: customer.contactInfo?.email || '',
      address: customer.address || '',
      notes: customer.notes || ''
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (customerId: string) => {
    if (!confirm('Bu müşteriyi silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/customers/${customerId}`, { method: 'DELETE' })
      loadCustomers()
      toast.success('Müşteri başarıyla silindi!')
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Müşteri silinirken hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'normal',
      phone: '',
      email: '',
      address: '',
      notes: ''
    })
    setEditingCustomer(null)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'regular': return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'problematic': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'regular': return 'Düzenli Müşteri'
      case 'problematic': return 'Sıkıntılı Müşteri'
      default: return 'Normal Müşteri'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Taslak</Badge>
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800"><CheckCircle className="h-3 w-3 mr-1" />Onaylandı</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Tamamlandı</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount || 0)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  const getPersonnelName = (personnelId: string) => {
    const personnel = allPersonnel.find(p => p.id === personnelId)
    return personnel?.name || 'Bilinmiyor'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  // Customer Detail View
  if (viewingCustomer) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setViewingCustomer(null)}>
              <X className="h-4 w-4 mr-2" />
              Geri
            </Button>
            <div>
              <h1>{viewingCustomer.name}</h1>
              <Badge className={getTypeColor(viewingCustomer.type)}>
                {getTypeLabel(viewingCustomer.type)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Müşteri Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Telefon</div>
                <div className="font-medium">{viewingCustomer.contactInfo?.phone || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">E-posta</div>
                <div className="font-medium">{viewingCustomer.contactInfo?.email || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Adres</div>
                <div className="font-medium">{viewingCustomer.address || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Bakiye</div>
                <div className={`font-bold text-lg ${viewingCustomer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(viewingCustomer.balance)}
                </div>
              </div>
            </div>
            {viewingCustomer.notes && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">Notlar</div>
                <p className="mt-1">{viewingCustomer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              İş Geçmişi ({customerWorkOrders.length} adet)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetails ? (
              <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
            ) : customerWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Bu müşteri için henüz iş emri bulunmuyor
              </div>
            ) : (
              <div className="space-y-4">
                {customerWorkOrders.map((workOrder) => {
                  const totalPaidToPersonnel = Object.values(workOrder.personnelPayments || {}).reduce((sum, amount) => sum + (amount || 0), 0)
                  const remainingAmount = workOrder.totalAmount - workOrder.paidAmount
                  
                  return (
                    <div key={workOrder.id} className="border rounded-lg p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-gray-600" />
                          <div>
                            <div className="font-medium">{formatDate(workOrder.date)}</div>
                            <div className="text-sm text-gray-500">
                              {new Date(workOrder.date).toLocaleTimeString('tr-TR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(workOrder.status)}
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicateWorkOrder(workOrder)}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Tekrarla
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {workOrder.description && (
                        <p className="text-sm text-gray-700">{workOrder.description}</p>
                      )}

                      {/* Financial Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-xs text-gray-500">Toplam Tutar</div>
                          <div className="font-bold text-lg">{formatCurrency(workOrder.totalAmount)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Müşteri Ödemesi</div>
                          <div className="font-bold text-lg text-green-600">{formatCurrency(workOrder.paidAmount)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Kalan Borç</div>
                          <div className={`font-bold text-lg ${remainingAmount > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                            {formatCurrency(remainingAmount)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Personel Ödemesi</div>
                          <div className="font-bold text-lg text-blue-600">{formatCurrency(totalPaidToPersonnel)}</div>
                        </div>
                      </div>

                      {/* Personnel List */}
                      {workOrder.personnelIds && workOrder.personnelIds.length > 0 && (
                        <div className="pt-3 border-t">
                          <div className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Çalışan Personel ({workOrder.personnelIds.length})
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {workOrder.personnelIds.map((personnelId) => (
                              <div key={personnelId} className="flex items-center justify-between p-2 bg-white border rounded">
                                <span className="text-sm">{getPersonnelName(personnelId)}</span>
                                <div className="flex items-center gap-2">
                                  <DollarSign className="h-3 w-3 text-gray-400" />
                                  <span className="text-sm font-medium text-blue-600">
                                    {formatCurrency(workOrder.personnelPayments?.[personnelId] || 0)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duplicate Work Order Dialog */}
        {duplicatingWorkOrder && duplicateFormData && (
          <Dialog open={!!duplicatingWorkOrder} onOpenChange={(open) => {
            if (!open) {
              setDuplicatingWorkOrder(null)
              setDuplicateFormData(null)
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>İş Emrini Tekrarla</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitDuplicate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tarih *</Label>
                    <Input
                      type="date"
                      value={duplicateFormData.date}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Saat *</Label>
                    <Input
                      type="time"
                      value={duplicateFormData.time}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Açıklama</Label>
                  <Textarea
                    value={duplicateFormData.description}
                    onChange={(e) => setDuplicateFormData({ ...duplicateFormData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Toplam Tutar *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={duplicateFormData.totalAmount}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, totalAmount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ödenen Tutar</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={duplicateFormData.paidAmount}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, paidAmount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Personel Seçimi</Label>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded p-3">
                    {allPersonnel.map((person) => {
                      const isSelected = duplicateFormData.personnelIds.includes(person.id)
                      return (
                        <div key={person.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDuplicateFormData({
                                    ...duplicateFormData,
                                    personnelIds: [...duplicateFormData.personnelIds, person.id]
                                  })
                                } else {
                                  setDuplicateFormData({
                                    ...duplicateFormData,
                                    personnelIds: duplicateFormData.personnelIds.filter((id: string) => id !== person.id)
                                  })
                                }
                              }}
                            />
                            <label>{person.name}</label>
                          </div>
                          {isSelected && (
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Ödeme tutarı"
                              className="w-32"
                              value={duplicateFormData.personnelPayments[person.id] || ''}
                              onChange={(e) => setDuplicateFormData({
                                ...duplicateFormData,
                                personnelPayments: {
                                  ...duplicateFormData.personnelPayments,
                                  [person.id]: parseFloat(e.target.value) || 0
                                }
                              })}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setDuplicatingWorkOrder(null)
                      setDuplicateFormData(null)
                    }}
                  >
                    İptal
                  </Button>
                  <Button type="submit">
                    <Copy className="h-4 w-4 mr-2" />
                    İş Emri Oluştur
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }

  // Main Customer List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Müşteri Yönetimi</h1>
          <p className="text-gray-500">{customers.length} müşteri kayıtlı</p>
        </div>
        {canEdit && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Yeni Müşteri
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri Ekle'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Müşteri Adı *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Müşteri Tipi</Label>
                    <Select 
                      value={formData.type}
                      onValueChange={(value) => setFormData({ ...formData, type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal Müşteri</SelectItem>
                        <SelectItem value="regular">Düzenli Müşteri</SelectItem>
                        <SelectItem value="problematic">Sıkıntılı Müşteri</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefon</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-posta</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adres</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notlar</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Müşteri ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Tüm müşteriler" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Müşteriler</SelectItem>
                <SelectItem value="regular">Düzenli Müşteriler</SelectItem>
                <SelectItem value="normal">Normal Müşteriler</SelectItem>
                <SelectItem value="problematic">Sıkıntılı Müşteriler</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customer List */}
      <div className="grid gap-4">
        {filteredCustomers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Müşteri bulunamadı
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id} className={`border-l-4 ${getTypeColor(customer.type)}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {customer.name}
                      <Badge className={getTypeColor(customer.type)}>
                        {getTypeLabel(customer.type)}
                      </Badge>
                    </CardTitle>
                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                      {customer.contactInfo?.phone && (
                        <div>Telefon: {customer.contactInfo.phone}</div>
                      )}
                      {customer.contactInfo?.email && (
                        <div>E-posta: {customer.contactInfo.email}</div>
                      )}
                      {customer.address && (
                        <div>Adres: {customer.address}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Bakiye</div>
                      <div className={`font-bold ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(customer.balance)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadCustomerDetails(customer)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detay
                      </Button>
                      {canEdit && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {role === 'admin' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(customer.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              {customer.notes && (
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600">{customer.notes}</p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

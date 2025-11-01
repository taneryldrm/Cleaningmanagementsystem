import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { Plus, Search, Edit, Trash2, UserCheck, UserX, Eye, Filter, X, Calendar, DollarSign, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Switch } from './ui/switch'
import { toast } from 'sonner@2.0.3'

interface Personnel {
  id: string
  name: string
  role: string
  contactInfo: any
  notes: string
  active: boolean
  createdAt: string
  totalBalance?: number
}

interface WorkOrder {
  id: string
  date: string
  status: string
  totalAmount: number
  paidAmount: number
  description: string
  customerId: string
  customerName?: string
  personnelIds: string[]
  personnelPayments: { [key: string]: number }
}



export function Personnel({ user }: { user: any }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)
  
  // Detail view states
  const [viewingPersonnel, setViewingPersonnel] = useState<Personnel | null>(null)
  const [personnelWorkOrders, setPersonnelWorkOrders] = useState<WorkOrder[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    role: 'cleaner',
    phone: '',
    notes: ''
  })

  const userRole = user?.user_metadata?.role
  const canEdit = userRole === 'admin' || userRole === 'secretary'

  useEffect(() => {
    loadPersonnel()
  }, [])

  useEffect(() => {
    filterPersonnel()
  }, [searchTerm, personnel, showOnlyWithBalance])

  const loadPersonnel = async () => {
    try {
      const result = await apiCall('/personnel')
      setPersonnel(result.personnel || [])
    } catch (error) {
      console.error('Error loading personnel:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPersonnelDetails = async (person: Personnel) => {
    setViewingPersonnel(person)
    setLoadingDetails(true)
    
    try {
      // Load all work orders
      const workOrdersResult = await apiCall('/work-orders')
      const allWorkOrders = workOrdersResult.workOrders || []
      
      // Load all customers to get names
      const customersResult = await apiCall('/customers')
      const customers = customersResult.customers || []
      
      // Filter work orders where this personnel was assigned
      const personnelOrders = allWorkOrders
        .filter((wo: WorkOrder) => wo.personnelIds && wo.personnelIds.includes(person.id))
        .map((wo: WorkOrder) => {
          const customer = customers.find((c: any) => c.id === wo.customerId)
          return {
            ...wo,
            customerName: customer?.name || 'Bilinmeyen Müşteri'
          }
        })
        .sort((a: WorkOrder, b: WorkOrder) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      setPersonnelWorkOrders(personnelOrders)
    } catch (error) {
      console.error('Error loading personnel details:', error)
      toast.error('Personel detayları yüklenirken hata oluştu')
    } finally {
      setLoadingDetails(false)
    }
  }

  const filterPersonnel = () => {
    let filtered = personnel

    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.contactInfo?.phone?.includes(searchTerm)
      )
    }

    // Filter by balance if enabled
    if (showOnlyWithBalance) {
      filtered = filtered.filter(p => {
        const balance = p.totalBalance || 0
        return balance !== 0
      })
    }

    // Alfabetik sıraya göre sırala
    filtered = filtered.sort((a, b) => a.name.localeCompare(b.name, 'tr'))

    setFilteredPersonnel(filtered)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const payload = {
        name: formData.name,
        role: formData.role,
        contactInfo: {
          phone: formData.phone
        },
        notes: formData.notes
      }

      if (editingPersonnel) {
        await apiCall(`/personnel/${editingPersonnel.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        toast.success('Personel güncellendi!')
      } else {
        await apiCall('/personnel', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        toast.success('Personel eklendi!')
      }

      setIsDialogOpen(false)
      resetForm()
      loadPersonnel()
    } catch (error) {
      console.error('Error saving personnel:', error)
      toast.error('Personel kaydedilirken hata oluştu')
    }
  }

  const handleEdit = (person: Personnel) => {
    setEditingPersonnel(person)
    setFormData({
      name: person.name,
      role: person.role,
      phone: person.contactInfo?.phone || '',
      notes: person.notes || ''
    })
    setIsDialogOpen(true)
  }

  const handleToggleActive = async (person: Personnel) => {
    try {
      await apiCall(`/personnel/${person.id}`, {
        method: 'PUT',
        body: JSON.stringify({ active: !person.active })
      })
      loadPersonnel()
      toast.success(`${person.name} ${!person.active ? 'aktif' : 'pasif'} edildi`)
    } catch (error) {
      console.error('Error updating personnel:', error)
      toast.error('Personel durumu güncellenirken hata oluştu')
    }
  }

  const handleDelete = async (personnelId: string) => {
    if (!confirm('Bu personeli silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/personnel/${personnelId}`, { method: 'DELETE' })
      loadPersonnel()
      toast.success('Personel silindi!')
    } catch (error) {
      console.error('Error deleting personnel:', error)
      toast.error('Personel silinirken hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      role: 'cleaner',
      phone: '',
      notes: ''
    })
    setEditingPersonnel(null)
  }

  const handleCleanupPayroll = async () => {
    if (!confirm('Silinmiş personellere ait yevmiye kayıtlarını temizlemek istediğinize emin misiniz?')) {
      return
    }

    try {
      const result = await apiCall('/personnel/cleanup-payroll', { method: 'POST' })
      toast.success(result.message || `${result.deletedCount} kayıt temizlendi`)
      loadPersonnel()
    } catch (error) {
      console.error('Error cleaning payroll records:', error)
      toast.error('Temizleme işlemi sırasında hata oluştu')
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



  // Calculate total amount to be paid to all personnel
  const calculateTotalPayable = () => {
    return personnel.reduce((sum, person) => {
      const balance = person.totalBalance || 0
      return sum + (balance > 0 ? balance : 0) // Only positive balances (what we owe them)
    }, 0)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  // Personnel Detail View
  if (viewingPersonnel) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => setViewingPersonnel(null)}>
              <X className="h-4 w-4 mr-2" />
              Geri
            </Button>
            <div>
              <h1>{viewingPersonnel.name}</h1>
              <p className="text-gray-500">{viewingPersonnel.role}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Toplam Bakiye</div>
            <div className={`text-2xl font-bold ${
              (viewingPersonnel.totalBalance || 0) > 0 
                ? 'text-red-600' 
                : (viewingPersonnel.totalBalance || 0) < 0 
                  ? 'text-green-600' 
                  : 'text-gray-600'
            }`}>
              {formatCurrency(viewingPersonnel.totalBalance || 0)}
            </div>
          </div>
        </div>

        {/* Personnel Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Personel Bilgileri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Telefon</div>
                <div className="font-medium">{viewingPersonnel.contactInfo?.phone || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Durum</div>
                {viewingPersonnel.active ? (
                  <Badge className="bg-green-100 text-green-800">Aktif</Badge>
                ) : (
                  <Badge variant="secondary">Pasif</Badge>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-500">Kayıt Tarihi</div>
                <div className="font-medium">
                  {new Date(viewingPersonnel.createdAt).toLocaleDateString('tr-TR')}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Toplam İş</div>
                <div className="font-medium text-lg">{personnelWorkOrders.length}</div>
              </div>
            </div>
            {viewingPersonnel.notes && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">Notlar</div>
                <p className="mt-1">{viewingPersonnel.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Orders List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Çalıştığı İşler ({personnelWorkOrders.length} adet)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetails ? (
              <div className="text-center py-8 text-gray-500">Yükleniyor...</div>
            ) : personnelWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Bu personel için henüz iş kaydı bulunmuyor
              </div>
            ) : (
              <div className="space-y-4">
                {personnelWorkOrders.map((workOrder) => {
                  const earned = workOrder.personnelPayments?.[viewingPersonnel.id] || 0
                  
                  return (
                    <div key={workOrder.id} className="border rounded-lg p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-gray-600" />
                          <div>
                            <div className="font-medium">{workOrder.customerName}</div>
                            <div className="text-sm text-gray-500">
                              {formatDate(workOrder.date)} • {new Date(workOrder.date).toLocaleTimeString('tr-TR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(workOrder.status)}
                      </div>

                      {/* Description */}
                      {workOrder.description && (
                        <p className="text-sm text-gray-700">{workOrder.description}</p>
                      )}

                      {/* Financial Info - Personnel Specific */}
                      <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-xs text-gray-500">Hakediş (Bu İşten Kazanılan)</div>
                          <div className="font-bold text-lg text-blue-600">{formatCurrency(earned)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Toplam İş Tutarı</div>
                          <div className="font-bold text-lg text-gray-600">{formatCurrency(workOrder.totalAmount)}</div>
                        </div>
                      </div>

                      {/* Payment tracking note */}
                      {earned > 0 && (
                        <div className="pt-3 border-t">
                          <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                            💡 Ödemeler "Personel Bordroları" sayfasından günlük bazda takip edilmektedir.
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
      </div>
    )
  }

  // Main Personnel List View
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Personel Yönetimi</h1>
          <p className="text-gray-500">
            {personnel.filter(p => p.active).length} aktif personel
            {showOnlyWithBalance && ` • ${filteredPersonnel.length} borcu/alacağı olan`}
          </p>
        </div>
        <div className="flex gap-2">
          {userRole === 'admin' && (
            <Button 
              variant="outline" 
              onClick={handleCleanupPayroll}
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              🧹 Yetim Kayıtları Temizle
            </Button>
          )}
          {canEdit && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Yeni Personel
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingPersonnel ? 'Personeli Düzenle' : 'Yeni Personel Ekle'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Personel Adı *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="ör: Temizlikçi, Şoför"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
      </div>

      {/* Search and Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Personel ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-blue-600" />
                <Label htmlFor="balance-filter" className="cursor-pointer">
                  Sadece Borcu/Alacağı Olanları Göster
                </Label>
              </div>
              <Switch
                id="balance-filter"
                checked={showOnlyWithBalance}
                onCheckedChange={setShowOnlyWithBalance}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personnel List */}
      <Card>
        <CardContent className="p-0">
          {filteredPersonnel.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              Personel bulunamadı
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel Adı</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead className="text-right">Bakiye</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPersonnel.map((person) => {
                    const balance = person.totalBalance || 0
                    const hasDebt = balance > 0
                    const hasCredit = balance < 0
                    
                    return (
                      <TableRow key={person.id}>
                        <TableCell>
                          <div>
                            <div>{person.name}</div>
                            {person.notes && (
                              <div className="text-sm text-gray-500 mt-1">{person.notes}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{person.role}</TableCell>
                        <TableCell>{person.contactInfo?.phone || '-'}</TableCell>
                        <TableCell className="text-right">
                          {balance !== 0 ? (
                            <Badge variant={hasDebt ? 'destructive' : 'default'} className={
                              hasDebt ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }>
                              {hasDebt ? '+' : ''}{balance.toLocaleString('tr-TR')} ₺
                            </Badge>
                          ) : (
                            <span className="text-gray-400">0 ₺</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {person.active ? (
                            <Badge className="bg-green-100 text-green-800">Aktif</Badge>
                          ) : (
                            <Badge variant="secondary">Pasif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadPersonnelDetails(person)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Detay
                            </Button>
                            {canEdit && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEdit(person)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleActive(person)}
                                >
                                  {person.active ? (
                                    <UserX className="h-4 w-4" />
                                  ) : (
                                    <UserCheck className="h-4 w-4" />
                                  )}
                                </Button>
                                {userRole === 'admin' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDelete(person.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Total Payables Summary */}
      <Card className="border-2 border-red-200 bg-red-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-full">
                <TrendingUp className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-medium text-red-900">Toplam Verilecekler</h3>
                <p className="text-sm text-red-700">
                  Tüm personellere ödenmesi gereken toplam tutar
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-red-600">
                {formatCurrency(calculateTotalPayable())}
              </div>
              <div className="text-sm text-red-700">
                {personnel.filter(p => (p.totalBalance || 0) > 0).length} personel
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

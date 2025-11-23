import { useEffect, useState, useRef, useCallback } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Search, Edit, Trash2, Eye, Calendar, DollarSign, Copy, X, CheckCircle, Clock, User } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { toast } from 'sonner@2.0.3'
import { CustomerImport } from './CustomerImport'
import { CustomerCard } from './CustomerCard'
import { CustomerCardSkeleton } from './CustomerCardSkeleton'
import { StickySearchHeader } from './StickySearchHeader'
import { LoadingSpinner } from './LoadingSpinner'

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

const ITEMS_PER_PAGE = 30
const INITIAL_LOAD = 30

export function Customers({ user }: { user: any }) {
  // Data states
  const [allCustomers, setAllCustomers] = useState<Customer[]>([])
  const [displayedCustomers, setDisplayedCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  // Loading states
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  
  // UI states
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

  // Intersection Observer ref
  const observerTarget = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'normal',
    phone: '',
    email: '',
    address: '',
    addresses: [] as string[],
    notes: ''
  })

  const role = user?.user_metadata?.role
  const canEdit = role === 'admin' || role === 'secretary'

  // Load all customers from API
  const loadAllCustomers = async () => {
    setInitialLoading(true)
    try {
      const result = await apiCall('/customers')
      const customers = result.customers || []
      
      // Remove duplicates
      const uniqueCustomers = customers.filter((customer: Customer, index: number, self: Customer[]) => 
        index === self.findIndex((c) => c.id === customer.id)
      )
      
      if (customers.length !== uniqueCustomers.length) {
        const duplicateCount = customers.length - uniqueCustomers.length
        console.log(`ℹ️ ${duplicateCount} tekrarlayan müşteri filtrelendi (toplam ${uniqueCustomers.length} benzersiz müşteri)`)
      }
      
      setAllCustomers(uniqueCustomers)
      setCurrentPage(1)
    } catch (error) {
      console.error('Error loading customers:', error)
      toast.error('Müşteriler yüklenirken hata oluştu')
    } finally {
      setInitialLoading(false)
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

  // Filter customers based on search and filter type
  const applyFilters = useCallback(() => {
    let filtered = allCustomers

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
    setCurrentPage(1) // Reset pagination when filters change
  }, [allCustomers, searchTerm, filterType])

  // Apply pagination to filtered customers
  const applyPagination = useCallback(() => {
    const startIndex = 0
    const endIndex = currentPage * ITEMS_PER_PAGE
    const paginated = filteredCustomers.slice(startIndex, endIndex)
    
    setDisplayedCustomers(paginated)
    setHasMore(endIndex < filteredCustomers.length)
  }, [filteredCustomers, currentPage])

  // Load more items
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || initialLoading) return
    
    setLoadingMore(true)
    
    // Simulate async loading for smooth UX
    setTimeout(() => {
      setCurrentPage(prev => prev + 1)
      setLoadingMore(false)
    }, 300)
  }, [hasMore, loadingMore, initialLoading])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [loadMore])

  // Initial load
  useEffect(() => {
    loadAllCustomers()
    loadPersonnel()
  }, [])

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  // Apply pagination when dependencies change
  useEffect(() => {
    applyPagination()
  }, [applyPagination])

  const loadCustomerDetails = useCallback(async (customer: Customer) => {
    setViewingCustomer(customer)
    setLoadingDetails(true)
    
    try {
      const result = await apiCall('/work-orders')
      const allWorkOrders = result.workOrders || []
      
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
  }, [])

  const handleDuplicateWorkOrder = (workOrder: WorkOrder) => {
    setDuplicatingWorkOrder(workOrder)
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    setDuplicateFormData({
      date: tomorrow.toISOString().split('T')[0],
      time: '09:00',
      description: workOrder.description || '',
      totalAmount: workOrder.totalAmount || 0,
      paidAmount: 0,
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
      
      if (viewingCustomer) {
        loadCustomerDetails(viewingCustomer)
      }
    } catch (error) {
      console.error('Error duplicating work order:', error)
      toast.error('İş emri kopyalanırken hata oluştu')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const validAddresses = formData.addresses.filter(addr => addr.trim() !== '')
      
      const payload = {
        name: formData.name,
        type: formData.type,
        contactInfo: {
          phone: formData.phone,
          email: formData.email
        },
        address: formData.address,
        addresses: validAddresses,
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
      loadAllCustomers()
      toast.success('Müşteri başarıyla kaydedildi!')
    } catch (error) {
      console.error('Error saving customer:', error)
      toast.error('Müşteri kaydedilirken hata oluştu')
    }
  }

  const handleEdit = useCallback((customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      type: customer.type,
      phone: customer.contactInfo?.phone || '',
      email: customer.contactInfo?.email || '',
      address: customer.address || '',
      addresses: (customer as any).addresses || [],
      notes: customer.notes || ''
    })
    setIsDialogOpen(true)
  }, [])

  const handleDelete = useCallback(async (customerId: string) => {
    if (!confirm('Bu müşteriyi silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/customers/${customerId}`, { method: 'DELETE' })
      loadAllCustomers()
      toast.success('Müşteri başarıyla silindi!')
    } catch (error) {
      console.error('Error deleting customer:', error)
      toast.error('Müşteri silinirken hata oluştu')
    }
  }, [])

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'normal',
      phone: '',
      email: '',
      address: '',
      addresses: [],
      notes: ''
    })
    setEditingCustomer(null)
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

  // Initial loading state
  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4">
          {/* Header Skeleton */}
          <div className="mb-6">
            <div className="h-8 w-48 bg-gray-200 rounded mb-2 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          
          {/* Search Header Skeleton */}
          <div className="bg-white border-b border-gray-200 p-4 mb-6 rounded-lg">
            <div className="h-10 bg-gray-200 rounded mb-3 animate-pulse" />
            <div className="flex gap-3">
              <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-24 bg-gray-200 rounded animate-pulse ml-auto" />
            </div>
          </div>

          {/* Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <CustomerCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Customer Detail View
  if (viewingCustomer) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1>Müşteri Detayları</h1>
            <p className="text-gray-500">{viewingCustomer.name}</p>
          </div>
          <Button variant="outline" onClick={() => setViewingCustomer(null)}>
            <X className="h-4 w-4 mr-2" />
            Listeye Dön
          </Button>
        </div>

        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Müşteri Bilgileri</span>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => handleEdit(viewingCustomer)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Düzenle
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Müşteri Adı</Label>
                <p>{viewingCustomer.name}</p>
              </div>
              <div>
                <Label>Müşteri Tipi</Label>
                <p>
                  {viewingCustomer.type === 'regular' ? 'Düzenli Müşteri' : 
                   viewingCustomer.type === 'problematic' ? 'Sıkıntılı Müşteri' : 'Normal Müşteri'}
                </p>
              </div>
              <div>
                <Label>Telefon</Label>
                <p>{viewingCustomer.contactInfo?.phone || '-'}</p>
              </div>
              <div>
                <Label>E-posta</Label>
                <p>{viewingCustomer.contactInfo?.email || '-'}</p>
              </div>
              <div className="col-span-2">
                <Label>Adres</Label>
                <p>{viewingCustomer.address || '-'}</p>
              </div>
              {(viewingCustomer as any).addresses && (viewingCustomer as any).addresses.length > 0 && (
                <div className="col-span-2">
                  <Label>Ek Adresler</Label>
                  <ul className="list-disc list-inside space-y-1">
                    {(viewingCustomer as any).addresses.map((addr: string, index: number) => (
                      <li key={index}>{addr}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="col-span-2">
                <Label>Bakiye</Label>
                <p className={viewingCustomer.balance > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  {formatCurrency(viewingCustomer.balance)}
                </p>
              </div>
              {viewingCustomer.notes && (
                <div className="col-span-2">
                  <Label>Notlar</Label>
                  <p className="text-sm text-gray-600">{viewingCustomer.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Work Orders */}
        <Card>
          <CardHeader>
            <CardTitle>İş Emirleri ({customerWorkOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingDetails ? (
              <LoadingSpinner message="İş emirleri yükleniyor..." />
            ) : customerWorkOrders.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Henüz iş emri bulunmuyor</p>
            ) : (
              <div className="space-y-4">
                {customerWorkOrders.map((workOrder) => (
                  <Card key={workOrder.id} className="border-l-4 border-blue-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {getStatusBadge(workOrder.status)}
                            <span className="text-sm text-gray-500">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {formatDate(workOrder.date)}
                            </span>
                          </div>
                          {workOrder.description && (
                            <p className="text-sm text-gray-600">{workOrder.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Tutar</div>
                            <div className="font-bold text-gray-900">
                              {formatCurrency(workOrder.totalAmount)}
                            </div>
                          </div>
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDuplicateWorkOrder(workOrder)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {workOrder.personnelIds && workOrder.personnelIds.length > 0 && (
                        <div className="border-t pt-3">
                          <Label className="text-xs text-gray-500">Personel</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {workOrder.personnelIds.map((pId) => (
                              <Badge key={pId} variant="secondary" className="text-xs">
                                <User className="h-3 w-3 mr-1" />
                                {getPersonnelName(pId)}
                                {workOrder.personnelPayments?.[pId] && (
                                  <span className="ml-1">({formatCurrency(workOrder.personnelPayments[pId])})</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duplicate Work Order Dialog */}
        {duplicatingWorkOrder && (
          <Dialog open={!!duplicatingWorkOrder} onOpenChange={(open) => {
            if (!open) {
              setDuplicatingWorkOrder(null)
              setDuplicateFormData(null)
            }
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>İş Emri Kopyala</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitDuplicate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dup-date">Tarih *</Label>
                    <Input
                      id="dup-date"
                      type="date"
                      value={duplicateFormData?.date || ''}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dup-time">Saat *</Label>
                    <Input
                      id="dup-time"
                      type="time"
                      value={duplicateFormData?.time || ''}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, time: e.target.value })}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="dup-description">Açıklama</Label>
                  <Textarea
                    id="dup-description"
                    value={duplicateFormData?.description || ''}
                    onChange={(e) => setDuplicateFormData({ ...duplicateFormData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dup-totalAmount">Toplam Tutar *</Label>
                    <Input
                      id="dup-totalAmount"
                      type="number"
                      step="0.01"
                      value={duplicateFormData?.totalAmount || ''}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, totalAmount: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dup-paidAmount">Ödenen Tutar</Label>
                    <Input
                      id="dup-paidAmount"
                      type="number"
                      step="0.01"
                      value={duplicateFormData?.paidAmount || ''}
                      onChange={(e) => setDuplicateFormData({ ...duplicateFormData, paidAmount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
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
                  <Button type="submit">Kopyala</Button>
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
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Müşteri Yönetimi</h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                {allCustomers.length} müşteri kayıtlı
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-2 flex-shrink-0">
                <div className="hidden sm:block">
                  <CustomerImport 
                    onImportComplete={loadAllCustomers}
                    user={user}
                  />
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                  setIsDialogOpen(open)
                  if (!open) resetForm()
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-sm sm:text-base">
                      <Plus className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Yeni Müşteri</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                            <SelectTrigger id="type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal Müşteri</SelectItem>
                              <SelectItem value="regular">Düzenli Müşteri</SelectItem>
                              <SelectItem value="problematic">Sıkıntılı Müşteri</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefon</Label>
                          <Input
                            id="phone"
                            type="tel"
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
                        <Label htmlFor="address">Ana Adres</Label>
                        <Textarea
                          id="address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Ek Adresler</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              addresses: [...formData.addresses, '']
                            })
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Adres Ekle
                        </Button>
                        {formData.addresses.length > 0 && (
                          <div className="space-y-2">
                            {formData.addresses.map((addr, index) => (
                              <div key={index} className="flex gap-2">
                                <Textarea
                                  value={addr}
                                  onChange={(e) => {
                                    const newAddresses = [...formData.addresses]
                                    newAddresses[index] = e.target.value
                                    setFormData({ ...formData, addresses: newAddresses })
                                  }}
                                  rows={2}
                                  placeholder={`Ek adres ${index + 1}...`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newAddresses = formData.addresses.filter((_, i) => i !== index)
                                    setFormData({ ...formData, addresses: newAddresses })
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Search and Filter Header */}
      <StickySearchHeader
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        onFilterChange={setFilterType}
        totalCount={allCustomers.length}
        filteredCount={filteredCustomers.length}
      />

      {/* Customer Cards Grid */}
      <div className="max-w-7xl mx-auto p-3 sm:p-4">
        {filteredCustomers.length === 0 && !initialLoading ? (
          <Card className="mt-8">
            <CardContent className="py-16 text-center">
              <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Müşteri bulunamadı</h3>
              <p className="text-sm text-gray-600">
                Arama kriterlerinize uygun müşteri bulunamadı. Lütfen filtreleri değiştirin.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Customer Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {displayedCustomers.map((customer) => (
                <CustomerCard
                  key={customer.id}
                  customer={customer}
                  onView={loadCustomerDetails}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  canEdit={canEdit}
                />
              ))}
            </div>

            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="mt-6 sm:mt-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <CustomerCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            )}

            {/* Intersection Observer Target */}
            {hasMore && !loadingMore && (
              <div ref={observerTarget} className="h-20 flex items-center justify-center">
                <div className="text-sm text-gray-500">Daha fazla yükle...</div>
              </div>
            )}

            {/* End of List Message */}
            {!hasMore && displayedCustomers.length > 0 && (
              <div className="mt-8 py-8 text-center border-t border-gray-200">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  Tüm müşteriler yüklendi ({displayedCustomers.length} müşteri)
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
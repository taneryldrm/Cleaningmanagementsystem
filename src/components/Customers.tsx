import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'
import { Textarea } from './ui/textarea'

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

export function Customers({ user }: { user: any }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

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
    } catch (error) {
      console.error('Error saving customer:', error)
      alert('Müşteri kaydedilirken hata oluştu')
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
    } catch (error) {
      console.error('Error deleting customer:', error)
      alert('Müşteri silinirken hata oluştu')
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount || 0)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

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
                    {canEdit && (
                      <div className="flex gap-2">
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
                      </div>
                    )}
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

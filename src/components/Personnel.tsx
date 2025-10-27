import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { Plus, Search, Edit, Trash2, UserCheck, UserX, Eye, Filter } from 'lucide-react'
import { Textarea } from './ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'
import { Switch } from './ui/switch'

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

export function Personnel({ user }: { user: any }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null)
  const [personnelHistory, setPersonnelHistory] = useState<any[]>([])

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
      } else {
        await apiCall('/personnel', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }

      setIsDialogOpen(false)
      resetForm()
      loadPersonnel()
    } catch (error) {
      console.error('Error saving personnel:', error)
      alert('Personel kaydedilirken hata oluştu')
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
    } catch (error) {
      console.error('Error updating personnel:', error)
      alert('Personel durumu güncellenirken hata oluştu')
    }
  }

  const handleDelete = async (personnelId: string) => {
    if (!confirm('Bu personeli silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiCall(`/personnel/${personnelId}`, { method: 'DELETE' })
      loadPersonnel()
    } catch (error) {
      console.error('Error deleting personnel:', error)
      alert('Personel silinirken hata oluştu')
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

  const handleViewDetails = async (person: Personnel) => {
    setSelectedPersonnel(person)
    setDetailDialogOpen(true)
    
    // Load work history for this personnel
    try {
      const result = await apiCall(`/personnel/${person.id}/history`)
      setPersonnelHistory(result.history || [])
    } catch (error) {
      console.error('Error loading personnel history:', error)
      setPersonnelHistory([])
    }
  }

  const handleCleanupPayroll = async () => {
    if (!confirm('Silinmiş personellere ait yevmiye kayıtlarını temizlemek istediğinize emin misiniz?')) {
      return
    }

    try {
      const result = await apiCall('/personnel/cleanup-payroll', { method: 'POST' })
      alert(result.message || `${result.deletedCount} kayıt temizlendi`)
      loadPersonnel() // Reload to refresh balances
    } catch (error) {
      console.error('Error cleaning payroll records:', error)
      alert('Temizleme işlemi sırasında hata oluştu')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

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
                              onClick={() => handleViewDetails(person)}
                            >
                              <Eye className="h-4 w-4" />
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

      {/* Personnel Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedPersonnel?.name} - İş Geçmişi</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-500">Rol</p>
                <p>{selectedPersonnel?.role}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telefon</p>
                <p>{selectedPersonnel?.contactInfo?.phone || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Notlar</p>
                <p>{selectedPersonnel?.notes || '-'}</p>
              </div>
            </div>

            <div>
              <h3 className="mb-3">Çalıştığı İşler</h3>
              {personnelHistory.length === 0 ? (
                <p className="text-center text-gray-500 py-8">İş geçmişi bulunamadı</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {personnelHistory.map((work: any) => (
                    <Card key={work.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4>{work.customerName}</h4>
                              <Badge variant="outline" className={
                                work.status === 'completed' ? 'bg-green-100 text-green-800' :
                                work.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }>
                                {work.status === 'completed' ? 'Tamamlandı' :
                                 work.status === 'approved' ? 'Onaylandı' : 'Taslak'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {new Date(work.date).toLocaleDateString('tr-TR')}
                            </p>
                            {work.description && (
                              <p className="text-sm text-gray-600 mt-1">{work.description}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Tutar</p>
                            <p>{work.totalAmount ? `${work.totalAmount.toFixed(2)} TL` : '-'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Badge } from './ui/badge'
import { Plus, Search, Edit, Trash2, UserCheck, UserX } from 'lucide-react'
import { Textarea } from './ui/textarea'

interface Personnel {
  id: string
  name: string
  role: string
  contactInfo: any
  notes: string
  active: boolean
  createdAt: string
}

export function Personnel({ user }: { user: any }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [filteredPersonnel, setFilteredPersonnel] = useState<Personnel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)

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
  }, [searchTerm, personnel])

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
          </p>
        </div>
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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Personel ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Personnel List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredPersonnel.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center text-gray-500">
              Personel bulunamadı
            </CardContent>
          </Card>
        ) : (
          filteredPersonnel.map((person) => (
            <Card key={person.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {person.name}
                      {person.active ? (
                        <Badge className="bg-green-100 text-green-800">Aktif</Badge>
                      ) : (
                        <Badge variant="secondary">Pasif</Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{person.role}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {person.contactInfo?.phone && (
                  <div className="text-sm">
                    <span className="text-gray-500">Telefon: </span>
                    {person.contactInfo.phone}
                  </div>
                )}
                {person.notes && (
                  <div className="text-sm text-gray-600">
                    {person.notes}
                  </div>
                )}
                {canEdit && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(person)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Düzenle
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(person)}
                      className="flex-1"
                    >
                      {person.active ? (
                        <>
                          <UserX className="h-4 w-4 mr-1" />
                          Pasifleştir
                        </>
                      ) : (
                        <>
                          <UserCheck className="h-4 w-4 mr-1" />
                          Aktifleştir
                        </>
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
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

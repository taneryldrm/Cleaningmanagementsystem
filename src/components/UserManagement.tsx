import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Plus, UserPlus, Shield } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string
  role: string
  permissions: any
  createdAt: string
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cleaner',
    canManageFinance: false,
    canEditWorkOrders: false,
    canManagePersonnel: false
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const result = await apiCall('/users')
      setUsers(result.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const permissions: any = {}
      
      if (formData.canManageFinance) permissions.canManageFinance = true
      if (formData.canEditWorkOrders) permissions.canEditWorkOrders = true
      if (formData.canManagePersonnel) permissions.canManagePersonnel = true

      const payload = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        permissions
      }

      await apiCall('/signup', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setIsDialogOpen(false)
      resetForm()
      loadUsers()
    } catch (error) {
      console.error('Error creating user:', error)
      alert('Kullanıcı oluşturulurken hata: ' + (error as Error).message)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'cleaner',
      canManageFinance: false,
      canEditWorkOrders: false,
      canManagePersonnel: false
    })
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-800',
      secretary: 'bg-blue-100 text-blue-800',
      driver: 'bg-green-100 text-green-800',
      cleaner: 'bg-gray-100 text-gray-800'
    }

    const labels: Record<string, string> = {
      admin: 'Yönetici',
      secretary: 'Sekreter',
      driver: 'Şoför',
      cleaner: 'Temizlikçi'
    }

    return (
      <Badge className={colors[role] || 'bg-gray-100 text-gray-800'}>
        {labels[role] || role}
      </Badge>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Kullanıcı Yönetimi</h1>
          <p className="text-gray-500">{users.length} kullanıcı kayıtlı</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Yeni Kullanıcı
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Ad Soyad *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Şifre *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rol *</Label>
                  <Select 
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Yönetici</SelectItem>
                      <SelectItem value="secretary">Sekreter</SelectItem>
                      <SelectItem value="driver">Şoför</SelectItem>
                      <SelectItem value="cleaner">Temizlikçi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-3 border-t pt-4">
                <Label>Ek Yetkiler</Label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.canManageFinance}
                      onChange={(e) => setFormData({ ...formData, canManageFinance: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Gelir-Gider Yönetimi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.canEditWorkOrders}
                      onChange={(e) => setFormData({ ...formData, canEditWorkOrders: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">İş Emri Düzenleme</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.canManagePersonnel}
                      onChange={(e) => setFormData({ ...formData, canManagePersonnel: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">Personel Yönetimi</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  İptal
                </Button>
                <Button type="submit">Oluştur</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users List */}
      <div className="grid gap-4">
        {users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              Kullanıcı bulunamadı
            </CardContent>
          </Card>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {user.name}
                      {getRoleBadge(user.role)}
                    </CardTitle>
                    <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {user.createdAt && (
                      <div>
                        Oluşturulma: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              {user.permissions && Object.keys(user.permissions).length > 0 && (
                <CardContent>
                  <div className="text-sm">
                    <span className="text-gray-500">Ek Yetkiler: </span>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {user.permissions.canManageFinance && (
                        <Badge variant="secondary">Gelir-Gider Yönetimi</Badge>
                      )}
                      {user.permissions.canEditWorkOrders && (
                        <Badge variant="secondary">İş Emri Düzenleme</Badge>
                      )}
                      {user.permissions.canManagePersonnel && (
                        <Badge variant="secondary">Personel Yönetimi</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

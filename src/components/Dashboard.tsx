import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { 
  Calendar,
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface DailyPersonnelCount {
  date: string
  count: number
  workOrders: any[]
}

interface CustomerSearchResult {
  id: string
  name: string
  phone: string
  address: string
  type: 'regular' | 'problematic' | 'normal'
  workOrders: {
    id: string
    date: string
    status: string
    totalAmount: number
    paidAmount: number
    description: string
  }[]
  totalSpent: number
  totalDebt: number
  lastWorkDate: string | null
}

interface DashboardProps {
  user: any
  onNavigate?: (page: string) => void
}

export function Dashboard({ user, onNavigate }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [dailyPersonnel, setDailyPersonnel] = useState<DailyPersonnelCount[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResult, setSearchResult] = useState<CustomerSearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [pendingAmount, setPendingAmount] = useState(0)
  const [pendingCustomers, setPendingCustomers] = useState(0)

  const userRole = user?.user_metadata?.role
  const userName = user?.user_metadata?.name || 'Kullanıcı'

  useEffect(() => {
    loadDashboardData()
    loadPendingCollections()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Get next 10 days of work orders
      const today = new Date()
      const next10Days: DailyPersonnelCount[] = []
      
      const workOrdersResult = await apiCall('/work-orders')
      const workOrders = workOrdersResult.workOrders || []
      
      for (let i = 0; i < 10; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]
        
        const dayWorkOrders = workOrders.filter((wo: any) => {
          return wo.date?.startsWith(dateStr) && 
                 (wo.status === 'draft' || wo.status === 'approved' || wo.status === 'completed')
        })
        
        // Count unique personnel
        const uniquePersonnel = new Set<string>()
        dayWorkOrders.forEach((wo: any) => {
          if (wo.personnelIds && Array.isArray(wo.personnelIds)) {
            wo.personnelIds.forEach((id: string) => uniquePersonnel.add(id))
          }
        })
        
        next10Days.push({
          date: dateStr,
          count: uniquePersonnel.size,
          workOrders: dayWorkOrders
        })
      }
      
      setDailyPersonnel(next10Days)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Dashboard verileri yüklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const loadPendingCollections = async () => {
    try {
      const response = await apiCall('/pending-collections')
      const customerDebts = response.customerDebts || []
      
      const totalAmount = customerDebts.reduce((sum: number, debt: any) => sum + debt.totalDebt, 0)
      setPendingAmount(totalAmount)
      setPendingCustomers(customerDebts.length)
    } catch (error) {
      console.error('Error loading pending collections:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Lütfen müşteri adı veya telefon numarası girin')
      return
    }

    try {
      setSearching(true)
      setSearchResult(null)
      
      const customersResult = await apiCall('/customers')
      const customers = customersResult.customers || []
      
      const query = searchQuery.toLowerCase().trim()
      const customer = customers.find((c: any) => {
        const nameMatch = c.name?.toLowerCase().includes(query)
        const phoneMatch = c.contactInfo?.phone?.includes(query)
        return nameMatch || phoneMatch
      })
      
      if (!customer) {
        toast.error('Müşteri bulunamadı')
        return
      }
      
      // Get all work orders for this customer
      const workOrdersResult = await apiCall('/work-orders')
      const allWorkOrders = workOrdersResult.workOrders || []
      
      const customerWorkOrders = allWorkOrders
        .filter((wo: any) => wo.customerId === customer.id)
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      
      // Calculate totals
      let totalSpent = 0
      let totalDebt = 0
      
      customerWorkOrders.forEach((wo: any) => {
        totalSpent += wo.paidAmount || 0
        totalDebt += (wo.totalAmount || 0) - (wo.paidAmount || 0)
      })
      
      const lastWorkDate = customerWorkOrders.length > 0 
        ? customerWorkOrders[0].date 
        : null
      
      setSearchResult({
        id: customer.id,
        name: customer.name,
        phone: customer.contactInfo?.phone || '-',
        address: customer.contactInfo?.address || '-',
        type: customer.type || 'normal',
        workOrders: customerWorkOrders.map((wo: any) => ({
          id: wo.id,
          date: wo.date,
          status: wo.status,
          totalAmount: wo.totalAmount || 0,
          paidAmount: wo.paidAmount || 0,
          description: wo.description || ''
        })),
        totalSpent,
        totalDebt,
        lastWorkDate
      })
      
      toast.success('Müşteri bulundu!')
    } catch (error) {
      console.error('Error searching customer:', error)
      toast.error('Arama sırasında hata oluştu')
    } finally {
      setSearching(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR', { 
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    })
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

  const getCustomerTypeBadge = (type: string) => {
    switch (type) {
      case 'regular':
        return <Badge className="bg-blue-100 text-blue-800">Düzenli</Badge>
      case 'problematic':
        return <Badge className="bg-red-100 text-red-800">Sıkıntılı</Badge>
      default:
        return <Badge className="bg-gray-100 text-gray-800">Normal</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Hoşgeldiniz, {userName}</h1>
          <p className="text-gray-500">
            {userRole === 'admin' && 'Yönetici Paneli'}
            {userRole === 'secretary' && 'Sekreter Paneli'}
            {userRole === 'driver' && 'Şoför Paneli'}
            {userRole === 'cleaner' && 'Temizlikçi Paneli'}
          </p>
        </div>
        {(userRole === 'admin' || userRole === 'secretary') && (
          <Button onClick={() => onNavigate?.('work-orders')}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni İş Emri Oluştur
          </Button>
        )}
      </div>

      {/* Pending Collections Alert - Admin & Secretary Only */}
      {(userRole === 'admin' || userRole === 'secretary') && pendingAmount > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-200">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">Bekleyen Tahsilatlar</h3>
                  <p className="text-sm text-red-700">
                    {pendingCustomers} müşteriden toplam {formatCurrency(pendingAmount)} alacak var
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                className="border-red-300 hover:bg-red-100"
                onClick={() => onNavigate?.('pending-collections')}
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Detayları Gör
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Personnel Count - Next 10 Days */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Önümüzdeki 10 Gün - Çalışan Personel Sayısı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dailyPersonnel.map((day, index) => {
              const isToday = index === 0
              return (
                <div 
                  key={day.date} 
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isToday ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${
                      isToday ? 'bg-blue-200' : 'bg-gray-200'
                    }`}>
                      <span className="font-bold">
                        {new Date(day.date).toLocaleDateString('tr-TR', { day: 'numeric' })}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">
                        {formatDate(day.date)}
                        {isToday && <Badge className="ml-2 bg-blue-600">Bugün</Badge>}
                      </div>
                      <div className="text-sm text-gray-600">
                        {day.workOrders.length} iş emri
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className={`h-5 w-5 ${isToday ? 'text-blue-600' : 'text-gray-600'}`} />
                    <span className={`text-2xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {day.count}
                    </span>
                    <span className="text-gray-500">personel</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customer Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Müşteri Arama
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Müşteri adı veya telefon numarası..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4 mr-2" />
              {searching ? 'Aranıyor...' : 'Ara'}
            </Button>
          </div>

          {searchResult && (
            <div className="space-y-4 pt-4 border-t">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{searchResult.name}</h3>
                    {getCustomerTypeBadge(searchResult.type)}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => onNavigate?.('customers')}
                  >
                    Detaylar
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-600" />
                    <span>{searchResult.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="truncate">{searchResult.address}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-3 border-t">
                  <div>
                    <div className="text-xs text-gray-500">Toplam Harcama</div>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(searchResult.totalSpent)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Kalan Borç</div>
                    <div className="text-lg font-bold text-red-600">
                      {formatCurrency(searchResult.totalDebt)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Son İş</div>
                    <div className="text-sm font-medium">
                      {searchResult.lastWorkDate 
                        ? new Date(searchResult.lastWorkDate).toLocaleDateString('tr-TR')
                        : 'Yok'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Work Orders History */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  İş Geçmişi ({searchResult.workOrders.length} adet)
                </h4>
                
                {searchResult.workOrders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Bu müşteri için henüz iş emri bulunmuyor
                  </div>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResult.workOrders.map((wo) => (
                      <div 
                        key={wo.id} 
                        className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {wo.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-600" />}
                            {wo.status === 'approved' && <Clock className="h-4 w-4 text-blue-600" />}
                            {wo.status === 'draft' && <AlertCircle className="h-4 w-4 text-yellow-600" />}
                            <span className="font-medium">
                              {new Date(wo.date).toLocaleDateString('tr-TR', { 
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </span>
                          </div>
                          {getStatusBadge(wo.status)}
                        </div>
                        
                        {wo.description && (
                          <p className="text-sm text-gray-600 mb-2">{wo.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-gray-500">Tutar: </span>
                              <span className="font-medium">{formatCurrency(wo.totalAmount)}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Ödenen: </span>
                              <span className="font-medium text-green-600">
                                {formatCurrency(wo.paidAmount)}
                              </span>
                            </div>
                          </div>
                          {wo.paidAmount < wo.totalAmount && (
                            <div className="text-red-600 font-medium">
                              Kalan: {formatCurrency(wo.totalAmount - wo.paidAmount)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

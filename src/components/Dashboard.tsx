import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { 
  ClipboardList, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Users,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'

interface DashboardData {
  todayWorkOrders: number
  draftCount: number
  income: number
  expense: number
  balance: number
  pendingInvoices: number
  overdueInvoices: number
  totalOutstanding: number
  myTasks?: any[]
  todayAssignments?: any[]
}

interface DashboardProps {
  user: any
}

export function Dashboard({ user }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const result = await apiCall('/dashboard')
      setData(result)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Yükleniyor...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Dashboard verileri yüklenemedi</AlertDescription>
      </Alert>
    )
  }

  const role = user?.user_metadata?.role
  const userName = user?.user_metadata?.name || 'Kullanıcı'

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Hoşgeldiniz, {userName}</h1>
        <p className="text-gray-500">
          {role === 'admin' && 'Yönetici Paneli'}
          {role === 'secretary' && 'Sekreter Paneli'}
          {role === 'driver' && 'Şoför Paneli'}
          {role === 'cleaner' && 'Temizlikçi Paneli'}
        </p>
      </div>

      {/* Alerts */}
      {data.draftCount > 0 && role !== 'cleaner' && role !== 'driver' && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {data.draftCount} adet onay bekleyen iş emri var. 
            Gece 00:00'da otomatik olarak onaylanacak.
          </AlertDescription>
        </Alert>
      )}

      {data.overdueInvoices > 0 && role !== 'cleaner' && role !== 'driver' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {data.overdueInvoices} adet vadesi geçmiş fatura var!
          </AlertDescription>
        </Alert>
      )}

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bugünkü İşler</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{data.todayWorkOrders}</div>
            <p className="text-xs text-muted-foreground">
              Bugün planlanmış işler
            </p>
          </CardContent>
        </Card>

        {role !== 'cleaner' && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Toplam Gelir</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{formatCurrency(data.income)}</div>
                <p className="text-xs text-muted-foreground">
                  Toplam gelir
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Toplam Gider</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{formatCurrency(data.expense)}</div>
                <p className="text-xs text-muted-foreground">
                  Toplam gider
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Bakiye</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{formatCurrency(data.balance)}</div>
                <p className="text-xs text-muted-foreground">
                  Net bakiye
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Financial Overview */}
      {role !== 'cleaner' && role !== 'driver' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Fatura Durumu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-yellow-600" />
                  <span>Bekleyen Faturalar</span>
                </div>
                <span className="font-bold">{data.pendingInvoices}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span>Vadesi Geçmiş</span>
                </div>
                <span className="font-bold text-red-600">{data.overdueInvoices}</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t">
                <span>Toplam Alacak</span>
                <span className="font-bold">{formatCurrency(data.totalOutstanding)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>İş Emri Durumu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span>Onay Bekleyen</span>
                </div>
                <span className="font-bold">{data.draftCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Bugün Planlanmış</span>
                </div>
                <span className="font-bold">{data.todayWorkOrders}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Driver View */}
      {role === 'driver' && data.todayAssignments && (
        <Card>
          <CardHeader>
            <CardTitle>Bugünkü Görevler</CardTitle>
          </CardHeader>
          <CardContent>
            {data.todayAssignments.length === 0 ? (
              <p className="text-gray-500">Bugün için planlanmış görev yok</p>
            ) : (
              <div className="space-y-2">
                {data.todayAssignments.map((task: any) => (
                  <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span>{task.description || 'İş emri'}</span>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">{task.personnelCount} kişi</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cleaner View */}
      {role === 'cleaner' && data.myTasks && (
        <Card>
          <CardHeader>
            <CardTitle>Bugünkü Görevlerim</CardTitle>
          </CardHeader>
          <CardContent>
            {data.myTasks.length === 0 ? (
              <p className="text-gray-500">Bugün için planlanmış göreviniz yok</p>
            ) : (
              <div className="space-y-2">
                {data.myTasks.map((task: any) => (
                  <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                    <p>{task.description || 'İş emri'}</p>
                    <p className="text-sm text-gray-500">
                      Durum: {task.status === 'approved' ? 'Onaylandı' : 'Beklemede'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

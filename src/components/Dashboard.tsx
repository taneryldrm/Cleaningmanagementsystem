import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { 
  ClipboardList, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  DollarSign,
  Calendar,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { Alert, AlertDescription } from './ui/alert'
import { 
  LineChart, 
  Line, 
  ResponsiveContainer,
  Tooltip
} from 'recharts'

interface DashboardData {
  todayWorkOrders: number
  draftCount: number
  income: number
  expense: number
  balance: number
  totalReceivables: number
  totalPayables: number
  myTasks?: any[]
  todayAssignments?: any[]
  thisMonthIncome?: number
  lastMonthIncome?: number
  thisMonthExpense?: number
  lastMonthExpense?: number
  thisMonthProfit?: number
  lastMonthProfit?: number
  recentTrend?: Array<{ date: string; amount: number }>
  upcomingWorkOrders?: number
  completedThisMonth?: number
  problematicCustomers?: number
}

interface DashboardProps {
  user: any
}

export function Dashboard({ user }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [migrating, setMigrating] = useState(false)
  const [migrationMessage, setMigrationMessage] = useState('')

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const result = await apiCall('/dashboard')
      console.log('Dashboard data received:', result)
      console.log('This Month Income:', result.thisMonthIncome)
      console.log('This Month Expense:', result.thisMonthExpense)
      console.log('This Month Profit:', result.thisMonthProfit)
      console.log('Full data as JSON:', JSON.stringify(result, null, 2))
      setData(result)
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMigrateCollections = async () => {
    if (!confirm('Mevcut iş emirlerini günlük tahsilat kayıtlarına aktarmak istediğinize emin misiniz?')) {
      return
    }

    setMigrating(true)
    setMigrationMessage('')

    try {
      const result = await apiCall('/migrate-collections', { method: 'POST' })
      setMigrationMessage(`✅ ${result.message}`)
      // Reload dashboard to show updated data
      loadDashboard()
    } catch (error) {
      console.error('Error migrating collections:', error)
      setMigrationMessage(`❌ Hata: ${error}`)
    } finally {
      setMigrating(false)
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
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const calculateChange = (current: number = 0, previous: number = 0) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const incomeChange = calculateChange(data?.thisMonthIncome, data?.lastMonthIncome)
  const expenseChange = calculateChange(data?.thisMonthExpense, data?.lastMonthExpense)
  const profitChange = calculateChange(data?.thisMonthProfit, data?.lastMonthProfit)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Hoşgeldiniz, {userName}</h1>
          <p className="text-gray-500">
            {role === 'admin' && 'Yönetici Paneli'}
            {role === 'secretary' && 'Sekreter Paneli'}
            {role === 'driver' && 'Şoför Paneli'}
            {role === 'cleaner' && 'Temizlikçi Paneli'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadDashboard} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Yenile
          </Button>
          {role === 'admin' && (
            <Button
              onClick={handleMigrateCollections}
              disabled={migrating}
              variant={data && data.balance === 0 ? "default" : "outline"}
              size="sm"
              className={data && data.balance === 0 ? "animate-pulse bg-blue-600 hover:bg-blue-700" : ""}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${migrating ? 'animate-spin' : ''}`} />
              Senkronize Et
            </Button>
          )}
        </div>
      </div>

      {/* Migration Message */}
      {migrationMessage && (
        <Alert variant={migrationMessage.startsWith('✅') ? 'default' : 'destructive'}>
          <AlertDescription>{migrationMessage}</AlertDescription>
        </Alert>
      )}

      {/* Debug Info - Show if no data */}
      {role === 'admin' && data && (data.thisMonthIncome === 0 && data.thisMonthExpense === 0 && data.balance === 0) && (
        <Alert variant="default" className="bg-blue-50 border-blue-200 border-2">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription>
            <div className="space-y-2">
              <div>
                <strong className="text-blue-900">⚠️ Dashboard'da veri görünmüyor!</strong>
              </div>
              <div className="text-sm">
                Mevcut iş emirlerinizden tahsilat kayıtları henüz oluşturulmamış. 
                Sağ üstteki <strong>"Senkronize Et"</strong> butonuna basarak tüm iş emirlerinden otomatik tahsilat kayıtları oluşturabilirsiniz.
              </div>
              <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-blue-200">
                Sistem Durumu: Gelir={formatCurrency(data.thisMonthIncome || 0)}, 
                Gider={formatCurrency(data.thisMonthExpense || 0)}, 
                Bakiye={formatCurrency(data.balance || 0)}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

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

      {data.totalReceivables > 0 && role !== 'cleaner' && role !== 'driver' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Müşterilerden tahsil edilmesi gereken toplam {formatCurrency(data.totalReceivables)} var.
          </AlertDescription>
        </Alert>
      )}

      {/* Main KPI Cards - Enhanced */}
      {role !== 'cleaner' && role !== 'driver' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Bu Ay Gelir</CardTitle>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-green-700">{formatCurrency(data.thisMonthIncome || 0)}</div>
              <div className="flex items-center gap-1 mt-1">
                {incomeChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-xs ${incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatPercent(incomeChange)} geçen aya göre
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Bu Ay Gider</CardTitle>
              <TrendingDown className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-red-700">{formatCurrency(data.thisMonthExpense || 0)}</div>
              <div className="flex items-center gap-1 mt-1">
                {expenseChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-green-600" />
                )}
                <span className={`text-xs ${expenseChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPercent(expenseChange)} geçen aya göre
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Bu Ay Kar</CardTitle>
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-blue-700">{formatCurrency(data.thisMonthProfit || 0)}</div>
              <div className="flex items-center gap-1 mt-1">
                {profitChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 text-blue-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-600" />
                )}
                <span className={`text-xs ${profitChange >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {formatPercent(profitChange)} geçen aya göre
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm">Bekleyen Tahsilat</CardTitle>
              <Target className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl text-purple-700">{formatCurrency(data.totalReceivables)}</div>
              <p className="text-xs text-purple-600 mt-1">
                Müşterilerden alınacak
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bugünkü İşler</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{data.todayWorkOrders}</div>
            <p className="text-xs text-muted-foreground">
              Bugün planlanmış
            </p>
          </CardContent>
        </Card>

        {role !== 'cleaner' && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Yaklaşan İşler</CardTitle>
                <ClipboardList className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{data.upcomingWorkOrders || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Gelecek 7 gün
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Bu Ay Tamamlanan</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{data.completedThisMonth || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Tamamlanan işler
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">Sıkıntılı Müşteri</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{data.problematicCustomers || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Takip gerekiyor
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Financial Overview with Trend */}
      {role !== 'cleaner' && role !== 'driver' && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Alacak/Verecek Durumu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                  <span>Müşteriden Alınacak</span>
                </div>
                <span className="font-bold text-red-600">{formatCurrency(data.totalReceivables)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-orange-600" />
                  <span>Çalışana Ödenecek</span>
                </div>
                <span className="font-bold text-orange-600">{formatCurrency(data.totalPayables)}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg border-t-2 border-gray-300">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-gray-700" />
                  <span className="font-medium">Net Bakiye</span>
                </div>
                <span className="font-bold text-gray-700">{formatCurrency(data.balance)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Son 7 Gün Gelir Trendi</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentTrend && data.recentTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={data.recentTrend}>
                    <Tooltip 
                      formatter={(value) => formatCurrency(Number(value))}
                      labelFormatter={(label) => `Tarih: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-gray-400">
                  Trend verisi yok
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Onay Bekleyen</div>
                  <div className="text-lg font-bold text-yellow-600">{data.draftCount}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Bugün</div>
                  <div className="text-lg font-bold text-blue-600">{data.todayWorkOrders}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Tamamlanan</div>
                  <div className="text-lg font-bold text-green-600">{data.completedThisMonth || 0}</div>
                </div>
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

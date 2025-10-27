import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  Users,
  DollarSign,
  ClipboardList,
  Calendar,
  Download,
  RefreshCw
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

interface AnalyticsData {
  monthlyTrends: Array<{
    month: string
    income: number
    expense: number
    profit: number
  }>
  customerProfitability: Array<{
    customerName: string
    totalRevenue: number
    workCount: number
  }>
  personnelPerformance: Array<{
    personnelName: string
    workCount: number
    totalRevenue: number
  }>
  serviceBreakdown: Array<{
    category: string
    count: number
    revenue: number
  }>
  collectionRates: {
    totalBilled: number
    totalCollected: number
    collectionRate: number
    outstanding: number
  }
  topCustomers: Array<{
    name: string
    revenue: number
    workCount: number
  }>
  monthlyStats: {
    currentMonth: {
      income: number
      expense: number
      profit: number
      workOrders: number
    }
    previousMonth: {
      income: number
      expense: number
      profit: number
      workOrders: number
    }
  }
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function Analytics({ user }: { user: any }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('6')
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    loadAnalytics()
  }, [timeRange])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const result = await apiCall(`/analytics?months=${timeRange}`)
      setData(result)
    } catch (error) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  }

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return 0
    return ((current - previous) / previous) * 100
  }

  const exportToCSV = (dataArray: any[], filename: string) => {
    if (dataArray.length === 0) return
    
    const headers = Object.keys(dataArray[0])
    const csvContent = [
      headers.join(','),
      ...dataArray.map(row => headers.map(header => row[header]).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-500">Raporlar yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Analitik verileri yüklenemedi</p>
        <Button onClick={loadAnalytics} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Tekrar Dene
        </Button>
      </div>
    )
  }

  const incomeChange = calculateChange(
    data.monthlyStats.currentMonth.income,
    data.monthlyStats.previousMonth.income
  )
  const expenseChange = calculateChange(
    data.monthlyStats.currentMonth.expense,
    data.monthlyStats.previousMonth.expense
  )
  const profitChange = calculateChange(
    data.monthlyStats.currentMonth.profit,
    data.monthlyStats.previousMonth.profit
  )
  const workOrdersChange = calculateChange(
    data.monthlyStats.currentMonth.workOrders,
    data.monthlyStats.previousMonth.workOrders
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1>Raporlama & Analitik</h1>
          <p className="text-gray-500">İş performansı ve finansal analiz</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Son 3 Ay</SelectItem>
              <SelectItem value="6">Son 6 Ay</SelectItem>
              <SelectItem value="12">Son 12 Ay</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={loadAnalytics} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics - Bu Ay vs Geçen Ay */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bu Ay Gelir</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(data.monthlyStats.currentMonth.income)}</div>
            <p className={`text-xs flex items-center gap-1 mt-1 ${incomeChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {incomeChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(incomeChange))} geçen aya göre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bu Ay Gider</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(data.monthlyStats.currentMonth.expense)}</div>
            <p className={`text-xs flex items-center gap-1 mt-1 ${expenseChange <= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {expenseChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(expenseChange))} geçen aya göre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bu Ay Kar</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{formatCurrency(data.monthlyStats.currentMonth.profit)}</div>
            <p className={`text-xs flex items-center gap-1 mt-1 ${profitChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(profitChange))} geçen aya göre
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm">Bu Ay İşler</CardTitle>
            <ClipboardList className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl">{data.monthlyStats.currentMonth.workOrders}</div>
            <p className={`text-xs flex items-center gap-1 mt-1 ${workOrdersChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {workOrdersChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatPercent(Math.abs(workOrdersChange))} geçen aya göre
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="customers">Müşteri Analizi</TabsTrigger>
          <TabsTrigger value="personnel">Personel Performansı</TabsTrigger>
          <TabsTrigger value="collections">Tahsilat Analizi</TabsTrigger>
        </TabsList>

        {/* Genel Bakış Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Aylık Trend Grafikleri */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gelir-Gider Trendi</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(data.monthlyTrends, 'gelir_gider_trend')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#10b981" name="Gelir" strokeWidth={2} />
                    <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Gider" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Kar Trendi</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(data.monthlyTrends, 'kar_trend')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="profit" fill="#3b82f6" name="Kar" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Hizmet Dağılımı */}
          {data.serviceBreakdown.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Hizmet Kategorisi Dağılımı</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(data.serviceBreakdown, 'hizmet_dagilimi')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.serviceBreakdown}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={(entry) => `${entry.category}: ${formatCurrency(entry.revenue)}`}
                      >
                        {data.serviceBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {data.serviceBreakdown.map((service, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="text-sm">{service.category}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{formatCurrency(service.revenue)}</div>
                          <div className="text-xs text-gray-500">{service.count} iş</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Müşteri Analizi Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>En Karlı Müşteriler</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(data.topCustomers, 'en_karli_musteriler')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.topCustomers.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="revenue" fill="#3b82f6" name="Gelir" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Müşteri Detay Listesi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data.customerProfitability.map((customer, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                      <div>
                        <div className="font-medium">{customer.customerName}</div>
                        <div className="text-xs text-gray-500">{customer.workCount} iş emri</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-green-600">{formatCurrency(customer.totalRevenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Personel Performansı Tab */}
        <TabsContent value="personnel" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personel İş Sayıları</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(data.personnelPerformance, 'personel_performans')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.personnelPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="personnelName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="workCount" fill="#8b5cf6" name="İş Sayısı" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Personel Gelir Katkısı</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => exportToCSV(data.personnelPerformance, 'personel_gelir')}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.personnelPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="personnelName" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="totalRevenue" fill="#10b981" name="Toplam Gelir" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Personel Detay Listesi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.personnelPerformance.map((personnel, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="bg-purple-100 text-purple-700 rounded-full w-10 h-10 flex items-center justify-center">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="font-medium">{personnel.personnelName}</div>
                        <div className="text-xs text-gray-500">{personnel.workCount} iş tamamlandı</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-green-600">{formatCurrency(personnel.totalRevenue)}</div>
                      <div className="text-xs text-gray-500">
                        Ortalama: {formatCurrency(personnel.totalRevenue / personnel.workCount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tahsilat Analizi Tab */}
        <TabsContent value="collections" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Toplam Faturalanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl">{formatCurrency(data.collectionRates.totalBilled)}</div>
                <p className="text-xs text-gray-500 mt-1">Tüm zamanlar</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tahsil Edilen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-green-600">{formatCurrency(data.collectionRates.totalCollected)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatPercent(data.collectionRates.collectionRate)} tahsilat oranı
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Bekleyen Tahsilat</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl text-red-600">{formatCurrency(data.collectionRates.outstanding)}</div>
                <p className="text-xs text-gray-500 mt-1">
                  {formatPercent((data.collectionRates.outstanding / data.collectionRates.totalBilled) * 100)} kalan
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tahsilat Oranı Görünümü</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Tahsilat Oranı</span>
                    <span className="text-sm font-medium">{formatPercent(data.collectionRates.collectionRate)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div
                      className="bg-green-600 h-4 rounded-full transition-all"
                      style={{ width: `${data.collectionRates.collectionRate}%` }}
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 pt-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Tahsil Edilen</span>
                    </div>
                    <div className="text-2xl text-green-700">{formatCurrency(data.collectionRates.totalCollected)}</div>
                  </div>

                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      <span className="font-medium">Bekleyen</span>
                    </div>
                    <div className="text-2xl text-red-700">{formatCurrency(data.collectionRates.outstanding)}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

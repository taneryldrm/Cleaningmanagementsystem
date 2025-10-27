import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Calendar, Users, Briefcase } from 'lucide-react'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface WorkOrder {
  id: string
  customerId: string
  personnelIds: string[]
  date: string
  description: string
  estimatedAmount: number
  actualAmount: number
  status: string
  approvedAt: string | null
  completedAt: string | null
  createdByName: string
}

interface ScheduleEntry {
  date: string
  workOrders: {
    id: string
    customerName: string
    description: string
    personnelCount: number
    personnelNames: string[]
    status: string
  }[]
  totalWorkers: number
}

export function PersonnelSchedule() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [personnel, setPersonnel] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )

  useEffect(() => {
    loadData()
    
    // Auto-refresh every 30 seconds to catch updates from work orders
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    try {
      const [workOrdersResult, customersResult, personnelResult] = await Promise.all([
        apiCall('/work-orders'),
        apiCall('/customers'),
        apiCall('/personnel')
      ])
      
      setWorkOrders(workOrdersResult.workOrders || [])
      setCustomers(customersResult.customers || [])
      setPersonnel(personnelResult.personnel || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId)
    return customer?.name || 'Bilinmiyor'
  }

  const getPersonnelNames = (personnelIds: string[]) => {
    return personnelIds
      .map(id => {
        const person = personnel.find(p => p.id === id)
        return person?.name
      })
      .filter(Boolean) as string[]
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 text-xs">Taslak</Badge>
      case 'approved':
        return <Badge className="bg-blue-100 text-blue-800 text-xs">Onaylandı</Badge>
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 text-xs">Tamamlandı</Badge>
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>
    }
  }

  // Filter and group work orders by date
  const getScheduleData = (): ScheduleEntry[] => {
    const filtered = workOrders.filter(wo => {
      const orderDate = wo.date?.split('T')[0]
      return orderDate >= startDate && orderDate <= endDate
    })

    // Group by date
    const grouped = filtered.reduce((acc, order) => {
      const date = order.date?.split('T')[0] || 'unknown'
      if (!acc[date]) acc[date] = []
      acc[date].push(order)
      return acc
    }, {} as Record<string, WorkOrder[]>)

    // Convert to array and calculate stats
    const scheduleData: ScheduleEntry[] = Object.entries(grouped).map(([date, orders]) => {
      // Count unique workers across all orders for this date
      const allWorkerIds = new Set<string>()
      
      const workOrdersData = orders.map(order => {
        const personnelNames = getPersonnelNames(order.personnelIds)
        order.personnelIds.forEach(id => allWorkerIds.add(id))
        
        return {
          id: order.id,
          customerName: getCustomerName(order.customerId),
          description: order.description,
          personnelCount: order.personnelIds.length,
          personnelNames,
          status: order.status
        }
      })

      return {
        date,
        workOrders: workOrdersData,
        totalWorkers: allWorkerIds.size
      }
    })

    // Sort by date descending (newest first)
    return scheduleData.sort((a, b) => b.date.localeCompare(a.date))
  }

  const scheduleData = getScheduleData()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    
    const formatted = date.toLocaleDateString('tr-TR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
    
    if (isToday) return `Bugün - ${formatted}`
    if (isTomorrow) return `Yarın - ${formatted}`
    return formatted
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1>Personel Takvimi</h1>
          <p className="text-gray-500">Tarih sırasına göre iş planlaması ve personel dağılımı</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-xs">Başlangıç</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-xs">Bitiş</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full sm:w-40"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {scheduleData.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Seçilen tarih aralığında iş emri bulunamadı
            </CardContent>
          </Card>
        ) : (
          scheduleData.map((entry) => (
            <Card key={entry.date} className="overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">
                      {formatDate(entry.date)}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-600" />
                    <span className="font-semibold text-blue-600">
                      {entry.totalWorkers} İşçi
                    </span>
                    <span className="text-gray-500">•</span>
                    <Briefcase className="h-4 w-4 text-gray-600" />
                    <span className="text-gray-600">
                      {entry.workOrders.length} İş
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {entry.workOrders.map((workOrder) => (
                    <div 
                      key={workOrder.id} 
                      className="p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium">
                              {workOrder.customerName}
                            </h3>
                            {getStatusBadge(workOrder.status)}
                          </div>
                          {workOrder.description && (
                            <p className="text-sm text-gray-600">
                              {workOrder.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-700">
                              {workOrder.personnelCount} Personel:
                            </span>
                            <span className="text-sm text-gray-600">
                              {workOrder.personnelNames.length > 0 
                                ? workOrder.personnelNames.join(', ')
                                : 'Atanmadı'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-center bg-blue-100 text-blue-700 rounded-full w-10 h-10 flex-shrink-0">
                          <span className="font-bold">{workOrder.personnelCount}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {scheduleData.length > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader>
            <CardTitle className="text-base">Özet İstatistikler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Toplam Gün</p>
                <p className="text-2xl font-bold text-blue-600">{scheduleData.length}</p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Toplam İş Emri</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {scheduleData.reduce((sum, entry) => sum + entry.workOrders.length, 0)}
                </p>
              </div>
              <div className="text-center p-4 bg-white rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Ortalama İşçi/Gün</p>
                <p className="text-2xl font-bold text-purple-600">
                  {(scheduleData.reduce((sum, entry) => sum + entry.totalWorkers, 0) / scheduleData.length).toFixed(1)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

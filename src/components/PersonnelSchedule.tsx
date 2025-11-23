import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Calendar, Users, Briefcase, Printer } from 'lucide-react'
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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const scheduleData = getScheduleData()
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Günlük İş Programı - Uçanlar Temizlik</title>
          <style>
            @page {
              size: A4;
              margin: 15mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 10pt;
              line-height: 1.3;
            }
            .header {
              text-align: center;
              margin-bottom: 15px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            .header h1 {
              font-size: 16pt;
              margin-bottom: 5px;
            }
            .header p {
              font-size: 9pt;
              color: #666;
            }
            .date-section {
              page-break-inside: avoid;
              margin-bottom: 25px;
            }
            .date-header {
              background: #f0f0f0;
              padding: 8px 10px;
              margin-bottom: 10px;
              border: 1px solid #000;
              font-weight: bold;
              font-size: 11pt;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 5px;
            }
            th, td {
              border: 1px solid #333;
              padding: 6px 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #e8e8e8;
              font-weight: bold;
              font-size: 9pt;
              text-align: center;
            }
            .col-no { width: 30px; text-align: center; }
            .col-customer { width: 25%; }
            .col-description { width: 30%; }
            .col-personnel { width: 20%; }
            .col-signature { width: 15%; min-height: 40px; }
            .col-notes { width: 10%; }
            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 8pt;
              font-weight: bold;
            }
            .status-draft { background: #fff3cd; color: #856404; }
            .status-approved { background: #cfe2ff; color: #084298; }
            .status-completed { background: #d1e7dd; color: #0f5132; }
            .summary {
              margin-top: 10px;
              padding: 8px;
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
              font-size: 9pt;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
            }
            @media print {
              .no-print { display: none; }
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>UÇANLAR TEMİZLİK - GÜNLÜK İŞ PROGRAMI</h1>
            <p>Tarih Aralığı: ${new Date(startDate).toLocaleDateString('tr-TR')} - ${new Date(endDate).toLocaleDateString('tr-TR')}</p>
            <p>Yazdırma Tarihi: ${new Date().toLocaleDateString('tr-TR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          ${scheduleData.map((entry, index) => `
            <div class="date-section">
              <div class="date-header">
                📅 ${formatDate(entry.date)} - ${entry.totalWorkers} İşçi - ${entry.workOrders.length} İş Emri
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="col-no">No</th>
                    <th class="col-customer">Müşteri Adı</th>
                    <th class="col-description">İş Açıklaması</th>
                    <th class="col-personnel">Personel</th>
                    <th class="col-signature">İmza</th>
                    <th class="col-notes">Notlar</th>
                  </tr>
                </thead>
                <tbody>
                  ${entry.workOrders.map((wo, woIndex) => `
                    <tr>
                      <td class="col-no">${woIndex + 1}</td>
                      <td class="col-customer">
                        <strong>${wo.customerName}</strong>
                        ${wo.status === 'draft' ? '<span class="status-badge status-draft">Taslak</span>' : ''}
                        ${wo.status === 'approved' ? '<span class="status-badge status-approved">Onaylı</span>' : ''}
                        ${wo.status === 'completed' ? '<span class="status-badge status-completed">Tamamlandı</span>' : ''}
                      </td>
                      <td class="col-description">${wo.description || '-'}</td>
                      <td class="col-personnel">
                        <strong>(${wo.personnelCount})</strong>
                        ${wo.personnelNames.length > 0 ? wo.personnelNames.join(', ') : 'Atanmadı'}
                      </td>
                      <td class="col-signature"></td>
                      <td class="col-notes"></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}

          <div class="summary">
            <div class="summary-row">
              <strong>TOPLAM ÖZET:</strong>
            </div>
            <div class="summary-row">
              <span>Toplam Gün Sayısı:</span>
              <strong>${scheduleData.length} Gün</strong>
            </div>
            <div class="summary-row">
              <span>Toplam İş Emri:</span>
              <strong>${scheduleData.reduce((sum, entry) => sum + entry.workOrders.length, 0)} Adet</strong>
            </div>
            <div class="summary-row">
              <span>Ortalama İşçi/Gün:</span>
              <strong>${(scheduleData.reduce((sum, entry) => sum + entry.totalWorkers, 0) / scheduleData.length).toFixed(1)} Kişi</strong>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const scheduleData = getScheduleData()

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
          <Button 
            onClick={handlePrint}
            disabled={scheduleData.length === 0}
            className="bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
          >
            <Printer className="h-4 w-4 mr-2" />
            Yazdır
          </Button>
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

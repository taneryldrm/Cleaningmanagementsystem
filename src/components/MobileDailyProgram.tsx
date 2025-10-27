import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { Calendar, Phone, MapPin, Users, DollarSign, ClipboardList } from 'lucide-react'

interface WorkOrder {
  id: string
  customerId: string
  personnelIds: string[]
  date: string
  description: string
  totalAmount: number
  paidAmount: number
  status: string
}

interface Customer {
  id: string
  name: string
  contactInfo?: {
    phone?: string
    email?: string
  }
  address: string
}

interface Personnel {
  id: string
  name: string
  role: string
}

interface DailyWorkItem {
  orderId: string
  orderNumber: number
  customerName: string
  customerPhone: string
  personnelNames: string
  description: string
  address: string
  amount: number
  status: string
}

export function MobileDailyProgram({ user }: { user: any }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
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

  const getDailyWorkItems = (): DailyWorkItem[] => {
    // Filter work orders for selected date and status (approved or completed)
    const filteredOrders = workOrders.filter(wo => {
      const orderDate = wo.date?.split('T')[0]
      return orderDate === selectedDate && (wo.status === 'approved' || wo.status === 'completed')
    })

    // Map to daily work items with all necessary info
    return filteredOrders.map((order, index) => {
      const customer = customers.find(c => c.id === order.customerId)
      const assignedPersonnel = order.personnelIds
        ?.map(pid => personnel.find(p => p.id === pid)?.name)
        .filter(Boolean)
        .join(', ') || 'Atanmadı'

      return {
        orderId: order.id,
        orderNumber: index + 1,
        customerName: customer?.name || 'Bilinmiyor',
        customerPhone: customer?.contactInfo?.phone || '-',
        personnelNames: assignedPersonnel,
        description: order.description || '-',
        address: customer?.address || '-',
        amount: order.totalAmount || 0,
        status: order.status
      }
    })
  }

  const dailyItems = getDailyWorkItems()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="uppercase">Günlük Mobil İş Programı</h1>
        <p className="text-gray-600 mt-2">{formatDate(selectedDate)}</p>
      </div>

      {/* Date Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-auto"
            />
            <Button
              variant="outline"
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="w-full sm:w-auto"
            >
              Bugün
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Items List */}
      {dailyItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Seçilen tarih için onaylanmış iş bulunamadı</p>
            <p className="text-sm mt-2">İş Emirleri sayfasından yeni iş ekleyebilir veya mevcut işleri onaylayabilirsiniz.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <Card className="hidden lg:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      Sıra No
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      Müşteri Ad / Ünvan
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      Müşteri Tel
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      Personel Ad
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      Yazılacak İş ve Açıklamalar
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      İş Adresi
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-gray-700 border">
                      Ücret
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyItems.map((item) => (
                    <tr key={item.orderId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 border text-center">{item.orderNumber}</td>
                      <td className="px-4 py-3 border">{item.customerName}</td>
                      <td className="px-4 py-3 border">{item.customerPhone}</td>
                      <td className="px-4 py-3 border">{item.personnelNames}</td>
                      <td className="px-4 py-3 border whitespace-pre-wrap">{item.description}</td>
                      <td className="px-4 py-3 border">{item.address}</td>
                      <td className="px-4 py-3 border text-right">
                        {item.amount > 0 ? `${item.amount.toLocaleString('tr-TR')} ₺` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {dailyItems.map((item) => (
              <Card key={item.orderId}>
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="flex-1">{item.orderNumber}. {item.customerName}</span>
                    {item.amount > 0 && (
                      <span className="text-green-600 ml-2">
                        {item.amount.toLocaleString('tr-TR')} ₺
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {item.customerPhone !== '-' && (
                    <div className="flex items-start gap-2">
                      <Phone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Telefon</p>
                        <p className="text-sm">
                          <a href={`tel:${item.customerPhone}`} className="text-blue-600 hover:underline">
                            {item.customerPhone}
                          </a>
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">Personel</p>
                      <p className="text-sm">{item.personnelNames}</p>
                    </div>
                  </div>

                  {item.description !== '-' && (
                    <div className="flex items-start gap-2">
                      <ClipboardList className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Açıklama</p>
                        <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                      </div>
                    </div>
                  )}

                  {item.address !== '-' && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Adres</p>
                        <p className="text-sm">{item.address}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Summary */}
          <Card className="bg-blue-50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl text-blue-600">{dailyItems.length}</p>
                  <p className="text-sm text-gray-600">Toplam İş</p>
                </div>
                <div>
                  <p className="text-2xl text-green-600">
                    {dailyItems.reduce((sum, item) => sum + item.amount, 0).toLocaleString('tr-TR')} ₺
                  </p>
                  <p className="text-sm text-gray-600">Toplam Tutar</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-2xl text-orange-600">
                    {[...new Set(dailyItems.flatMap(item => item.personnelNames.split(', ')))].filter(Boolean).length}
                  </p>
                  <p className="text-sm text-gray-600">Çalışan Personel</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

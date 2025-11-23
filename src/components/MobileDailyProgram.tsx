import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Calendar, Phone, MapPin, Users, DollarSign, ClipboardList, CheckCircle, Clock, AlertCircle, Printer } from 'lucide-react'
import { toast } from 'sonner@2.0.3'

interface WorkOrder {
  id: string
  customerId: string
  personnelIds: string[]
  personnelPayments?: { [key: string]: number }
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
  paidAmount: number
}

export function MobileDailyProgram({ user }: { user: any }) {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [completingOrder, setCompletingOrder] = useState<WorkOrder | null>(null)
  const [completionPayment, setCompletionPayment] = useState('')

  const userRole = user?.user_metadata?.role
  const canEdit = userRole === 'admin' || userRole === 'secretary'
  const canApprove = userRole === 'admin' || userRole === 'secretary'

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

  const handleApproveWorkOrder = async (workOrderId: string) => {
    if (!canEdit) {
      toast.error('Bu işlem için yetkiniz yok')
      return
    }

    setApprovingId(workOrderId)
    try {
      await apiCall(`/work-orders/${workOrderId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'approved',
          approvedAt: new Date().toISOString()
        })
      })

      // Reload data to reflect changes
      await loadData()
      toast.success('İş emri başarıyla onaylandı!')
    } catch (error) {
      console.error('Error approving work order:', error)
      toast.error('İş emri onaylanırken hata oluştu')
    } finally {
      setApprovingId(null)
    }
  }

  const handleCompleteClick = (order: WorkOrder) => {
    setCompletingOrder(order)
    const remainingAmount = (order.totalAmount || 0) - (order.paidAmount || 0)
    setCompletionPayment(remainingAmount > 0 ? remainingAmount.toString() : '0')
  }

  const handleCompleteSubmit = async () => {
    if (!completingOrder) return

    const paymentAmount = parseFloat(completionPayment)
    
    if (isNaN(paymentAmount) || paymentAmount < 0) {
      toast.error('Lütfen geçerli bir tutar girin')
      return
    }

    const newPaidAmount = (completingOrder.paidAmount || 0) + paymentAmount
    
    if (newPaidAmount > (completingOrder.totalAmount || 0)) {
      toast.error('Toplam ödenen tutar, iş emrinin toplam tutarından fazla olamaz')
      return
    }

    try {
      await apiCall(`/work-orders/${completingOrder.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completedAt: new Date().toISOString(),
          paidAmount: newPaidAmount
        })
      })
      
      if (paymentAmount > 0) {
        toast.success(`İş emri tamamlandı! ${formatCurrency(paymentAmount)} tahsilat kaydedildi.`)
      } else {
        toast.success('İş emri tamamlandı!')
      }
      
      setCompletingOrder(null)
      setCompletionPayment('')
      await loadData()
    } catch (error) {
      console.error('Error completing work order:', error)
      toast.error('İş emri tamamlanırken hata oluştu')
    }
  }

  const getDailyWorkItems = (): { approved: DailyWorkItem[], draft: DailyWorkItem[] } => {
    // Filter work orders for selected date
    const filteredOrders = workOrders.filter(wo => {
      const orderDate = wo.date?.split('T')[0]
      return orderDate === selectedDate
    })

    // Separate into approved/completed and draft
    const approved: DailyWorkItem[] = []
    const draft: DailyWorkItem[] = []

    filteredOrders.forEach((order, index) => {
      const customer = customers.find(c => c.id === order.customerId)
      const assignedPersonnel = order.personnelIds
        ?.map(pid => personnel.find(p => p.id === pid)?.name)
        .filter(Boolean)
        .join(', ') || 'Atanmadı'

      const item: DailyWorkItem = {
        orderId: order.id,
        orderNumber: index + 1,
        customerName: customer?.name || 'Bilinmiyor',
        customerPhone: customer?.contactInfo?.phone || '-',
        personnelNames: assignedPersonnel,
        description: order.description || '-',
        address: customer?.address || '-',
        amount: order.totalAmount || 0,
        paidAmount: order.paidAmount || 0,
        status: order.status
      }

      if (order.status === 'approved' || order.status === 'completed') {
        approved.push(item)
      } else if (order.status === 'draft') {
        draft.push(item)
      }
    })

    return { approved, draft }
  }

  const { approved: approvedItems, draft: draftItems } = getDailyWorkItems()

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('tr-TR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2
    }).format(amount || 0)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const { approved: approvedItems } = getDailyWorkItems()
    
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Günlük İş Programı - ${formatDate(selectedDate)}</title>
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
              font-size: 9pt;
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
              font-size: 10pt;
              color: #333;
              margin: 3px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th, td {
              border: 1px solid #333;
              padding: 8px 6px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background: #e8e8e8;
              font-weight: bold;
              font-size: 8pt;
              text-align: center;
              text-transform: uppercase;
            }
            .col-no { width: 40px; text-align: center; }
            .col-customer { width: 15%; }
            .col-tel { width: 10%; }
            .col-personnel { width: 12%; }
            .col-description { width: 18%; }
            .col-address { width: 15%; }
            .col-amount { width: 10%; text-align: right; }
            .col-status { width: 8%; text-align: center; }
            .col-signature { width: 12%; min-height: 40px; }
            .status-badge {
              display: inline-block;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 7pt;
              font-weight: bold;
            }
            .status-approved { background: #cfe2ff; color: #084298; }
            .status-completed { background: #d1e7dd; color: #0f5132; }
            .summary {
              margin-top: 20px;
              padding: 10px;
              background: #f8f9fa;
              border: 1px solid #dee2e6;
              border-radius: 4px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              font-size: 9pt;
            }
            .total-row {
              font-weight: bold;
              border-top: 2px solid #333;
              padding-top: 8px;
              margin-top: 4px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>UÇANLAR TEMİZLİK - GÜNLÜK İŞ PROGRAMI</h1>
            <p>${formatDate(selectedDate)}</p>
            <p>Yazdırma: ${new Date().toLocaleDateString('tr-TR', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>

          <table>
            <thead>
              <tr>
                <th class="col-no">Sıra<br>No</th>
                <th class="col-customer">Müşteri Ad /<br>Ünvan</th>
                <th class="col-tel">Müşteri<br>Tel</th>
                <th class="col-personnel">Personel<br>Ad</th>
                <th class="col-description">Yazılacak İş ve<br>Açıklamalar</th>
                <th class="col-address">İş<br>Adresi</th>
                <th class="col-amount">Ücret</th>
                <th class="col-status">Durum</th>
                <th class="col-signature">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${approvedItems.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 30px; color: #666;">
                    Seçilen tarih için onaylanmış iş emri bulunamadı
                  </td>
                </tr>
              ` : approvedItems.map((item) => `
                <tr>
                  <td class="col-no">${item.orderNumber}</td>
                  <td class="col-customer">${item.customerName}</td>
                  <td class="col-tel">${item.customerPhone}</td>
                  <td class="col-personnel">${item.personnelNames}</td>
                  <td class="col-description">${item.description}</td>
                  <td class="col-address">${item.address}</td>
                  <td class="col-amount">${item.amount > 0 ? formatCurrency(item.amount) : '-'}</td>
                  <td class="col-status">
                    ${item.status === 'completed' 
                      ? '<span class="status-badge status-completed">Tamamlandı</span>' 
                      : '<span class="status-badge status-approved">Onaylandı</span>'}
                  </td>
                  <td class="col-signature"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          ${approvedItems.length > 0 ? `
            <div class="summary">
              <div class="summary-row">
                <span>Toplam İş Sayısı:</span>
                <strong>${approvedItems.length} Adet</strong>
              </div>
              <div class="summary-row">
                <span>Toplam Tutar:</span>
                <strong>${formatCurrency(approvedItems.reduce((sum, item) => sum + item.amount, 0))}</strong>
              </div>
              <div class="summary-row">
                <span>Çalışan Personel:</span>
                <strong>${[...new Set(approvedItems.flatMap(item => item.personnelNames.split(', ')))].filter(Boolean).length} Kişi</strong>
              </div>
              <div class="summary-row total-row">
                <span>Tamamlanan İşler:</span>
                <strong>${approvedItems.filter(item => item.status === 'completed').length} / ${approvedItems.length}</strong>
              </div>
            </div>
          ` : ''}

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
            <Button
              onClick={handlePrint}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="h-4 w-4 mr-2" />
              Yazdır
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Draft Work Orders Section */}
      {draftItems.length > 0 && (
        <div className="space-y-4">
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-900">
                <Clock className="h-5 w-5" />
                Onay Bekleyen İş Emirleri ({draftItems.length})
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Desktop Table View for Drafts */}
          <Card className="hidden lg:block overflow-hidden border-yellow-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-yellow-50">
                  <tr>
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
                      Ücret
                    </th>
                    {canApprove && (
                      <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-gray-700 border">
                        İşlem
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {draftItems.map((item) => (
                    <tr key={item.orderId} className="hover:bg-yellow-50">
                      <td className="px-4 py-3 border">{item.customerName}</td>
                      <td className="px-4 py-3 border">{item.customerPhone}</td>
                      <td className="px-4 py-3 border">{item.personnelNames}</td>
                      <td className="px-4 py-3 border whitespace-pre-wrap">{item.description}</td>
                      <td className="px-4 py-3 border text-right">
                        {item.amount > 0 ? formatCurrency(item.amount) : '-'}
                      </td>
                      {canApprove && (
                        <td className="px-4 py-3 border text-center">
                          <Button
                            size="sm"
                            onClick={() => handleApproveWorkOrder(item.orderId)}
                            disabled={approvingId === item.orderId}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {approvingId === item.orderId ? (
                              'Onaylanıyor...'
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Onayla
                              </>
                            )}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Card View for Drafts */}
          <div className="lg:hidden space-y-4">
            {draftItems.map((item) => (
              <Card key={item.orderId} className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="flex-1">{item.customerName}</span>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 ml-2">
                      <Clock className="h-3 w-3 mr-1" />
                      Taslak
                    </Badge>
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

                  {item.amount > 0 && (
                    <div className="flex items-start gap-2">
                      <DollarSign className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Ücret</p>
                        <p className="text-sm font-medium">{formatCurrency(item.amount)}</p>
                      </div>
                    </div>
                  )}

                  {canApprove && (
                    <div className="pt-3 border-t">
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleApproveWorkOrder(item.orderId)}
                        disabled={approvingId === item.orderId}
                      >
                        {approvingId === item.orderId ? (
                          'Onaylanıyor...'
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            İş Emrini Onayla
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approved/Completed Work Orders Section */}
      {approvedItems.length === 0 && draftItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <ClipboardList className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Seçilen tarih için iş bulunamadı</p>
            <p className="text-sm mt-2">İş Emirleri sayfasından yeni iş ekleyebilirsiniz.</p>
          </CardContent>
        </Card>
      ) : approvedItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-300" />
            <p>Seçilen tarih için onaylanmış iş bulunamadı</p>
            <p className="text-sm mt-2">Yukarıdaki taslak işleri onaylayabilirsiniz.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Header for approved items */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-900">
                <CheckCircle className="h-5 w-5" />
                Onaylanmış İşler ({approvedItems.length})
              </CardTitle>
            </CardHeader>
          </Card>

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
                    <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-gray-700 border">
                      Durum
                    </th>
                    {canEdit && (
                      <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-gray-700 border">
                        İşlem
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {approvedItems.map((item) => {
                    const workOrder = workOrders.find(wo => wo.id === item.orderId)
                    return (
                      <tr key={item.orderId} className="hover:bg-gray-50">
                        <td className="px-4 py-3 border text-center">{item.orderNumber}</td>
                        <td className="px-4 py-3 border">{item.customerName}</td>
                        <td className="px-4 py-3 border">{item.customerPhone}</td>
                        <td className="px-4 py-3 border">{item.personnelNames}</td>
                        <td className="px-4 py-3 border whitespace-pre-wrap">{item.description}</td>
                        <td className="px-4 py-3 border">{item.address}</td>
                        <td className="px-4 py-3 border text-right">
                          {item.amount > 0 ? formatCurrency(item.amount) : '-'}
                        </td>
                        <td className="px-4 py-3 border text-center">
                          {item.status === 'completed' ? (
                            <Badge className="bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Tamamlandı
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Onaylandı
                            </Badge>
                          )}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 border text-center">
                            {item.status === 'approved' && workOrder && (
                              <Button
                                size="sm"
                                onClick={() => handleCompleteClick(workOrder)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Clock className="h-4 w-4 mr-1" />
                                Tamamla
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {approvedItems.map((item) => {
              const workOrder = workOrders.find(wo => wo.id === item.orderId)
              return (
                <Card key={item.orderId}>
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between">
                      <span className="flex-1">{item.orderNumber}. {item.customerName}</span>
                      <div className="flex flex-col items-end gap-2 ml-2">
                        {item.status === 'completed' ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Tamamlandı
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Onaylandı
                          </Badge>
                        )}
                        {item.amount > 0 && (
                          <span className="text-green-600">
                            {formatCurrency(item.amount)}
                          </span>
                        )}
                      </div>
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

                  {canEdit && item.status === 'approved' && workOrder && (
                    <div className="pt-3 border-t">
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleCompleteClick(workOrder)}
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        İşi Tamamla
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              )
            })}
          </div>

          {/* Summary */}
          <Card className="bg-blue-50">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl text-blue-600">{approvedItems.length}</p>
                  <p className="text-sm text-gray-600">Toplam İş</p>
                </div>
                <div>
                  <p className="text-2xl text-green-600">
                    {formatCurrency(approvedItems.reduce((sum, item) => sum + item.amount, 0))}
                  </p>
                  <p className="text-sm text-gray-600">Toplam Tutar</p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-2xl text-orange-600">
                    {[...new Set(approvedItems.flatMap(item => item.personnelNames.split(', ')))].filter(Boolean).length}
                  </p>
                  <p className="text-sm text-gray-600">Çalışan Personel</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Complete Work Order Dialog */}
      <Dialog open={!!completingOrder} onOpenChange={(open) => !open && setCompletingOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>İş Emrini Tamamla</DialogTitle>
          </DialogHeader>
          {completingOrder && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Müşteri:</span>
                  <span className="font-medium">
                    {customers.find(c => c.id === completingOrder.customerId)?.name || 'Bilinmiyor'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Toplam Tutar:</span>
                  <span className="font-medium">{formatCurrency(completingOrder.totalAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Ödenen:</span>
                  <span className="font-medium text-green-600">{formatCurrency(completingOrder.paidAmount)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-gray-600">Kalan:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency((completingOrder.totalAmount || 0) - (completingOrder.paidAmount || 0))}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="completionPayment">Tahsilat Tutarı (TL)</Label>
                <Input
                  id="completionPayment"
                  type="number"
                  step="0.01"
                  min="0"
                  value={completionPayment}
                  onChange={(e) => setCompletionPayment(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500">
                  Kalan tutar otomatik olarak doldurulmuştur. İsterseniz değiştirebilirsiniz.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCompletingOrder(null)}
                >
                  İptal
                </Button>
                <Button 
                  onClick={handleCompleteSubmit}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  İş Emrini Tamamla
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
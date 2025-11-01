import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Calendar, Edit, Plus, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'

interface Personnel {
  id: string
  name: string
  role: string
  contactInfo: any
  active: boolean
}

interface PayrollRecord {
  personnelId: string
  date: string
  carryover: number
  dailyWage: number
  dailyPayment: number
  balance: number
}

interface PersonnelPayrollData {
  personnelId: string
  name: string
  phone: string
  carryover: number
  dailyWage: number
  dailyPayment: number
  balance: number
  workInfo?: string  // Info about which job they're working on
  isWorkingToday: boolean
}

interface WorkOrder {
  id: string
  customerId: string
  personnelIds: string[]
  date: string
  status: string
}

interface Customer {
  id: string
  name: string
}

export function PersonnelPayroll({ user }: { user: any }) {
  const [personnel, setPersonnel] = useState<Personnel[]>([])
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([])
  const [previousBalances, setPreviousBalances] = useState<Record<string, number>>({})
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedPersonnel, setSelectedPersonnel] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null)
  
  const [formData, setFormData] = useState({
    carryover: '',
    dailyWage: '',
    dailyPayment: ''
  })

  const userRole = user?.user_metadata?.role
  const canEdit = userRole === 'admin' || userRole === 'secretary'

  useEffect(() => {
    loadData()
  }, [selectedDate])

  const loadData = async () => {
    try {
      const [personnelResult, payrollResult, workOrdersResult, customersResult] = await Promise.all([
        apiCall('/personnel'),
        apiCall(`/payroll?date=${selectedDate}`),
        apiCall('/work-orders'),
        apiCall('/customers')
      ])
      
      setPersonnel(personnelResult.personnel?.filter((p: Personnel) => p.active && p.role === 'cleaner') || [])
      setPayrollRecords(payrollResult.records || [])
      setPreviousBalances(payrollResult.previousBalances || {})
      setWorkOrders(workOrdersResult.workOrders || [])
      setCustomers(customersResult.customers || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingPersonnel) {
      console.error('No personnel selected')
      alert('Lütfen bir personel seçin')
      return
    }

    if (!editingPersonnel.id) {
      console.error('Personnel ID is missing')
      alert('Personel ID bulunamadı')
      return
    }

    if (!selectedDate) {
      console.error('Date is missing')
      alert('Tarih seçilmedi')
      return
    }

    try {
      const payload = {
        personnelId: editingPersonnel.id,
        date: selectedDate,
        // carryover is NOT sent - backend calculates it automatically
        dailyWage: parseFloat(formData.dailyWage) || 0,
        dailyPayment: parseFloat(formData.dailyPayment) || 0
      }

      console.log('Saving payroll with payload (carryover auto-calculated):', payload)

      await apiCall('/payroll', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setIsDialogOpen(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving payroll:', error)
      alert('Bordro kaydedilirken hata oluştu')
    }
  }

  const resetForm = () => {
    setFormData({
      carryover: '',
      dailyWage: '',
      dailyPayment: ''
    })
    setEditingPersonnel(null)
  }

  const openEditDialog = (person: Personnel) => {
    const existingRecord = payrollRecords.find(r => r.personnelId === person.id)
    
    // If no record exists for today, use previous day's balance as carryover
    const carryover = existingRecord 
      ? existingRecord.carryover 
      : (previousBalances[person.id] || 0)
    
    setEditingPersonnel(person)
    setFormData({
      carryover: carryover.toString(),
      dailyWage: existingRecord?.dailyWage?.toString() || '0',
      dailyPayment: existingRecord?.dailyPayment?.toString() || '0'
    })
    setIsDialogOpen(true)
  }

  const getPersonnelWorkInfo = (personnelId: string): { workInfo: string, isWorkingToday: boolean } => {
    const dateOnly = selectedDate.split('T')[0]
    const assignedOrders = workOrders.filter(wo => {
      const woDateOnly = wo.date?.split('T')[0]
      return woDateOnly === dateOnly && 
             wo.personnelIds?.includes(personnelId) &&
             (wo.status === 'draft' || wo.status === 'approved' || wo.status === 'completed')
    })

    if (assignedOrders.length > 0) {
      const customerNames = assignedOrders
        .map(wo => {
          const customer = customers.find(c => c.id === wo.customerId)
          return customer?.name || 'Bilinmiyor'
        })
        .join(', ')
      
      return {
        workInfo: customerNames,
        isWorkingToday: true
      }
    }

    return { workInfo: '', isWorkingToday: false }
  }

  const getPayrollData = (): PersonnelPayrollData[] => {
    return personnel.map(person => {
      const record = payrollRecords.find(r => r.personnelId === person.id)
      
      // If no record exists for today, use previous day's balance as carryover
      const carryover = record 
        ? record.carryover 
        : (previousBalances[person.id] || 0)
      
      const dailyWage = record?.dailyWage || 0
      const dailyPayment = record?.dailyPayment || 0
      const balance = carryover + dailyWage - dailyPayment

      const { workInfo, isWorkingToday } = getPersonnelWorkInfo(person.id)

      return {
        personnelId: person.id,
        name: person.name,
        phone: person.contactInfo?.phone || '',
        carryover,
        dailyWage,
        dailyPayment,
        balance,
        workInfo,
        isWorkingToday
      }
    })
  }

  const sortedPayrollData = () => {
    const data = getPayrollData()
    
    // Filter by selected personnel
    const filteredData = selectedPersonnel === 'all' 
      ? data 
      : data.filter(d => d.personnelId === selectedPersonnel)
    
    // Separate into three groups: working today, with debt, no debt
    const workingToday = filteredData.filter(d => d.isWorkingToday).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    const withDebt = filteredData.filter(d => !d.isWorkingToday && d.balance > 0).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    const noDebt = filteredData.filter(d => !d.isWorkingToday && d.balance <= 0).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    
    return [...workingToday, ...withDebt, ...noDebt]
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    return `${days[date.getDay()]} ${date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })}`
  }

  const getTotals = () => {
    const data = getPayrollData()
    return {
      totalCarryover: data.reduce((sum, d) => sum + d.carryover, 0),
      totalDailyWage: data.reduce((sum, d) => sum + d.dailyWage, 0),
      totalDailyPayment: data.reduce((sum, d) => sum + d.dailyPayment, 0),
      totalBalance: data.reduce((sum, d) => sum + d.balance, 0)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Yükleniyor...</div>
  }

  const payrollData = sortedPayrollData()
  const totals = getTotals()

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="uppercase">Günlük Yevmiye - Müşteri Nakit Tahsilat</h1>
        <p className="text-gray-600 mt-2">{formatDate(selectedDate)}</p>
      </div>

      {/* Date Selector and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
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
                >
                  Bugün
                </Button>
              </div>
            </div>
            
            {/* Personnel Filter */}
            <div className="flex items-center gap-4">
              <Label htmlFor="personnelFilter" className="whitespace-nowrap">Personel Filtrele:</Label>
              <Select value={selectedPersonnel} onValueChange={setSelectedPersonnel}>
                <SelectTrigger className="w-full sm:w-[300px]">
                  <SelectValue placeholder="Tüm Personel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Personel</SelectItem>
                  {personnel
                    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
                    .map(person => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedPersonnel !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedPersonnel('all')}
                >
                  Filtreyi Temizle
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table View */}
      <Card className="hidden lg:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider border">
                  Ad Soyad
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider border">
                  Telefon
                </th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider border">
                  Bugün Çalıştığı İş
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider border">
                  Devir
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider border">
                  Bugün Yevmiye
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider border">
                  Bugün Ödenen
                </th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider border">
                  Borç Bakiye
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-center text-xs uppercase tracking-wider border">
                    İşlemler
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payrollData.map((item) => {
                const hasDebt = item.balance > 0
                const rowClassName = item.isWorkingToday 
                  ? 'bg-blue-50 hover:bg-blue-100' 
                  : hasDebt 
                    ? 'hover:bg-gray-50' 
                    : 'bg-green-50 hover:bg-green-100'
                
                return (
                  <tr 
                    key={item.personnelId} 
                    className={rowClassName}
                  >
                    <td className="px-4 py-3 border">
                      {item.name}
                      {item.isWorkingToday && (
                        <span className="ml-2 text-xs text-blue-600">●</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border">{item.phone || '-'}</td>
                    <td className="px-4 py-3 border">
                      {item.workInfo ? (
                        <span className="text-sm text-blue-700">{item.workInfo}</span>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 border text-right">
                      {item.carryover > 0 ? item.carryover.toLocaleString('tr-TR') : '0'}
                    </td>
                    <td className="px-4 py-3 border text-right">
                      {item.dailyWage > 0 ? item.dailyWage.toLocaleString('tr-TR') : '0'}
                    </td>
                    <td className="px-4 py-3 border text-right">
                      {item.dailyPayment > 0 ? item.dailyPayment.toLocaleString('tr-TR') : '0'}
                    </td>
                    <td className={`px-4 py-3 border text-right ${hasDebt ? 'text-red-600' : 'text-green-600'}`}>
                      {item.balance > 0 ? item.balance.toLocaleString('tr-TR') : '0'}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 border text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const person = personnel.find(p => p.id === item.personnelId)
                            if (person) openEditDialog(person)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {/* Totals Row */}
              <tr className="bg-blue-100 font-semibold">
                <td className="px-4 py-3 border" colSpan={3}>TOPLAM</td>
                <td className="px-4 py-3 border text-right">
                  {totals.totalCarryover.toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3 border text-right">
                  {totals.totalDailyWage.toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3 border text-right">
                  {totals.totalDailyPayment.toLocaleString('tr-TR')}
                </td>
                <td className="px-4 py-3 border text-right text-red-600">
                  {totals.totalBalance.toLocaleString('tr-TR')}
                </td>
                {canEdit && <td className="px-4 py-3 border"></td>}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-4">
        {payrollData.map((item) => {
          const hasDebt = item.balance > 0
          const person = personnel.find(p => p.id === item.personnelId)
          const cardClassName = item.isWorkingToday 
            ? 'bg-blue-50 border-blue-200' 
            : hasDebt 
              ? '' 
              : 'bg-green-50 border-green-200'
          
          return (
            <Card 
              key={item.personnelId} 
              className={cardClassName}
            >
              <CardHeader>
                <CardTitle className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {item.name}
                      {item.isWorkingToday && (
                        <span className="text-xs text-blue-600">●</span>
                      )}
                    </div>
                    {item.phone && (
                      <a href={`tel:${item.phone}`} className="text-sm text-blue-600 hover:underline">
                        {item.phone}
                      </a>
                    )}
                    {item.workInfo && (
                      <div className="text-sm text-blue-700 mt-1">
                        📍 {item.workInfo}
                      </div>
                    )}
                  </div>
                  {canEdit && person && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(person)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Devir:</span>
                    <span className="ml-2 font-medium">{item.carryover.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bugün Yevmiye:</span>
                    <span className="ml-2 font-medium">{item.dailyWage.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Bugün Ödenen:</span>
                    <span className="ml-2 font-medium">{item.dailyPayment.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Borç Bakiye:</span>
                    <span className={`ml-2 font-semibold ${hasDebt ? 'text-red-600' : 'text-green-600'}`}>
                      {item.balance.toLocaleString('tr-TR')} ₺
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Mobile Totals Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle>Toplam</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Devir:</span>
              <div className="font-semibold">{totals.totalCarryover.toLocaleString('tr-TR')} ₺</div>
            </div>
            <div>
              <span className="text-gray-600">Bugün Yevmiye:</span>
              <div className="font-semibold">{totals.totalDailyWage.toLocaleString('tr-TR')} ₺</div>
            </div>
            <div>
              <span className="text-gray-600">Bugün Ödenen:</span>
              <div className="font-semibold">{totals.totalDailyPayment.toLocaleString('tr-TR')} ₺</div>
            </div>
            <div>
              <span className="text-gray-600">Borç Bakiye:</span>
              <div className="font-semibold text-red-600">{totals.totalBalance.toLocaleString('tr-TR')} ₺</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPersonnel?.name} - Bordro Bilgileri
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePayroll} className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm">
              <strong className="text-blue-800">ℹ️ Otomatik Devir Sistemi:</strong>
              <p className="text-blue-700 mt-1">
                Devir tutarı, personelin önceki borç bakiyesinden otomatik olarak hesaplanır. 
                {editingPersonnel && previousBalances[editingPersonnel.id] > 0 && (
                  <span> Şu anki devir: <strong>{previousBalances[editingPersonnel.id].toLocaleString('tr-TR')} ₺</strong></span>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="carryover">Devir (₺) - Otomatik Hesaplanır</Label>
              <Input
                id="carryover"
                type="number"
                step="0.01"
                value={formData.carryover}
                readOnly
                disabled
                className="bg-gray-100 cursor-not-allowed"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-500">
                <strong>⚠️ Bu alan otomatik hesaplanır ve değiştirilemez.</strong> Borç bakiyesi sıfırlanana kadar otomatik olarak devam eder.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyWage">Bugün Yevmiye (₺)</Label>
              <Input
                id="dailyWage"
                type="number"
                step="0.01"
                value={formData.dailyWage}
                onChange={(e) => setFormData({ ...formData, dailyWage: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dailyPayment">Bugün Ödenen (₺)</Label>
              <Input
                id="dailyPayment"
                type="number"
                step="0.01"
                value={formData.dailyPayment}
                onChange={(e) => setFormData({ ...formData, dailyPayment: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="text-sm text-gray-600">Borç Bakiye (Bir sonraki güne devredecek)</div>
              <div className="text-xl font-semibold text-red-600">
                {(
                  (parseFloat(formData.carryover) || 0) +
                  (parseFloat(formData.dailyWage) || 0) -
                  (parseFloat(formData.dailyPayment) || 0)
                ).toLocaleString('tr-TR')} ₺
              </div>
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
    </div>
  )
}

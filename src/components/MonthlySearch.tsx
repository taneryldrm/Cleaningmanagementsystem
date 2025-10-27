import { useEffect, useState } from 'react'
import { apiCall } from '../utils/supabase/client'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Search, DollarSign, Users, FileText, ShoppingCart, Wallet } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'

interface CollectionResult {
  day: number
  customerName: string
  workDate: string
  amount: number
  date: string
  description?: string
}

interface ExpenseResult {
  day: number
  description: string
  invoiceDate: string
  amount: number
  date: string
}

interface PayrollResult {
  day: number
  personnelName: string
  dailyWage: number
  dailyPayment: number
  balance: number
  date: string
}

interface TransactionResult {
  day: number
  category: string
  description: string
  amount: number
  transactionType: 'income' | 'expense'
  date: string
}

interface WorkOrderResult {
  day: number
  customerName: string
  totalAmount: number
  paidAmount: number
  date: string
}

export function MonthlySearch({ user }: { user: any }) {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [collectionResults, setCollectionResults] = useState<CollectionResult[]>([])
  const [expenseResults, setExpenseResults] = useState<ExpenseResult[]>([])
  const [payrollResults, setPayrollResults] = useState<PayrollResult[]>([])
  const [transactionResults, setTransactionResults] = useState<TransactionResult[]>([])
  const [workOrderResults, setWorkOrderResults] = useState<WorkOrderResult[]>([])
  const [totalCollections, setTotalCollections] = useState(0)
  const [totalExpenses, setTotalExpenses] = useState(0)
  const [totalPayrollWages, setTotalPayrollWages] = useState(0)
  const [totalPayrollPayments, setTotalPayrollPayments] = useState(0)
  const [totalTransactions, setTotalTransactions] = useState(0)
  const [totalWorkOrders, setTotalWorkOrders] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const months = [
    { value: 1, label: 'Ocak' },
    { value: 2, label: 'Şubat' },
    { value: 3, label: 'Mart' },
    { value: 4, label: 'Nisan' },
    { value: 5, label: 'Mayıs' },
    { value: 6, label: 'Haziran' },
    { value: 7, label: 'Temmuz' },
    { value: 8, label: 'Ağustos' },
    { value: 9, label: 'Eylül' },
    { value: 10, label: 'Ekim' },
    { value: 11, label: 'Kasım' },
    { value: 12, label: 'Aralık' }
  ]

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i)

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      alert('Lütfen arama kelimesi giriniz')
      return
    }

    setLoading(true)
    setHasSearched(true)

    try {
      const response = await apiCall(`/monthly-search?keyword=${encodeURIComponent(searchKeyword)}&month=${selectedMonth}&year=${selectedYear}`)
      
      console.log('Search response:', response)
      
      setCollectionResults(response.collections || [])
      setExpenseResults(response.expenses || [])
      setPayrollResults(response.payrolls || [])
      setTransactionResults(response.transactions || [])
      setWorkOrderResults(response.workOrders || [])
      setTotalCollections(response.totalCollections || 0)
      setTotalExpenses(response.totalExpenses || 0)
      setTotalPayrollWages(response.totalPayrollWages || 0)
      setTotalPayrollPayments(response.totalPayrollPayments || 0)
      setTotalTransactions(response.totalTransactions || 0)
      setTotalWorkOrders(response.totalWorkOrders || 0)
    } catch (error) {
      console.error('Error searching:', error)
      alert('Arama sırasında hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  const totalResultCount = collectionResults.length + expenseResults.length + payrollResults.length + transactionResults.length + workOrderResults.length

  return (
    <div className="space-y-6 pb-8">
      {/* Search Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Aylık Arama ve Raporlama - Global Arama</CardTitle>
          <p className="text-sm text-gray-500">Müşteri/personel adı, telefon numarası, tutar veya açıklama ile arama yapın</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="searchKeyword">Aranacak Kelime / Tutar / Telefon</Label>
              <Input
                id="searchKeyword"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Örn: Ahmet, 5551234567, 3000"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="month">Ay</Label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Yıl</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button onClick={handleSearch} disabled={loading} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Aranıyor...' : 'Ara'}
              </Button>
            </div>
          </div>

          {hasSearched && (
            <div className="mt-4 p-4 bg-blue-50 rounded-md">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <span className="font-semibold">Arama:</span> "{searchKeyword}" - {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  <Badge variant="outline" className="bg-green-50">
                    <DollarSign className="h-3 w-3 mr-1" />
                    Tahsilat: {collectionResults.length}
                  </Badge>
                  <Badge variant="outline" className="bg-red-50">
                    <ShoppingCart className="h-3 w-3 mr-1" />
                    Gider: {expenseResults.length}
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50">
                    <Users className="h-3 w-3 mr-1" />
                    Yevmiye: {payrollResults.length}
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50">
                    <FileText className="h-3 w-3 mr-1" />
                    İşlem: {transactionResults.length}
                  </Badge>
                  <Badge variant="outline" className="bg-orange-50">
                    <Wallet className="h-3 w-3 mr-1" />
                    İş Emri: {workOrderResults.length}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {hasSearched && totalResultCount > 0 && (
        <div className="space-y-6">
          {/* Collections Results */}
          {collectionResults.length > 0 && (
            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Müşteri Tahsilatları ({collectionResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-3 py-2 text-xs text-left">GÜN</th>
                        <th className="border px-3 py-2 text-xs text-left">MÜŞTERİ</th>
                        <th className="border px-3 py-2 text-xs text-left">AÇIKLAMA</th>
                        <th className="border px-3 py-2 text-xs text-left">İŞ TARİHİ</th>
                        <th className="border px-3 py-2 text-xs text-right">TUTAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-sm">{item.day}. GÜN</td>
                          <td className="border px-3 py-2 text-sm bg-yellow-50">{item.customerName}</td>
                          <td className="border px-3 py-2 text-sm text-gray-600 italic">
                            {item.description || '-'}
                          </td>
                          <td className="border px-3 py-2 text-sm">
                            {item.workDate ? new Date(item.workDate).toLocaleDateString('tr-TR') : '-'}
                          </td>
                          <td className="border px-3 py-2 text-sm text-right font-semibold">
                            {item.amount.toLocaleString('tr-TR')} ₺
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-100 font-semibold">
                        <td colSpan={4} className="border px-3 py-2 text-sm text-right">TOPLAM:</td>
                        <td className="border px-3 py-2 text-sm text-right">
                          {totalCollections.toLocaleString('tr-TR')} ₺
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Expense Results */}
          {expenseResults.length > 0 && (
            <Card>
              <CardHeader className="bg-red-50">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Nakit Giderler ({expenseResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-3 py-2 text-xs text-left">GÜN</th>
                        <th className="border px-3 py-2 text-xs text-left">AÇIKLAMA</th>
                        <th className="border px-3 py-2 text-xs text-left">TARİH</th>
                        <th className="border px-3 py-2 text-xs text-right">TUTAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-sm">{item.day}.</td>
                          <td className="border px-3 py-2 text-sm bg-yellow-50">{item.description}</td>
                          <td className="border px-3 py-2 text-sm">
                            {item.invoiceDate ? new Date(item.invoiceDate).toLocaleDateString('tr-TR') : '-'}
                          </td>
                          <td className="border px-3 py-2 text-sm text-right font-semibold">
                            {item.amount.toLocaleString('tr-TR')} ₺
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-100 font-semibold">
                        <td colSpan={3} className="border px-3 py-2 text-sm text-right">TOPLAM:</td>
                        <td className="border px-3 py-2 text-sm text-right">
                          {totalExpenses.toLocaleString('tr-TR')} ₺
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payroll Results */}
          {payrollResults.length > 0 && (
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Yevmiye Ödemeleri ({payrollResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-3 py-2 text-xs text-left">GÜN</th>
                        <th className="border px-3 py-2 text-xs text-left">PERSONEL</th>
                        <th className="border px-3 py-2 text-xs text-right">GÜNLÜK YÖMİYE</th>
                        <th className="border px-3 py-2 text-xs text-right">ÖDEME</th>
                        <th className="border px-3 py-2 text-xs text-right">KALAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-sm">{item.day}.</td>
                          <td className="border px-3 py-2 text-sm bg-yellow-50">{item.personnelName}</td>
                          <td className="border px-3 py-2 text-sm text-right">
                            {item.dailyWage.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="border px-3 py-2 text-sm text-right font-semibold text-green-600">
                            {item.dailyPayment.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="border px-3 py-2 text-sm text-right font-semibold text-red-600">
                            {item.balance.toLocaleString('tr-TR')} ₺
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-blue-100 font-semibold">
                        <td colSpan={2} className="border px-3 py-2 text-sm text-right">TOPLAM:</td>
                        <td className="border px-3 py-2 text-sm text-right">
                          {totalPayrollWages.toLocaleString('tr-TR')} ₺
                        </td>
                        <td className="border px-3 py-2 text-sm text-right">
                          {totalPayrollPayments.toLocaleString('tr-TR')} ₺
                        </td>
                        <td className="border px-3 py-2 text-sm text-right"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Results */}
          {transactionResults.length > 0 && (
            <Card>
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Gelir-Gider İşlemleri ({transactionResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-3 py-2 text-xs text-left">GÜN</th>
                        <th className="border px-3 py-2 text-xs text-left">TİP</th>
                        <th className="border px-3 py-2 text-xs text-left">KATEGORİ</th>
                        <th className="border px-3 py-2 text-xs text-left">AÇIKLAMA</th>
                        <th className="border px-3 py-2 text-xs text-right">TUTAR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-sm">{item.day}.</td>
                          <td className="border px-3 py-2 text-sm">
                            <Badge variant={item.transactionType === 'income' ? 'default' : 'secondary'}>
                              {item.transactionType === 'income' ? 'Gelir' : 'Gider'}
                            </Badge>
                          </td>
                          <td className="border px-3 py-2 text-sm">{item.category}</td>
                          <td className="border px-3 py-2 text-sm bg-yellow-50">{item.description}</td>
                          <td className={`border px-3 py-2 text-sm text-right font-semibold ${
                            item.transactionType === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.transactionType === 'income' ? '+' : '-'}
                            {item.amount.toLocaleString('tr-TR')} ₺
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Order Results */}
          {workOrderResults.length > 0 && (
            <Card>
              <CardHeader className="bg-orange-50">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  İş Emirleri ({workOrderResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-3 py-2 text-xs text-left">GÜN</th>
                        <th className="border px-3 py-2 text-xs text-left">MÜŞTERİ</th>
                        <th className="border px-3 py-2 text-xs text-right">TOPLAM TUTAR</th>
                        <th className="border px-3 py-2 text-xs text-right">ÖDENEN</th>
                        <th className="border px-3 py-2 text-xs text-right">KALAN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workOrderResults.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border px-3 py-2 text-sm">{item.day}.</td>
                          <td className="border px-3 py-2 text-sm bg-yellow-50">{item.customerName}</td>
                          <td className="border px-3 py-2 text-sm text-right font-semibold">
                            {item.totalAmount.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="border px-3 py-2 text-sm text-right text-green-600">
                            {item.paidAmount.toLocaleString('tr-TR')} ₺
                          </td>
                          <td className="border px-3 py-2 text-sm text-right text-red-600 font-semibold">
                            {(item.totalAmount - item.paidAmount).toLocaleString('tr-TR')} ₺
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-orange-100 font-semibold">
                        <td colSpan={2} className="border px-3 py-2 text-sm text-right">TOPLAM:</td>
                        <td className="border px-3 py-2 text-sm text-right">
                          {totalWorkOrders.toLocaleString('tr-TR')} ₺
                        </td>
                        <td className="border px-3 py-2 text-sm text-right"></td>
                        <td className="border px-3 py-2 text-sm text-right"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {hasSearched && totalResultCount === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>"{searchKeyword}" için sonuç bulunamadı</p>
            <p className="text-sm mt-2">Farklı bir kelime veya tutar ile tekrar deneyin</p>
          </CardContent>
        </Card>
      )}

      {!hasSearched && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <div className="space-y-2">
              <p className="font-semibold">Arama yapmak için yukarıdaki formu doldurun</p>
              <p className="text-sm">Örnekler:</p>
              <ul className="text-sm space-y-1">
                <li>• Tutar araması: <span className="font-mono bg-gray-100 px-2 py-1 rounded">3000</span></li>
                <li>• Müşteri adı: <span className="font-mono bg-gray-100 px-2 py-1 rounded">YEMEK</span></li>
                <li>• Personel adı: <span className="font-mono bg-gray-100 px-2 py-1 rounded">Ahmet</span></li>
                <li>• Telefon: <span className="font-mono bg-gray-100 px-2 py-1 rounded">5551234567</span></li>
              </ul>
              <p className="text-xs text-gray-600 mt-2">💡 İsim veya telefon ile arama yaparsanız, o kişiye ait TÜM kayıtlar gelir</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

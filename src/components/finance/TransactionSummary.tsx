import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

interface TransactionSummaryProps {
  totalIncome: number
  totalExpense: number
  balance: number
}

export function TransactionSummary({ totalIncome, totalExpense, balance }: TransactionSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY'
    }).format(amount)
  }

  return (
    <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
      {/* Total Income Card */}
      <Card className="overflow-hidden border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Toplam Gelir</span>
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl text-green-600">
            {formatCurrency(totalIncome)}
          </div>
        </CardContent>
      </Card>

      {/* Total Expense Card */}
      <Card className="overflow-hidden border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Toplam Gider</span>
            <div className="p-2 bg-red-50 rounded-lg">
              <TrendingDown className="h-4 w-4 md:h-5 md:w-5 text-red-600" />
            </div>
          </div>
          <div className="text-2xl md:text-3xl text-red-600">
            {formatCurrency(totalExpense)}
          </div>
        </CardContent>
      </Card>

      {/* Balance Card */}
      <Card className={`overflow-hidden border-l-4 shadow-sm hover:shadow-md transition-shadow ${
        balance >= 0 ? 'border-l-blue-500' : 'border-l-orange-500'
      }`}>
        <CardContent className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Net Bakiye</span>
            <div className={`p-2 rounded-lg ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <Wallet className={`h-4 w-4 md:h-5 md:w-5 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl ${
            balance >= 0 ? 'text-blue-600' : 'text-orange-600'
          }`}>
            {formatCurrency(balance)}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

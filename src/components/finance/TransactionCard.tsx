import { TrendingUp, TrendingDown, Trash2, Calendar, User, Building2 } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { memo } from 'react'

interface TransactionCardProps {
  transaction: {
    id: string
    type: 'income' | 'expense'
    amount: number
    date: string
    category: string
    description: string
    relatedCustomerId: string | null
    createdByName: string
  }
  customerName?: string | null
  canDelete: boolean
  onDelete: (id: string) => void
}

// Memoize helper function outside component
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY'
  }).format(amount)
}

// Wrap component with React.memo to prevent unnecessary re-renders
export const TransactionCard = memo(function TransactionCard({ transaction, customerName, canDelete, onDelete }: TransactionCardProps) {
  const isIncome = transaction.type === 'income'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 hover:shadow-md transition-all duration-200 animate-fadeIn">
      {/* Mobile Layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${isIncome ? 'bg-green-50' : 'bg-red-50'}`}>
              {isIncome ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-gray-900 truncate">
                  {transaction.category || (isIncome ? 'Gelir' : 'Gider')}
                </h3>
                <Badge 
                  variant={isIncome ? 'default' : 'secondary'}
                  className="shrink-0"
                >
                  {isIncome ? 'Gelir' : 'Gider'}
                </Badge>
              </div>
              {transaction.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {transaction.description}
                </p>
              )}
            </div>
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(transaction.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 -mt-1 -mr-2"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className={`text-2xl ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
          {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span>{new Date(transaction.date).toLocaleDateString('tr-TR')}</span>
          </div>
          {customerName && (
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              <span className="truncate max-w-[150px]">{customerName}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="truncate max-w-[120px]">{transaction.createdByName || 'Bilinmiyor'}</span>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className={`p-3 rounded-lg ${isIncome ? 'bg-green-50' : 'bg-red-50'}`}>
            {isIncome ? (
              <TrendingUp className="h-6 w-6 text-green-600" />
            ) : (
              <TrendingDown className="h-6 w-6 text-red-600" />
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-gray-900">
                {transaction.category || (isIncome ? 'Gelir' : 'Gider')}
              </h3>
              <Badge variant={isIncome ? 'default' : 'secondary'}>
                {isIncome ? 'Gelir' : 'Gider'}
              </Badge>
            </div>
            {transaction.description && (
              <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                {transaction.description}
              </p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{new Date(transaction.date).toLocaleDateString('tr-TR')}</span>
              </div>
              {customerName && (
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>{customerName}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{transaction.createdByName || 'Bilinmiyor'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`text-3xl whitespace-nowrap ${isIncome ? 'text-green-600' : 'text-red-600'}`}>
            {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(transaction.id)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
})
import { Badge } from './ui/badge'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Eye, Edit, Trash2, Phone, Mail, MapPin } from 'lucide-react'
import { memo } from 'react'

interface Customer {
  id: string
  name: string
  type: 'regular' | 'problematic' | 'normal'
  contactInfo: any
  address: string
  notes: string
  balance: number
  createdAt: string
}

interface CustomerCardProps {
  customer: Customer
  onView: (customer: Customer) => void
  onEdit?: (customer: Customer) => void
  onDelete?: (customerId: string) => void
  canEdit: boolean
}

// Memoize helper functions outside component to avoid recreating
const getTypeColor = (type: string) => {
  switch (type) {
    case 'regular': return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'problematic': return 'bg-red-100 text-red-800 border-red-300'
    default: return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'regular': return 'Düzenli'
    case 'problematic': return 'Sıkıntılı'
    default: return 'Normal'
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0
  }).format(amount || 0)
}

// Wrap component with React.memo to prevent unnecessary re-renders
export const CustomerCard = memo(function CustomerCard({ customer, onView, onEdit, onDelete, canEdit }: CustomerCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 border border-gray-200 hover:border-blue-300">
      <div className="p-4 sm:p-5">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="font-semibold text-gray-900 truncate mb-1.5 text-base sm:text-lg">
              {customer.name}
            </h3>
            <Badge className={`${getTypeColor(customer.type)} text-xs font-medium`}>
              {getTypeLabel(customer.type)}
            </Badge>
          </div>
          
          {/* Balance */}
          {customer.balance !== 0 && (
            <div className={`text-sm sm:text-base font-bold whitespace-nowrap ${customer.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(Math.abs(customer.balance))}
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="space-y-2 mb-3">
          {customer.contactInfo?.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <Phone className="h-3.5 w-3.5 mr-2 text-gray-400 flex-shrink-0" />
              <span className="truncate">{customer.contactInfo.phone}</span>
            </div>
          )}
          {customer.contactInfo?.email && (
            <div className="flex items-center text-sm text-gray-600">
              <Mail className="h-3.5 w-3.5 mr-2 text-gray-400 flex-shrink-0" />
              <span className="truncate">{customer.contactInfo.email}</span>
            </div>
          )}
          {customer.address && (
            <div className="flex items-start text-sm text-gray-600">
              <MapPin className="h-3.5 w-3.5 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
              <span className="line-clamp-2">{customer.address}</span>
            </div>
          )}
        </div>

        {/* Notes Preview */}
        {customer.notes && (
          <p className="text-sm text-gray-500 line-clamp-2 mb-3 italic bg-gray-50 p-2 rounded">
            {customer.notes}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 hover:bg-blue-50 hover:border-blue-300 transition-colors"
            onClick={() => onView(customer)}
          >
            <Eye className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Detay</span>
            <span className="sm:hidden">Görüntüle</span>
          </Button>
          
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(customer)}
                className="hover:bg-gray-100"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(customer.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  )
})
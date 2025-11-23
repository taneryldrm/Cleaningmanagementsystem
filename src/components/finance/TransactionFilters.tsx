import { Filter, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Card, CardContent } from '../ui/card'
import { useState } from 'react'

interface TransactionFiltersProps {
  filterType: string
  startDate: string
  endDate: string
  onFilterTypeChange: (type: string) => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
  onClearFilters: () => void
}

export function TransactionFilters({
  filterType,
  startDate,
  endDate,
  onFilterTypeChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters
}: TransactionFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const hasActiveFilters = filterType !== 'all' || startDate || endDate

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        {/* Mobile: Collapsible Filters */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              <Filter className="h-4 w-4" />
              Filtreler
              {hasActiveFilters && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Aktif
                </span>
              )}
            </button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Temizle
              </Button>
            )}
          </div>

          {isExpanded && (
            <div className="space-y-3 pt-3 border-t">
              <div className="space-y-2">
                <Label className="text-xs">İşlem Tipi</Label>
                <Select value={filterType} onValueChange={onFilterTypeChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tümü</SelectItem>
                    <SelectItem value="income">Gelir</SelectItem>
                    <SelectItem value="expense">Gider</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Başlangıç</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => onStartDateChange(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Bitiş</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => onEndDateChange(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: Always Visible Filters */}
        <div className="hidden md:flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <Label className="text-sm">İşlem Tipi</Label>
            <Select value={filterType} onValueChange={onFilterTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="income">Gelir</SelectItem>
                <SelectItem value="expense">Gider</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex-1 space-y-2">
            <Label className="text-sm">Başlangıç Tarihi</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
            />
          </div>
          
          <div className="flex-1 space-y-2">
            <Label className="text-sm">Bitiş Tarihi</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
            />
          </div>
          
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={onClearFilters}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <X className="h-4 w-4 mr-2" />
              Temizle
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

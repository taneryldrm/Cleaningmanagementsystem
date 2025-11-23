import { Input } from './ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Search } from 'lucide-react'

interface StickySearchHeaderProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  filterType: string
  onFilterChange: (value: string) => void
  totalCount: number
  filteredCount: number
}

export function StickySearchHeader({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterChange,
  totalCount,
  filteredCount
}: StickySearchHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
      <div className="p-3 sm:p-4 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Müşteri adı, telefon veya email..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors text-sm sm:text-base"
          />
        </div>

        {/* Filter and Stats */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <Select value={filterType} onValueChange={onFilterChange}>
            <SelectTrigger className="w-[140px] sm:w-[180px] bg-gray-50 border-gray-200 text-sm">
              <SelectValue placeholder="Tümü" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Müşteriler</SelectItem>
              <SelectItem value="regular">Düzenli</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="problematic">Sıkıntılı</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-xs sm:text-sm text-gray-600">
            {filteredCount !== totalCount ? (
              <span>
                <span className="font-semibold text-gray-900">{filteredCount}</span>
                <span className="hidden sm:inline"> / {totalCount} müşteri</span>
                <span className="sm:hidden">/{totalCount}</span>
              </span>
            ) : (
              <span>
                <span className="font-semibold text-gray-900">{totalCount}</span>
                <span className="hidden sm:inline"> müşteri</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
import { Card } from './ui/card'
import { Skeleton } from './ui/skeleton'

export function CustomerCardSkeleton() {
  return (
    <Card className="overflow-hidden border border-gray-200">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-5 w-16 ml-2" />
        </div>

        {/* Contact Info */}
        <div className="space-y-2 mb-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Notes */}
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-3/4 mb-3" />

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
      </div>
    </Card>
  )
}

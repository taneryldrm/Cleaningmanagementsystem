export function TransactionCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-5 animate-pulse">
      {/* Mobile Layout */}
      <div className="md:hidden space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="h-4 w-full bg-gray-200 rounded" />
          </div>
        </div>
        <div className="h-8 w-36 bg-gray-200 rounded" />
        <div className="flex gap-3">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-28 bg-gray-200 rounded" />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 bg-gray-200 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-5 w-40 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
            </div>
            <div className="h-4 w-96 bg-gray-200 rounded" />
            <div className="flex gap-4">
              <div className="h-4 w-28 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>
        <div className="h-10 w-40 bg-gray-200 rounded" />
      </div>
    </div>
  )
}

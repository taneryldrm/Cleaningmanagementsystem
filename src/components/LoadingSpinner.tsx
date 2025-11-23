import { Loader2 } from 'lucide-react'

export function LoadingSpinner({ message = "Yükleniyor..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}

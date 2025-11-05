import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  ClipboardList, 
  TrendingUp,
  Settings,
  CalendarDays,
  Smartphone,
  Wallet,
  DollarSign,
  SearchCheck,
  BarChart3,
  AlertCircle,
  User
} from 'lucide-react'

type Page = 'dashboard' | 'analytics' | 'customers' | 'personnel' | 'work-orders' | 'personnel-schedule' | 'mobile-daily' | 'personnel-payroll' | 'daily-cash-flow' | 'monthly-search' | 'finance' | 'pending-collections' | 'users'

interface MobileMenuGridProps {
  role: string
  userName: string
  onNavigate: (page: Page) => void
}

export function MobileMenuGrid({ role, userName, onNavigate }: MobileMenuGridProps) {
  const menuItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'secretary', 'driver', 'cleaner'] },
    { id: 'analytics' as Page, label: 'Raporlar', icon: BarChart3, roles: ['admin', 'secretary'] },
    { id: 'customers' as Page, label: 'Müşteriler', icon: Users, roles: ['admin', 'secretary'] },
    { id: 'personnel' as Page, label: 'Personel', icon: UserCog, roles: ['admin', 'secretary'] },
    { id: 'work-orders' as Page, label: 'İş Emirleri', icon: ClipboardList, roles: ['admin', 'secretary', 'driver'] },
    { id: 'mobile-daily' as Page, label: 'Günlük Program', icon: Smartphone, roles: ['admin', 'secretary', 'driver', 'cleaner'] },
    { id: 'personnel-payroll' as Page, label: 'Bordro', icon: Wallet, roles: ['admin', 'secretary'] },
    { id: 'daily-cash-flow' as Page, label: 'Nakit Akışı', icon: DollarSign, roles: ['admin', 'secretary'] },
    { id: 'pending-collections' as Page, label: 'Tahsilatlar', icon: AlertCircle, roles: ['admin', 'secretary'] },
    { id: 'monthly-search' as Page, label: 'Geçmiş Arama', icon: SearchCheck, roles: ['admin', 'secretary'] },
    { id: 'personnel-schedule' as Page, label: 'Takvim', icon: CalendarDays, roles: ['admin', 'secretary', 'driver'] },
    { id: 'finance' as Page, label: 'Gelir-Gider', icon: TrendingUp, roles: ['admin', 'secretary'] },
    { id: 'users' as Page, label: 'Kullanıcılar', icon: Settings, roles: ['admin'] },
  ]

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(role))

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Yönetici'
      case 'secretary': return 'Sekreter'
      case 'driver': return 'Şoför'
      case 'cleaner': return 'Temizlikçi'
      default: return 'Kullanıcı'
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-gray-50 to-gray-100 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6 px-6 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl text-gray-900">Uçanlar Temizlik</h1>
            <p className="text-xs text-gray-500 mt-1">İş Yönetim Sistemi</p>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 border border-gray-200">
            <User className="h-4 w-4 text-gray-600" />
            <div className="text-right">
              <div className="text-sm text-gray-900">{userName}</div>
              <div className="text-xs text-gray-500">{getRoleLabel(role)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Menu */}
      <div className="px-4 py-8 pb-12">
        <div className="grid grid-cols-3 gap-6 max-w-md mx-auto">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col items-center gap-3 group"
              >
                {/* Icon Circle */}
                <div className="w-20 h-20 rounded-full border-2 border-gray-300 bg-white shadow-sm flex items-center justify-center transition-all duration-200 group-hover:bg-gray-50 group-hover:border-gray-400 group-hover:shadow-md group-hover:scale-105 group-active:scale-95">
                  <Icon className="h-9 w-9 text-gray-700" />
                </div>
                
                {/* Label */}
                <span className="text-gray-800 text-center text-sm leading-tight">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

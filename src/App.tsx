import { useEffect, useState } from 'react'
import { createClient, apiCall } from './utils/supabase/client'
import { Login } from './components/Login'
import { Setup } from './components/Setup'
import { Dashboard } from './components/Dashboard'
import { Customers } from './components/Customers'
import { Personnel } from './components/Personnel'
import { WorkOrders } from './components/WorkOrders'
import { PersonnelSchedule } from './components/PersonnelSchedule'
import { MobileDailyProgram } from './components/MobileDailyProgram'
import { PersonnelPayroll } from './components/PersonnelPayroll'
import { DailyCashFlow } from './components/DailyCashFlow'
import { MonthlySearch } from './components/MonthlySearch'
import { Finance } from './components/Finance'
import { UserManagement } from './components/UserManagement'
import { Analytics } from './components/Analytics'
import { PendingCollections } from './components/PendingCollections'
import { DataImport } from './components/DataImport'
import { MobileMenuGrid } from './components/MobileMenuGrid'
import { Button } from './components/ui/button'
import { useIsMobile } from './components/ui/use-mobile'
import { 
  LayoutDashboard, 
  Users, 
  UserCog, 
  ClipboardList, 
  TrendingUp, 
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  CalendarDays,
  Smartphone,
  Wallet,
  DollarSign,
  SearchCheck,
  BarChart3,
  AlertCircle,
  Grid3x3,
  ArrowLeft,
  Upload
} from 'lucide-react'

type Page = 'dashboard' | 'analytics' | 'customers' | 'personnel' | 'work-orders' | 'personnel-schedule' | 'mobile-daily' | 'personnel-payroll' | 'daily-cash-flow' | 'monthly-search' | 'finance' | 'pending-collections' | 'users' | 'data-import'

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [currentPage, setCurrentPage] = useState<Page>('dashboard')
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showMobileMenuGrid, setShowMobileMenuGrid] = useState(true)
  const [serverStatus, setServerStatus] = useState<'checking' | 'ready' | 'error'>('checking')
  const isMobile = useIsMobile()

  useEffect(() => {
    checkServerHealth()
    
    // Set up auth state listener
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event, session?.user?.email)
      
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setUser(null)
        setCurrentPage('dashboard')
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setUser(session.user)
        }
      } else if (event === 'USER_UPDATED') {
        if (session?.user) {
          setUser(session.user)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const checkServerHealth = async () => {
    try {
      await apiCall('/health', { skipAuth: true })
      setServerStatus('ready')
      checkUser()
    } catch (error) {
      console.error('Server health check failed:', error)
      setServerStatus('error')
      // Still try to check user after a delay
      setTimeout(() => {
        checkUser()
      }, 2000)
    }
  }

  const checkUser = async () => {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
      } else {
        // Check if system needs setup (no users exist)
        await checkIfNeedsSetup()
      }
    } catch (error) {
      console.error('Error checking user:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkIfNeedsSetup = async () => {
    try {
      // Use unauthenticated endpoint to check if setup is needed
      const result = await apiCall('/check-setup', { skipAuth: true })
      if (result.needsSetup) {
        setNeedsSetup(true)
      }
    } catch (error) {
      console.error('Error checking setup status:', error)
      // On error, don't assume setup is needed - just show login
      setNeedsSetup(false)
    }
  }

  const handleSetupComplete = () => {
    setNeedsSetup(false)
    // Reload to show login page
    window.location.reload()
  }

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
      setCurrentPage('dashboard')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="animate-pulse">
            <div className="text-2xl mb-2">⏳</div>
            <p className="text-gray-700">Yükleniyor...</p>
            {serverStatus === 'checking' && (
              <p className="text-sm text-gray-500 mt-2">Sunucu bağlantısı kontrol ediliyor...</p>
            )}
            {serverStatus === 'error' && (
              <p className="text-sm text-amber-600 mt-2">
                Sunucu başlatılıyor, lütfen bekleyin...
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (needsSetup) {
    return <Setup onSetupComplete={handleSetupComplete} />
  }

  if (!user) {
    return <Login onLoginSuccess={checkUser} onNeedsSetup={() => setNeedsSetup(true)} />
  }

  const role = user?.user_metadata?.role
  const userName = user?.user_metadata?.name || 'Kullanıcı'

  // Handle mobile menu grid navigation
  const handleMobileNavigate = (page: Page) => {
    setCurrentPage(page)
    setShowMobileMenuGrid(false)
    setIsMobileMenuOpen(false)
    // Scroll to top when navigating
    window.scrollTo(0, 0)
  }

  const handleBackToMobileMenu = () => {
    setShowMobileMenuGrid(true)
    setIsMobileMenuOpen(false)
    // Scroll to top when returning to menu
    window.scrollTo(0, 0)
  }

  const menuItems = [
    { id: 'dashboard' as Page, label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'secretary', 'driver', 'cleaner'] },
    { id: 'analytics' as Page, label: 'Raporlama & Analitik', icon: BarChart3, roles: ['admin', 'secretary'] },
    { id: 'customers' as Page, label: 'Müşteriler', icon: Users, roles: ['admin', 'secretary'] },
    { id: 'personnel' as Page, label: 'Personel', icon: UserCog, roles: ['admin', 'secretary'] },
    { id: 'work-orders' as Page, label: 'İş Emirleri', icon: ClipboardList, roles: ['admin', 'secretary', 'driver'] },
    { id: 'mobile-daily' as Page, label: 'Günlük İş Programı', icon: Smartphone, roles: ['admin', 'secretary', 'driver', 'cleaner'] },
    { id: 'personnel-payroll' as Page, label: 'Personel Bordroları', icon: Wallet, roles: ['admin', 'secretary'] },
    { id: 'daily-cash-flow' as Page, label: 'Günlük Nakit Akışı', icon: DollarSign, roles: ['admin', 'secretary'] },
    { id: 'pending-collections' as Page, label: 'Bekleyen Tahsilatlar', icon: AlertCircle, roles: ['admin', 'secretary'] },
    { id: 'monthly-search' as Page, label: 'Geçmiş Arama', icon: SearchCheck, roles: ['admin', 'secretary'] },
    { id: 'personnel-schedule' as Page, label: 'Personel Takvimi', icon: CalendarDays, roles: ['admin', 'secretary', 'driver'] },
    { id: 'finance' as Page, label: 'Gelir-Gider', icon: TrendingUp, roles: ['admin', 'secretary'] },
    { id: 'data-import' as Page, label: 'Veri İçe Aktar', icon: Upload, roles: ['admin'] },
    { id: 'users' as Page, label: 'Kullanıcılar', icon: Settings, roles: ['admin'] },
  ]

  const visibleMenuItems = menuItems.filter(item => item.roles.includes(role))

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard user={user} onNavigate={setCurrentPage} />
      case 'analytics':
        return <Analytics user={user} />
      case 'customers':
        return <Customers user={user} />
      case 'personnel':
        return <Personnel user={user} />
      case 'work-orders':
        return <WorkOrders user={user} />
      case 'mobile-daily':
        return <MobileDailyProgram user={user} />
      case 'personnel-payroll':
        return <PersonnelPayroll user={user} />
      case 'daily-cash-flow':
        return <DailyCashFlow user={user} />
      case 'pending-collections':
        return <PendingCollections user={user} />
      case 'monthly-search':
        return <MonthlySearch user={user} />
      case 'personnel-schedule':
        return <PersonnelSchedule />
      case 'finance':
        return <Finance user={user} />
      case 'users':
        return role === 'admin' ? <UserManagement /> : <Dashboard user={user} onNavigate={setCurrentPage} />
      case 'data-import':
        return role === 'admin' ? <DataImport user={user} /> : <Dashboard user={user} onNavigate={setCurrentPage} />
      default:
        return <Dashboard user={user} onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Hidden on mobile when showing grid menu */}
      {!(isMobile && showMobileMenuGrid) && (
        <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              {/* Mobile: Show back button when not on grid menu */}
              {isMobile && !showMobileMenuGrid ? (
                <button
                  onClick={handleBackToMobileMenu}
                  className="p-2 rounded-md hover:bg-gray-100 active:bg-gray-200 transition-colors"
                  title="Ana Menüye Dön"
                >
                  <ArrowLeft className="h-6 w-6 text-gray-700" />
                </button>
              ) : !isMobile && !showMobileMenuGrid && (
                /* Desktop: Show hamburger menu */
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                >
                  {isMobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              )}
              <div>
                <h1 className="text-xl">Uçanlar Temizlik</h1>
                <p className="text-xs text-gray-500">İş Yönetim Sistemi</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm">{userName}</div>
                <div className="text-xs text-gray-500">
                  {role === 'admin' && 'Yönetici'}
                  {role === 'secretary' && 'Sekreter'}
                  {role === 'driver' && 'Şoför'}
                  {role === 'cleaner' && 'Temizlikçi'}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Çıkış
              </Button>
            </div>
          </div>
        </div>
      </header>
      )}

      <div className={isMobile && showMobileMenuGrid ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <nav className="space-y-1 sticky top-24">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setCurrentPage(item.id)
                      window.scrollTo(0, 0)
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                      currentPage === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="bg-white w-64 h-full p-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-medium">Menü</h2>
                  <button onClick={() => setIsMobileMenuOpen(false)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <nav className="space-y-1">
                  {visibleMenuItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentPage(item.id)
                          setIsMobileMenuOpen(false)
                          window.scrollTo(0, 0)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                          currentPage === item.id
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {isMobile && showMobileMenuGrid ? (
              <MobileMenuGrid 
                role={role} 
                userName={userName} 
                onNavigate={handleMobileNavigate}
              />
            ) : (
              renderPage()
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
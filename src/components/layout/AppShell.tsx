import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { Bell, BookOpen, Camera, FlaskConical, LayoutDashboard, Map, Settings, Wifi, WifiOff, Languages, Menu, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useT, type TKey } from '@/i18n'
import { cn } from '@/lib/utils'
import { Logo } from './Logo'

const NAV: { to: string; key: TKey; icon: typeof LayoutDashboard; end?: boolean; mobile?: boolean }[] = [
  { to: '/', key: 'nav_dashboard', icon: LayoutDashboard, end: true, mobile: true },
  { to: '/plots', key: 'nav_plots', icon: Map, mobile: true },
  { to: '/assess', key: 'nav_assess', icon: Camera, mobile: true },
  { to: '/alerts', key: 'nav_alerts', icon: Bell, mobile: true },
  { to: '/knowledge', key: 'nav_knowledge', icon: BookOpen },
  { to: '/model', key: 'nav_model', icon: FlaskConical },
  { to: '/settings', key: 'nav_settings', icon: Settings, mobile: true },
]

export function AppShell() {
  const t = useT()
  const online = useOnlineStatus()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)
  const unread = useAppStore((s) => s.alerts.filter((a) => !a.read).length)
  const queued = useAppStore((s) => s.observations.filter((o) => o.syncStatus === 'queued').length)
  const syncQueued = useAppStore((s) => s.syncQueued)
  const language = useAppStore((s) => s.settings.language)
  const updateSettings = useAppStore((s) => s.updateSettings)

  // FR-16 – synchronise queued observations when connectivity returns
  useEffect(() => {
    if (online && queued > 0) {
      const id = setTimeout(syncQueued, 1200)
      return () => clearTimeout(id)
    }
  }, [online, queued, syncQueued])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  // Close drawer on navigation
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setDrawer(false)
  }

  const navList = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, key, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-700 text-white shadow-xs' : 'text-brand-100/80 hover:bg-white/10 hover:text-white',
            )
          }
        >
          <Icon className="size-4.5" />
          <span className="flex-1">{t(key)}</span>
          {to === '/alerts' && unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">{unread}</span>}
        </NavLink>
      ))}
    </nav>
  )

  const sidebarFooter = (
    <div className="rounded-lg bg-white/5 p-3 text-[11px] leading-relaxed text-brand-100/70">
      <p className="font-semibold text-brand-50">Component 04</p>
      <p>Explainable multimodal disease progression forecasting · CDAP_IT_09_2026</p>
    </div>
  )

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-6 bg-brand-950 px-4 py-5 lg:flex">
        <Logo />
        {navList}
        <div className="mt-auto">{sidebarFooter}</div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-brand-950 px-4 py-5">
            <div className="flex items-center justify-between">
              <Logo />
              <button onClick={() => setDrawer(false)} className="rounded p-1 text-brand-100 hover:bg-white/10" aria-label="Close menu">
                <X className="size-5" />
              </button>
            </div>
            {navList}
            <div className="mt-auto">{sidebarFooter}</div>
          </aside>
        </div>
      )}

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-stone-200 bg-white/90 px-4 backdrop-blur sm:px-6">
        <button onClick={() => setDrawer(true)} className="-ml-1 rounded p-1.5 text-stone-600 hover:bg-stone-100 lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <div className="lg:hidden">
          <Logo compact />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800',
            )}
            title={online ? 'Connected – observations sync automatically' : 'Offline – observations are queued on this device'}
          >
            {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
            {online ? t('online') : t('offline')}
            {queued > 0 && <span className="rounded-full bg-amber-200 px-1.5 text-amber-900">{queued} {t('queued')}</span>}
          </span>
          <button
            onClick={() => updateSettings({ language: language === 'en' ? 'si' : 'en' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
            title="Switch language"
          >
            <Languages className="size-3.5" />
            {language === 'en' ? 'සිංහල' : 'English'}
          </button>
          <NavLink to="/alerts" className="relative rounded-lg p-2 text-stone-600 hover:bg-stone-100" aria-label="Alerts">
            <Bell className="size-5" />
            {unread > 0 && <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">{unread}</span>}
          </NavLink>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:pb-10">
        <Outlet />
      </main>

      {/* Mobile bottom navigation – grower-facing app */}
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-stone-200 bg-white lg:hidden">
        {NAV.filter((n) => n.mobile).map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand-700' : 'text-stone-500')
            }
          >
            {to === '/assess' ? (
              <span className="-mt-5 rounded-full bg-brand-700 p-3 text-white shadow-lg ring-4 ring-white">
                <Icon className="size-5" />
              </span>
            ) : (
              <Icon className="size-5" />
            )}
            <span className="max-w-full truncate px-1">{t(key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

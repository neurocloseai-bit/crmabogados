import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Icon, Logo, type IconName } from './icons'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Inicio', icon: 'home', end: true },
  { to: '/leads', label: 'Leads', icon: 'leads' },
  { to: '/seguimiento', label: 'Seguimiento', icon: 'follow' },
  { to: '/clientes', label: 'Clientes', icon: 'clients' },
  { to: '/expedientes', label: 'Expedientes', icon: 'cases' },
  { to: '/agenda', label: 'Agenda', icon: 'agenda' },
  { to: '/cobranza', label: 'Cobranza', icon: 'money' },
  { to: '/documentos', label: 'Documentos', icon: 'docs' },
]

export function Layout() {
  const { firm, session, signOut } = useAuth()
  const link = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-all ${isActive ? 'bg-gradient-to-r from-gold-300 to-gold-400 text-navy-950 shadow-md shadow-black/20' : 'text-white/75 hover:bg-white/10 hover:text-white'}`
  const initial = (firm?.fullName ?? session?.user.email ?? '?').trim().charAt(0).toUpperCase()
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-hero text-white md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-none md:flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <div className="truncate font-display text-base leading-tight tracking-wider">{firm?.name}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">Despacho CRM</div>
            </div>
          </div>
          <button type="button" onClick={() => void signOut()} aria-label="Cerrar sesión" className="rounded-lg border border-white/20 p-2 text-white/80 hover:bg-white/10 md:hidden"><Icon name="out" className="h-4 w-4" /></button>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              <Icon name={n.icon} className="h-[18px] w-[18px] flex-none" />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-3 border-t border-white/10 p-4 md:flex">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-gold-400 text-sm font-bold text-navy-950">{initial}</span>
          <div className="min-w-0 flex-1 text-xs">
            <div className="truncate font-semibold text-white">{firm?.fullName ?? session?.user.email}</div>
            <div className="capitalize text-white/60">{firm?.role}</div>
          </div>
          <button type="button" onClick={() => void signOut()} aria-label="Cerrar sesión" title="Cerrar sesión" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"><Icon name="out" className="h-4 w-4" /></button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-10 md:py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  )
}

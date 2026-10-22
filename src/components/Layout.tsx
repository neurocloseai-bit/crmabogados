import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/leads', label: 'Leads' },
  { to: '/seguimiento', label: 'Seguimiento' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/expedientes', label: 'Expedientes' },
  { to: '/agenda', label: 'Agenda' },
  { to: '/cobranza', label: 'Cobranza' },
  { to: '/documentos', label: 'Documentos' },
]

export function Layout() {
  const { firm, session, signOut } = useAuth()
  const link = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${isActive ? 'bg-gold-400 text-navy-950' : 'text-white/80 hover:bg-white/10 hover:text-white'}`
  return (
    <div className="min-h-screen md:flex">
      <aside className="bg-navy-900 text-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-none md:flex-col">
        <div className="flex items-center justify-between px-4 py-3 md:block md:py-5">
          <div>
            <div className="font-display text-lg leading-tight tracking-wider">{firm?.name}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-400">Despacho CRM</div>
          </div>
          <button type="button" onClick={() => void signOut()} className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 md:hidden">Salir</button>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>)}
        </nav>
        <div className="hidden border-t border-white/10 p-4 text-xs text-white/70 md:block">
          <div className="truncate">{session?.user.email}</div>
          <div className="mb-2 capitalize">{firm?.role}</div>
          <button type="button" onClick={() => void signOut()} className="rounded-lg border border-white/20 px-3 py-1.5 font-semibold hover:bg-white/10">Cerrar sesión</button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-7">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Icon, Logo, type IconName } from './icons'

const POINTS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'follow', title: 'Seguimiento sin que se te pase nadie', text: 'Calendario de próximos contactos con cada lead.' },
  { icon: 'agenda', title: 'Términos y audiencias a la vista', text: 'Cómputo de días hábiles y avisos por vencer.' },
  { icon: 'money', title: 'Cobranza con planes de pago', text: 'Anticipos, mensualidades y lo que te deben.' },
]

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      <aside className="bg-hero relative flex flex-col justify-between overflow-hidden px-6 py-6 text-white lg:px-14 lg:py-12">
        <div className="bg-grain pointer-events-none absolute inset-0" />
        <div className="relative flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="font-display text-xl tracking-wider">Despacho CRM</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-300">Para abogados litigantes</div>
          </div>
        </div>
        <div className="relative my-10 hidden lg:block">
          <h1 className="font-display text-4xl leading-tight tracking-wide xl:text-5xl">Tu despacho,<br /><span className="text-gold-300">en orden.</span></h1>
          <p className="mt-4 max-w-md text-base text-white/75">Leads, clientes, expedientes y cobranza en un solo lugar. Hecho para que ningún plazo ni cliente se te escape.</p>
          <ul className="mt-9 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-white/15 bg-white/10 text-gold-300 backdrop-blur"><Icon name={p.icon} /></span>
                <span><b className="block text-sm">{p.title}</b><span className="text-sm text-white/65">{p.text}</span></span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative hidden items-center gap-2 text-xs text-white/55 lg:flex"><Icon name="shield" className="h-4 w-4" /> Los datos de cada despacho están aislados y protegidos.</p>
      </aside>
      <main className="grid place-items-center px-5 py-10">
        <div className="w-full max-w-sm animate-rise">{children}</div>
      </main>
    </div>
  )
}

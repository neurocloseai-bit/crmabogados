import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import type { Deadline, Lead, Payment } from '../lib/types'
import { daysBetween, fdate, mxn, today } from '../lib/format'
import { Badge, Spinner, Stat } from '../components/ui'
import { Icon } from '../components/icons'

export default function Dashboard() {
  const { firm } = useAuth()
  const leads = useQuery<Pick<Lead, 'id' | 'name' | 'stage' | 'follow_up_date'>[]>(() => supabase.from('leads').select('id, name, stage, follow_up_date'), [])
  const dls = useQuery<Deadline[]>(() => supabase.from('deadlines').select('*, cases(title, clients(full_name))').eq('done', false).order('due_date').limit(60), [])
  const pays = useQuery<Payment[]>(() => supabase.from('payments').select('*, cases(title, clients(full_name))'), [])
  const cases = useQuery<{ id: string }[]>(() => supabase.from('cases').select('id').eq('status', 'activo'), [])
  if (leads.loading || dls.loading || pays.loading || cases.loading) return <Spinner />

  const t = today()
  const L = leads.data ?? [], D = dls.data ?? [], P = pays.data ?? []
  const open = L.filter((l) => l.stage !== 'cliente' && l.stage !== 'perdido')
  const toAttend = L.filter((l) => l.stage === 'nuevo' || l.stage === 'contactado').length
  const followLate = open.filter((l) => l.follow_up_date && l.follow_up_date <= t).length
  const urgent = D.filter((d) => daysBetween(t, d.due_date) <= 7)
  const pend = P.filter((p) => !p.paid_on)
  const overdue = pend.filter((p) => p.due_date && p.due_date < t)

  return (
    <>
      <section className="bg-hero relative mb-6 overflow-hidden rounded-2xl p-6 text-white shadow-card md:p-8 animate-rise">
        <div className="bg-grain pointer-events-none absolute inset-0" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-300 first-letter:uppercase">{new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h1 className="mt-1 font-display text-2xl tracking-wide md:text-3xl">Hola, {firm?.fullName ?? firm?.name}</h1>
            <p className="mt-1 text-sm text-white/70">{followLate || urgent.length ? `Tienes ${followLate} seguimiento${followLate === 1 ? '' : 's'} y ${urgent.length} vencimiento${urgent.length === 1 ? '' : 's'} por atender.` : 'Todo al día. Buen momento para prospectar.'}</p>
          </div>
          <div className="flex gap-2">
            <Link to="/leads" className="rounded-lg bg-gradient-to-b from-gold-300 to-gold-400 px-4 py-2 text-sm font-semibold text-navy-950 shadow-md">+ Nuevo lead</Link>
            <Link to="/seguimiento" className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10">Ver calendario</Link>
          </div>
        </div>
      </section>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon="leads" label="Leads por atender" value={toAttend} />
        <Stat icon="clock" label="Seguimientos hoy o vencidos" value={followLate} tone={followLate ? 'alert' : 'normal'} />
        <Stat icon="cases" label="Casos activos" value={cases.data?.length ?? 0} />
        <Stat icon="money" label="Por cobrar" value={mxn(pend.reduce((s, p) => s + p.amount, 0))} tone={overdue.length ? 'alert' : 'normal'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-baseline justify-between"><h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy-800"><Icon name="agenda" className="h-4 w-4 text-gold-500" />Términos y audiencias (7 días)</h2><Link to="/agenda" className="text-xs font-semibold text-navy-700 underline">Ver agenda</Link></div>
          {!urgent.length ? <p className="rounded-2xl border border-dashed border-silver-200 bg-white/70 p-5 text-sm text-silver-500">No tienes nada que venza en los próximos 7 días.</p> : (
            <ul className="divide-y divide-silver-200 overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
              {urgent.slice(0, 8).map((d) => {
                const diff = daysBetween(t, d.due_date)
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <span className="min-w-0"><b className="break-words">{d.title}</b><span className="block text-xs text-silver-500 break-words">{fdate(d.due_date)} · {d.cases?.title ?? 'Sin expediente'}</span></span>
                    {diff < 0 ? <Badge tone="red">Vencido</Badge> : diff === 0 ? <Badge tone="amber">Hoy</Badge> : <Badge tone={diff <= 3 ? 'amber' : 'gray'}>En {diff} d</Badge>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <section>
          <div className="mb-2 flex items-baseline justify-between"><h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-navy-800"><Icon name="money" className="h-4 w-4 text-gold-500" />Pagos próximos</h2><Link to="/cobranza" className="text-xs font-semibold text-navy-700 underline">Ver cobranza</Link></div>
          {!pend.length ? <p className="rounded-2xl border border-dashed border-silver-200 bg-white/70 p-5 text-sm text-silver-500">No hay pagos pendientes.</p> : (
            <ul className="divide-y divide-silver-200 overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
              {pend.sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')).slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <span className="min-w-0"><b className="break-words">{p.cases?.clients?.full_name ?? p.cases?.title}</b><span className="block text-xs text-silver-500">{p.due_date ? fdate(p.due_date) : 'Sin fecha'} · <span className="capitalize">{p.kind}</span></span></span>
                  <span className="flex items-center gap-2"><b className="tabular-nums">{mxn(p.amount)}</b>{p.due_date && p.due_date < t && <Badge tone="red">Vencido</Badge>}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}

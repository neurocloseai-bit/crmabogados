import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import type { Deadline, Lead, Payment } from '../lib/types'
import { daysBetween, fdate, mxn, today } from '../lib/format'
import { Badge, PageHeader, Spinner, Stat } from '../components/ui'

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
      <PageHeader title={`Hola, ${firm?.fullName ?? firm?.name}`} subtitle="Esto es lo que necesita tu atención." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Leads por atender" value={toAttend} />
        <Stat label="Seguimientos hoy o vencidos" value={followLate} tone={followLate ? 'alert' : 'normal'} />
        <Stat label="Casos activos" value={cases.data?.length ?? 0} />
        <Stat label="Por cobrar" value={mxn(pend.reduce((s, p) => s + p.amount, 0))} tone={overdue.length ? 'alert' : 'normal'} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-baseline justify-between"><h2 className="text-xs font-bold uppercase tracking-widest text-silver-500">Términos y audiencias (7 días)</h2><Link to="/agenda" className="text-xs font-semibold text-navy-700 underline">Ver agenda</Link></div>
          {!urgent.length ? <p className="rounded-xl border border-dashed border-silver-200 bg-white p-4 text-sm text-silver-500">No tienes nada que venza en los próximos 7 días.</p> : (
            <ul className="divide-y divide-silver-200 rounded-xl border border-silver-200 bg-white">
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
          <div className="mb-2 flex items-baseline justify-between"><h2 className="text-xs font-bold uppercase tracking-widest text-silver-500">Pagos próximos</h2><Link to="/cobranza" className="text-xs font-semibold text-navy-700 underline">Ver cobranza</Link></div>
          {!pend.length ? <p className="rounded-xl border border-dashed border-silver-200 bg-white p-4 text-sm text-silver-500">No hay pagos pendientes.</p> : (
            <ul className="divide-y divide-silver-200 rounded-xl border border-silver-200 bg-white">
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

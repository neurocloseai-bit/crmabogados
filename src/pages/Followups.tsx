import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/useQuery'
import type { Deadline, Lead } from '../lib/types'
import { addDays, daysBetween, fdate, today, ymd } from '../lib/format'
import { Badge, Button, ErrorNote, PageHeader, Spinner } from '../components/ui'

const DOW = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function Followups() {
  const leads = useQuery<Lead[]>(() => supabase.from('leads').select('*').not('follow_up_date', 'is', null).not('stage', 'in', '(cliente,perdido)'), [])
  const dls = useQuery<Deadline[]>(() => supabase.from('deadlines').select('id,title,kind,due_date,due_time,done').eq('done', false), [])
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [showDl, setShowDl] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const t = today()

  const byDay = useMemo(() => {
    const m = new Map<string, { leads: Lead[]; dls: Deadline[] }>()
    const slot = (d: string) => { let v = m.get(d); if (!v) { v = { leads: [], dls: [] }; m.set(d, v) } return v }
    for (const l of leads.data ?? []) if (l.follow_up_date) slot(l.follow_up_date).leads.push(l)
    if (showDl) for (const d of dls.data ?? []) slot(d.due_date).dls.push(d)
    return m
  }, [leads.data, dls.data, showDl])

  if (leads.loading || dls.loading) return <Spinner />

  // Cuadrícula de lunes a domingo que cubre el mes
  const first = month
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
  const weeks = Math.ceil((offset + new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()) / 7)
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))

  const pending = (leads.data ?? []).filter((l) => l.follow_up_date)
  const overdue = pending.filter((l) => l.follow_up_date! < t).sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!))
  const todays = pending.filter((l) => l.follow_up_date === t)
  const week = pending.filter((l) => l.follow_up_date! > t && l.follow_up_date! <= addDays(t, 7))
  const title = month.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  const sel = selected ? byDay.get(selected) : null

  return (
    <>
      <PageHeader title="Seguimiento" subtitle="Todos los próximos contactos agendados con tus leads." />
      <ErrorNote message={leads.error ?? dls.error} />
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Vencidos" n={overdue.length} tone="red" />
        <Summary label="Para hoy" n={todays.length} tone="amber" />
        <Summary label="Próximos 7 días" n={week.length} tone="gray" />
      </div>

      {overdue.length > 0 && (
        <section aria-label="Seguimientos vencidos" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-red-800">Pendientes por atender</h2>
          <ul className="flex flex-wrap gap-2">
            {overdue.map((l) => (
              <li key={l.id}><Link to={`/leads/${l.id}`} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-red-100">
                {l.name} <span className="text-xs font-normal text-red-700">hace {Math.abs(daysBetween(t, l.follow_up_date!))} d</span></Link></li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" aria-label="Mes anterior" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() - 1, 1))}>‹</Button>
          <h2 className="min-w-44 text-center font-display text-xl capitalize tracking-wide text-navy-800">{title}</h2>
          <Button variant="ghost" aria-label="Mes siguiente" onClick={() => setMonth(new Date(first.getFullYear(), first.getMonth() + 1, 1))}>›</Button>
          <Button variant="ghost" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)) }}>Hoy</Button>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDl} onChange={(e) => setShowDl(e.target.checked)} /> Mostrar términos y audiencias</label>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px] overflow-hidden rounded-2xl border border-silver-200 bg-white shadow-card">
          <div className="grid grid-cols-7 border-b border-silver-200 bg-silver-100 text-center text-[11px] font-bold uppercase tracking-wider text-navy-800">
            {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c) => {
              const key = ymd(c)
              const inMonth = c.getMonth() === first.getMonth()
              const v = byDay.get(key)
              const items = [...(v?.leads ?? []).map((l) => ({ k: 'l' as const, id: l.id, label: l.name, to: `/leads/${l.id}` })), ...(v?.dls ?? []).map((d) => ({ k: 'd' as const, id: d.id, label: d.title, to: '/agenda' }))]
              const isToday = key === t
              return (
                <div key={key} onClick={() => setSelected(key)} className={`min-h-28 cursor-pointer border-b border-r border-silver-100 p-1.5 ${inMonth ? 'bg-white' : 'bg-silver-100/60'} ${selected === key ? 'outline outline-2 -outline-offset-2 outline-gold-400' : ''}`}>
                  <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? 'bg-gold-400 text-navy-950' : inMonth ? 'text-navy-900' : 'text-silver-500'}`}>{c.getDate()}</div>
                  <ul className="space-y-1">
                    {items.slice(0, 3).map((it) => (
                      <li key={it.k + it.id}>
                        <Link to={it.to} onClick={(e) => e.stopPropagation()} title={it.label}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-semibold ${it.k === 'd' ? 'bg-blue-100 text-blue-800' : key < t ? 'bg-red-100 text-red-800' : 'bg-navy-800 text-white'}`}>{it.label}</Link>
                      </li>
                    ))}
                    {items.length > 3 && <li className="px-1 text-[11px] font-semibold text-silver-500">+{items.length - 3} más</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-silver-500"><span className="mr-3"><Badge tone="gray">Azul oscuro</Badge> seguimiento de lead</span><span className="mr-3"><Badge tone="red">Rojo</Badge> vencido</span><Badge tone="blue">Azul claro</Badge> término o audiencia</p>

      {selected && (
        <section aria-label="Detalle del día" className="mt-4 rounded-2xl border border-silver-200 bg-white shadow-card p-4">
          <h2 className="mb-2 font-display text-lg capitalize text-navy-800">{fdate(selected, true)}</h2>
          {!sel || (!sel.leads.length && !sel.dls.length) ? <p className="text-sm text-silver-500">Nada agendado este día.</p> : (
            <ul className="space-y-2 text-sm">
              {sel.leads.map((l) => <li key={l.id}><Link to={`/leads/${l.id}`} className="font-semibold text-navy-800 hover:underline">{l.name}</Link> <span className="text-silver-500">· {l.case_type} {l.phone ? `· ${l.phone}` : ''}</span></li>)}
              {sel.dls.map((d) => <li key={d.id}><Link to="/agenda" className="font-semibold text-blue-800 hover:underline">{d.title}</Link> <span className="text-silver-500">· {d.kind}{d.due_time ? ` · ${d.due_time.slice(0, 5)}` : ''}</span></li>)}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function Summary({ label, n, tone }: { label: string; n: number; tone: 'red' | 'amber' | 'gray' }) {
  const c = { red: 'text-red-700', amber: 'text-amber-700', gray: 'text-navy-800' }[tone]
  return <div className="rounded-2xl border border-silver-200 bg-white shadow-card px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-wider text-silver-500">{label}</div><div className={`text-2xl font-bold tabular-nums ${c}`}>{n}</div></div>
}

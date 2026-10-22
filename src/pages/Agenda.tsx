import { useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { DEADLINE_KINDS, type CaseRow, type Deadline, type DeadlineKind, type Holiday } from '../lib/types'
import { addBusinessDays, daysBetween, fdate, today } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Stat, Textarea } from '../components/ui'
import { ConfirmDelete } from './Leads'

type Draft = { title: string; kind: DeadlineKind; case_id: string; court: string; file_number: string; due_date: string; due_time: string; notes: string }
const blank: Draft = { title: '', kind: 'termino', case_id: '', court: '', file_number: '', due_date: '', due_time: '', notes: '' }
type Filter = 'pendientes' | 'urgente' | 'hecho' | 'todas'

export default function Agenda() {
  const firmId = useFirmId()
  const items = useQuery<Deadline[]>(() => supabase.from('deadlines').select('*, cases(title, clients(full_name))').order('due_date').order('due_time', { nullsFirst: false }), [])
  const cases = useQuery<Pick<CaseRow, 'id' | 'title' | 'court' | 'file_number'>[]>(() => supabase.from('cases').select('id, title, court, file_number').neq('status', 'archivado').order('title'), [])
  const holidays = useQuery<Holiday[]>(() => supabase.from('holidays').select('*').order('day'), [])
  const [editing, setEditing] = useState<Deadline | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [msg, setMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('pendientes')
  const [from, setFrom] = useState('')
  const [days, setDays] = useState('')
  const [hint, setHint] = useState<{ ok: boolean; text: string } | null>(null)
  const [showHolidays, setShowHolidays] = useState(false)

  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.day)), [holidays.data])
  const t = today()
  const all = items.data ?? []
  const pend = all.filter((d) => !d.done)
  const venc = pend.filter((d) => d.due_date < t).length
  const hoy = pend.filter((d) => d.due_date === t).length
  const sem = pend.filter((d) => d.due_date > t && daysBetween(t, d.due_date) <= 7).length
  const list = all.filter((d) => filter === 'todas' || (filter === 'pendientes' && !d.done) || (filter === 'urgente' && !d.done && d.due_date <= t) || (filter === 'hecho' && d.done))
  if (filter === 'hecho') list.reverse()

  function open(d: Deadline | 'new') {
    setMsg(null); setHint(null); setFrom(''); setDays(''); setEditing(d)
    setDraft(d === 'new' ? blank : { title: d.title, kind: d.kind, case_id: d.case_id ?? '', court: d.court ?? '', file_number: d.file_number ?? '', due_date: d.due_date, due_time: d.due_time?.slice(0, 5) ?? '', notes: d.notes ?? '' })
  }
  function pickCase(id: string) {
    const c = cases.data?.find((x) => x.id === id)
    setDraft((d) => ({ ...d, case_id: id, court: c?.court ?? d.court, file_number: c?.file_number ?? d.file_number }))
  }
  function calc() {
    const n = Math.floor(Number(days) || 0)
    if (!from || n < 1) { setHint({ ok: false, text: 'Indica la fecha en que surte efectos la notificación y cuántos días hábiles tienes.' }); return }
    const r = addBusinessDays(from, n, holidaySet)
    setDraft((d) => ({ ...d, due_date: r }))
    setHint({ ok: true, text: `Vence el ${fdate(r, true)} (${n} días hábiles, sin fines de semana${holidaySet.size ? ` ni tus ${holidaySet.size} días inhábiles` : ''}). Confírmalo en el código aplicable.` })
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    const row = { title: draft.title.trim(), kind: draft.kind, case_id: draft.case_id || null, court: draft.court.trim() || null, file_number: draft.file_number.trim() || null, due_date: draft.due_date, due_time: draft.due_time || null, notes: draft.notes.trim() || null }
    const res = editing === 'new' ? await supabase.from('deadlines').insert({ ...row, firm_id: firmId }) : await supabase.from('deadlines').update(row).eq('id', (editing as Deadline).id)
    if (res.error) { setMsg(res.error.message); return }
    setEditing(null); void items.reload()
  }
  async function toggle(d: Deadline) {
    const { error } = await supabase.from('deadlines').update({ done: !d.done, done_at: d.done ? null : new Date().toISOString() }).eq('id', d.id)
    if (error) setMsg(error.message); else void items.reload()
  }
  async function remove() {
    if (!editing || editing === 'new') return
    const { error } = await supabase.from('deadlines').delete().eq('id', editing.id)
    if (error) { setMsg(error.message); return }
    setEditing(null); void items.reload()
  }

  if (items.loading) return <Spinner />
  let last = ''
  return (
    <>
      <PageHeader title="Agenda" subtitle="Términos, audiencias y citas con su cómputo de días hábiles." action={<div className="flex gap-2"><Button variant="ghost" onClick={() => setShowHolidays(true)}>Días inhábiles ({holidaySet.size})</Button><Button variant="gold" onClick={() => open('new')}>+ Nuevo término</Button></div>} />
      <ErrorNote message={items.error ?? msg} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Vencidos" value={venc} tone={venc ? 'alert' : 'normal'} /><Stat label="Para hoy" value={hoy} /><Stat label="Próximos 7 días" value={sem} /><Stat label="Cumplidos" value={all.length - pend.length} />
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filtrar agenda">
        {([['pendientes', 'Pendientes'], ['urgente', 'Hoy y vencidos'], ['hecho', 'Cumplidos'], ['todas', 'Todas']] as [Filter, string][]).map(([id, label]) => (
          <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${filter === id ? 'border-navy-800 bg-navy-800 text-white' : 'border-silver-200 bg-white'}`}>{label}</button>
        ))}
      </div>
      {!all.length ? <Empty title="Tu agenda está vacía">Agrega un término con “Nuevo término”: qué vence, en qué juzgado y el expediente. Puedes calcular la fecha con los días hábiles.</Empty> : !list.length ? <Empty title="Nada en esta vista">Cambia el filtro.</Empty> : (
        <div className="flex flex-col gap-2">
          {list.map((d) => {
            const head = d.due_date !== last ? <h2 className="mt-3 text-xs font-bold uppercase tracking-widest text-silver-500">{fdate(d.due_date, true)}{d.due_date === t ? ' · hoy' : ''}</h2> : null
            last = d.due_date
            const diff = daysBetween(t, d.due_date)
            const tag = d.done ? <Badge tone="green">Cumplido</Badge> : diff < 0 ? <Badge tone="red">Vencido hace {-diff} d</Badge> : diff === 0 ? <Badge tone="amber">Vence hoy</Badge> : <Badge tone={diff <= 3 ? 'amber' : 'gray'}>En {diff} d</Badge>
            const meta = [d.cases?.title, d.cases?.clients?.full_name, d.court, d.file_number ? `Exp. ${d.file_number}` : ''].filter(Boolean).join(' · ')
            return (
              <div key={d.id}>
                {head}
                <article className={`mt-1 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-silver-200 bg-white shadow-card p-3 ${d.done ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <div className={`text-sm font-bold break-words ${d.done ? 'line-through' : ''}`}>{d.title}</div>
                    <div className="text-xs text-silver-500 break-words">{DEADLINE_KINDS.find((k) => k.id === d.kind)?.label}{d.due_time ? ` · ${d.due_time.slice(0, 5)}` : ''}{meta ? ` · ${meta}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">{tag}
                    <button type="button" onClick={() => void toggle(d)} className="rounded-md border border-silver-200 px-2 py-1 text-xs font-semibold">{d.done ? 'Reabrir' : 'Cumplido'}</button>
                    <button type="button" onClick={() => open(d)} className="rounded-md border border-silver-200 px-2 py-1 text-xs font-semibold">Editar</button>
                  </div>
                </article>
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <Modal wide title={editing === 'new' ? 'Nuevo término' : 'Editar término'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ErrorNote message={msg} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Qué vence o se agenda" className="sm:col-span-2"><Input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. Contestación de demanda" /></Field>
              <Field label="Tipo"><Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as DeadlineKind })}>{DEADLINE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
              <Field label="Expediente"><Select value={draft.case_id} onChange={(e) => pickCase(e.target.value)}><option value="">Sin expediente</option>{cases.data?.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
              <Field label="Juzgado"><Input value={draft.court} onChange={(e) => setDraft({ ...draft, court: e.target.value })} /></Field>
              <Field label="Número de expediente"><Input value={draft.file_number} onChange={(e) => setDraft({ ...draft, file_number: e.target.value })} /></Field>
              <div className="grid gap-2 rounded-lg bg-gold-300/30 p-3 sm:col-span-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
                <Field label="Fecha en que surte efectos la notificación"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="Días hábiles"><Input type="number" min={1} max={400} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
                <Button variant="ghost" onClick={calc}>Calcular</Button>
                <p className={`text-xs sm:col-span-3 ${hint?.ok ? 'font-semibold text-emerald-800' : 'text-silver-500'}`}>{hint?.text ?? 'Cuenta desde el día hábil siguiente, sin sábados, domingos ni tus días inhábiles. Confirma el cómputo en el código aplicable.'}</p>
              </div>
              <Field label="Fecha límite o de la cita"><Input required type="date" value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} /></Field>
              <Field label="Hora"><Input type="time" value={draft.due_time} onChange={(e) => setDraft({ ...draft, due_time: e.target.value })} /></Field>
              <Field label="Notas" className="sm:col-span-2"><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              {editing !== 'new' ? <ConfirmDelete onConfirm={() => void remove()} /> : <span />}
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
            </div>
          </form>
        </Modal>
      )}
      {showHolidays && <HolidaysModal rows={holidays.data ?? []} firmId={firmId} onClose={() => setShowHolidays(false)} onChange={() => void holidays.reload()} />}
    </>
  )
}

function HolidaysModal({ rows, firmId, onClose, onChange }: { rows: Holiday[]; firmId: string; onClose: () => void; onChange: () => void }) {
  const [day, setDay] = useState('')
  const [label, setLabel] = useState('')
  const [err, setErr] = useState<string | null>(null)
  async function add(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('holidays').insert({ firm_id: firmId, day, label: label.trim() || null })
    if (error) { setErr(/duplicate/i.test(error.message) ? 'Esa fecha ya está registrada.' : error.message); return }
    setErr(null); setDay(''); setLabel(''); onChange()
  }
  async function del(id: string) {
    const { error } = await supabase.from('holidays').delete().eq('id', id)
    if (error) setErr(error.message); else onChange()
  }
  return (
    <Modal title="Días inhábiles" onClose={onClose}>
      <p className="mb-3 text-sm text-silver-500">Feriados, vacaciones y suspensiones del juzgado. El cálculo de términos los salta además de sábados y domingos.</p>
      <ErrorNote message={err} />
      <form onSubmit={add} className="mb-4 grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
        <Field label="Fecha"><Input required type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label="Motivo"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Día de muertos" /></Field>
        <Button type="submit">Agregar</Button>
      </form>
      <ul className="max-h-72 divide-y divide-silver-200 overflow-y-auto rounded-lg border border-silver-200">
        {rows.length === 0 && <li className="p-3 text-sm text-silver-500">Aún no registras días inhábiles.</li>}
        {rows.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 p-2.5 text-sm">
            <span><b>{fdate(h.day, true)}</b>{h.label ? ` · ${h.label}` : ''}</span>
            <button type="button" onClick={() => void del(h.id)} className="text-xs font-semibold text-red-700 underline">Quitar</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-right"><Button variant="ghost" onClick={onClose}>Cerrar</Button></div>
    </Modal>
  )
}

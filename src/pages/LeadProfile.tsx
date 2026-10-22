import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { ACTIVITY_KINDS, STAGES, type ActivityKind, type Lead, type LeadActivity, type Stage } from '../lib/types'
import { addDays, daysBetween, fdate, mxn, today, waLink } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { ConfirmDelete } from './Leads'

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function LeadProfile() {
  const { id } = useParams()
  const nav = useNavigate()
  const firmId = useFirmId()
  const lead = useQuery<Lead>(() => supabase.from('leads').select('*').eq('id', id ?? '').maybeSingle(), [id])
  const acts = useQuery<LeadActivity[]>(() => supabase.from('lead_activities').select('*').eq('lead_id', id ?? '').order('occurred_at', { ascending: false }), [id])
  const [kind, setKind] = useState<ActivityKind>('llamada')
  const [note, setNote] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (lead.loading || acts.loading) return <Spinner />
  const l = lead.data
  if (!l) return <Empty title="No encontramos este lead"><Link to="/leads" className="underline">Volver a Leads</Link></Empty>
  const t = today()
  const wa = waLink(l.phone)
  const overdue = l.follow_up_date && l.follow_up_date < t
  const list = acts.data ?? []

  async function setFollowUp(date: string | null) {
    const { error } = await supabase.from('leads').update({ follow_up_date: date }).eq('id', l!.id)
    if (error) setMsg(error.message); else void lead.reload()
  }
  async function log(e: FormEvent) {
    e.preventDefault()
    if (!note.trim() && kind === 'nota') { setMsg('Escribe la nota.'); return }
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('lead_activities').insert({ firm_id: firmId, lead_id: l!.id, kind, note: note.trim() || null })
    if (error) { setBusy(false); setMsg(error.message); return }
    // Registrar un contacto cierra el seguimiento pendiente; si se fijó una nueva fecha, queda esa.
    const { error: e2 } = await supabase.from('leads').update({ follow_up_date: next || null }).eq('id', l!.id)
    setBusy(false)
    if (e2) { setMsg(e2.message); return }
    setNote(''); setNext(''); void acts.reload(); void lead.reload()
  }
  async function removeActivity(aid: string) {
    const { error } = await supabase.from('lead_activities').delete().eq('id', aid)
    if (error) setMsg(error.message); else void acts.reload()
  }
  async function changeStage(stage: Stage) {
    const { error } = await supabase.from('leads').update({ stage }).eq('id', l!.id)
    if (error) setMsg(error.message); else void lead.reload()
  }
  async function removeLead() {
    const { error } = await supabase.from('leads').delete().eq('id', l!.id)
    if (error) setMsg(error.message); else nav('/leads')
  }

  return (
    <>
      <p className="mb-2 text-sm"><Link to="/leads" className="text-silver-500 hover:underline">← Leads</Link> · <Link to="/seguimiento" className="text-silver-500 hover:underline">Calendario de seguimiento</Link></p>
      <PageHeader title={l.name} subtitle={[l.case_type, l.source].filter(Boolean).join(' · ')} action={wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Abrir WhatsApp</a> : undefined} />
      <ErrorNote message={lead.error ?? acts.error ?? msg} />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-silver-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-silver-500">Datos</h2>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-silver-500">Teléfono</dt><dd>{l.phone || '—'}</dd></div>
              <div><dt className="text-xs text-silver-500">Cotizado</dt><dd>{l.quoted > 0 ? mxn(l.quoted) : '—'}</dd></div>
              <div><dt className="text-xs text-silver-500">Alta</dt><dd>{fdate(l.created_at.slice(0, 10), true)}</dd></div>
              {l.notes && <div><dt className="text-xs text-silver-500">Notas generales</dt><dd className="whitespace-pre-wrap">{l.notes}</dd></div>}
            </dl>
            <Field label="Etapa" className="mt-3">
              <Select value={l.stage} onChange={(e) => void changeStage(e.target.value as Stage)}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
            </Field>
          </section>

          <section className="rounded-xl border border-silver-200 bg-white p-4">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-silver-500">Próximo seguimiento</h2>
            {l.follow_up_date
              ? <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">{fdate(l.follow_up_date, true)} {overdue ? <Badge tone="red">Vencido {Math.abs(daysBetween(t, l.follow_up_date))} d</Badge> : l.follow_up_date === t ? <Badge tone="amber">Hoy</Badge> : null}</p>
              : <p className="mb-2 text-sm text-silver-500">Sin fecha agendada.</p>}
            <Input type="date" aria-label="Fecha de seguimiento" value={l.follow_up_date ?? ''} onChange={(e) => void setFollowUp(e.target.value || null)} />
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {[['Mañana', 1], ['En 3 días', 3], ['En 1 semana', 7]].map(([label, n]) => (
                <button key={label as string} type="button" onClick={() => void setFollowUp(addDays(t, n as number))} className="rounded-md border border-silver-200 px-2 py-1 font-semibold hover:bg-silver-100">{label}</button>
              ))}
              {l.follow_up_date && <button type="button" onClick={() => void setFollowUp(null)} className="rounded-md border border-silver-200 px-2 py-1 font-semibold text-silver-500 hover:bg-silver-100">Quitar</button>}
            </div>
          </section>
          <ConfirmDelete label="Eliminar lead" onConfirm={() => void removeLead()} />
        </aside>

        <div className="space-y-4">
          <form onSubmit={log} className="rounded-xl border border-silver-200 bg-white p-4">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-silver-500">Registrar seguimiento</h2>
            <div role="radiogroup" aria-label="Tipo de interacción" className="mb-3 flex flex-wrap gap-2">
              {ACTIVITY_KINDS.map((k) => (
                <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${kind === k.id ? 'border-navy-800 bg-navy-800 text-white' : 'border-silver-200 bg-white hover:bg-silver-100'}`}>{k.icon} {k.label}</button>
              ))}
            </div>
            <Textarea aria-label="Nota" placeholder={kind === 'nota' ? 'Escribe la nota…' : 'Qué se habló, qué quedó pendiente…'} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
              <Field label="Próximo contacto (opcional)"><Input type="date" min={t} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
              <Button type="submit" variant="gold" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
            </div>
            <p className="mt-2 text-xs text-silver-500">Al guardar, el seguimiento pendiente se cierra y queda la fecha que pongas arriba (o ninguna).</p>
          </form>

          <section aria-label="Historial">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-silver-500">Historial ({list.length})</h2>
            {!list.length ? <Empty title="Aún no hay seguimiento">Registra la primera llamada, mensaje o nota arriba.</Empty> : (
              <ol className="space-y-2">
                {list.map((a) => {
                  const k = ACTIVITY_KINDS.find((x) => x.id === a.kind)
                  return (
                    <li key={a.id} className="rounded-xl border border-silver-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2 text-xs text-silver-500">
                        <span className="font-bold text-navy-800">{k?.icon} {k?.label}</span>
                        <span className="flex items-center gap-3">{when(a.occurred_at)}
                          <button type="button" aria-label="Eliminar registro" onClick={() => { if (confirm('¿Eliminar este registro?')) void removeActivity(a.id) }} className="text-silver-500 hover:text-red-700">✕</button>
                        </span>
                      </div>
                      {a.note && <p className="mt-1 whitespace-pre-wrap text-sm">{a.note}</p>}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

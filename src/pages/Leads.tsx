import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { CASE_TYPES, SOURCES, STAGES, type Lead, type Stage } from '../lib/types'
import { daysBetween, fdate, mxn, today, waLink } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui'

type Draft = { name: string; phone: string; source: string; case_type: string; stage: Stage; quoted: string; follow_up_date: string; notes: string }
const blank: Draft = { name: '', phone: '', source: SOURCES[0], case_type: CASE_TYPES[0], stage: 'nuevo', quoted: '', follow_up_date: '', notes: '' }

export default function Leads() {
  const firmId = useFirmId()
  const { data, loading, error, reload } = useQuery<Lead[]>(() => supabase.from('leads').select('*').order('created_at', { ascending: false }), [])
  const [editing, setEditing] = useState<Lead | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)

  const leads = (data ?? []).filter((l) => !q.trim() || [l.name, l.phone, l.case_type, l.notes].join(' ').toLowerCase().includes(q.trim().toLowerCase()))

  function open(l: Lead | 'new') {
    setMsg(null); setEditing(l)
    setDraft(l === 'new' ? blank : { name: l.name, phone: l.phone ?? '', source: l.source ?? SOURCES[0], case_type: l.case_type ?? CASE_TYPES[0], stage: l.stage, quoted: l.quoted ? String(l.quoted) : '', follow_up_date: l.follow_up_date ?? '', notes: l.notes ?? '' })
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    const row = { name: draft.name.trim(), phone: draft.phone.trim() || null, source: draft.source, case_type: draft.case_type, stage: draft.stage, quoted: Math.max(0, Number(draft.quoted) || 0), follow_up_date: draft.follow_up_date || null, notes: draft.notes.trim() || null }
    const res = editing === 'new' ? await supabase.from('leads').insert({ ...row, firm_id: firmId }) : await supabase.from('leads').update(row).eq('id', (editing as Lead).id)
    if (res.error) { setMsg(res.error.message); return }
    setEditing(null); void reload()
  }
  async function move(id: string, stage: Stage) {
    const { error } = await supabase.from('leads').update({ stage }).eq('id', id)
    if (error) setMsg(error.message); else void reload()
  }
  async function remove() {
    if (editing === 'new' || !editing) return
    const { error } = await supabase.from('leads').delete().eq('id', editing.id)
    if (error) { setMsg(error.message); return }
    setEditing(null); void reload()
  }
  async function makeClient(l: Lead) {
    const { error: e1 } = await supabase.from('clients').insert({ firm_id: firmId, lead_id: l.id, full_name: l.name, phone: l.phone })
    if (e1) { setMsg(e1.message); return }
    await move(l.id, 'cliente')
    setMsg(`${l.name} ya está en Clientes. Abre Expedientes para crear su caso.`)
  }

  if (loading) return <Spinner />
  const t = today()
  return (
    <>
      <PageHeader title="Leads" subtitle="Arrastra las tarjetas entre etapas o cámbialas con el selector." action={<Button variant="gold" onClick={() => open('new')}>+ Nuevo lead</Button>} />
      <ErrorNote message={error ?? msg} />
      <Input type="search" placeholder="Buscar por nombre, teléfono, tipo o nota" aria-label="Buscar leads" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md" />
      {!data?.length ? <Empty title="Aún no hay leads">Agrega el primero con “Nuevo lead”: nombre, WhatsApp, tipo de caso y cuándo le das seguimiento.</Empty> : (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
          {STAGES.map((s) => {
            const items = leads.filter((l) => l.stage === s.id)
            return (
              <section key={s.id} aria-label={s.label} className="w-72 flex-none rounded-xl bg-silver-100 p-2"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragId) void move(dragId, s.id); setDragId(null) }}>
                <h2 className="mb-2 flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-navy-800">{s.label}<span className="rounded-full bg-white px-2 py-0.5 tabular-nums">{items.length}</span></h2>
                <div className="flex min-h-12 flex-col gap-2">
                  {items.map((l) => {
                    const wa = waLink(l.phone)
                    const late = l.follow_up_date && s.id !== 'cliente' && s.id !== 'perdido' && l.follow_up_date <= t
                    return (
                      <article key={l.id} draggable onDragStart={() => setDragId(l.id)} className="cursor-grab rounded-lg border border-silver-200 bg-white p-3 active:cursor-grabbing">
                        <Link to={`/leads/${l.id}`} className="text-sm font-bold break-words text-navy-800 hover:underline">{l.name}</Link>
                        <div className="text-xs text-silver-500">{l.case_type}{l.phone ? ` · ${l.phone}` : ''}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {l.follow_up_date && (late ? <Badge tone="red">{l.follow_up_date < t ? `Vencido ${Math.abs(daysBetween(t, l.follow_up_date))} d` : 'Hoy'}</Badge> : <Badge>{fdate(l.follow_up_date)}</Badge>)}
                          {l.quoted > 0 && <Badge tone="blue">{mxn(l.quoted)}</Badge>}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Select aria-label={`Etapa de ${l.name}`} value={l.stage} onChange={(e) => void move(l.id, e.target.value as Stage)} className="!py-1 text-xs">
                            {STAGES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </Select>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">WhatsApp</a>}
                          <Link to={`/leads/${l.id}`} className="rounded-md bg-navy-800 px-2 py-1 font-semibold text-white">Seguimiento</Link>
                          <button type="button" onClick={() => open(l)} className="rounded-md border border-silver-200 px-2 py-1 font-semibold">Editar</button>
                          {l.stage !== 'cliente' && l.stage !== 'perdido' && <button type="button" onClick={() => void makeClient(l)} className="rounded-md border border-silver-200 px-2 py-1 font-semibold">Hacer cliente</button>}
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'Nuevo lead' : 'Editar lead'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ErrorNote message={msg} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" className="sm:col-span-2"><Input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="686 000 0000" /></Field>
              <Field label="Origen"><Select value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Tipo de caso"><Select value={draft.case_type} onChange={(e) => setDraft({ ...draft, case_type: e.target.value })}>{CASE_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Etapa"><Select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as Stage })}>{STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
              <Field label="Honorarios cotizados (MXN)"><Input type="number" min={0} step={100} inputMode="numeric" value={draft.quoted} onChange={(e) => setDraft({ ...draft, quoted: e.target.value })} /></Field>
              <Field label="Próximo seguimiento"><Input type="date" value={draft.follow_up_date} onChange={(e) => setDraft({ ...draft, follow_up_date: e.target.value })} /></Field>
              <Field label="Notas" className="sm:col-span-2"><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              {editing !== 'new' ? <ConfirmDelete onConfirm={() => void remove()} /> : <span />}
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

export function ConfirmDelete({ onConfirm, label = 'Eliminar' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false)
  return <Button variant="danger" onClick={() => (armed ? onConfirm() : setArmed(true))}>{armed ? '¿Seguro? Toca otra vez' : label}</Button>
}

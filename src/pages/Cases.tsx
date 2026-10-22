import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { CASE_STATUS, CASE_TYPES, type CaseRow, type CaseStatus, type Client, type Payment } from '../lib/types'
import { mxn } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { ConfirmDelete } from './Leads'

type Draft = { client_id: string; title: string; case_type: string; court: string; file_number: string; counterpart: string; status: CaseStatus; opened_on: string; fees: string; notes: string }
const blank: Draft = { client_id: '', title: '', case_type: CASE_TYPES[0], court: '', file_number: '', counterpart: '', status: 'activo', opened_on: '', fees: '', notes: '' }

export default function Cases() {
  const firmId = useFirmId()
  const cases = useQuery<CaseRow[]>(() => supabase.from('cases').select('*, clients(full_name)').order('created_at', { ascending: false }), [])
  const clients = useQuery<Pick<Client, 'id' | 'full_name'>[]>(() => supabase.from('clients').select('id, full_name').order('full_name'), [])
  const pays = useQuery<Pick<Payment, 'case_id' | 'amount' | 'paid_on'>[]>(() => supabase.from('payments').select('case_id, amount, paid_on'), [])
  const [editing, setEditing] = useState<CaseRow | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [msg, setMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<CaseStatus | 'todos'>('activo')
  const [q, setQ] = useState('')

  const paidFor = (id: string) => (pays.data ?? []).filter((p) => p.case_id === id && p.paid_on).reduce((s, p) => s + p.amount, 0)
  const list = (cases.data ?? []).filter((c) => (filter === 'todos' || c.status === filter) &&
    (!q.trim() || [c.title, c.file_number, c.court, c.clients?.full_name, c.counterpart].join(' ').toLowerCase().includes(q.trim().toLowerCase())))

  function open(c: CaseRow | 'new') {
    setMsg(null); setEditing(c)
    setDraft(c === 'new' ? { ...blank, client_id: clients.data?.[0]?.id ?? '' } : { client_id: c.client_id, title: c.title, case_type: c.case_type ?? CASE_TYPES[0], court: c.court ?? '', file_number: c.file_number ?? '', counterpart: c.counterpart ?? '', status: c.status, opened_on: c.opened_on ?? '', fees: c.fees ? String(c.fees) : '', notes: c.notes ?? '' })
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!draft.client_id) { setMsg('Elige un cliente. Si no existe, créalo primero en Clientes.'); return }
    const row = { client_id: draft.client_id, title: draft.title.trim(), case_type: draft.case_type, court: draft.court.trim() || null, file_number: draft.file_number.trim() || null, counterpart: draft.counterpart.trim() || null, status: draft.status, opened_on: draft.opened_on || null, fees: Math.max(0, Number(draft.fees) || 0), notes: draft.notes.trim() || null }
    const res = editing === 'new' ? await supabase.from('cases').insert({ ...row, firm_id: firmId }) : await supabase.from('cases').update(row).eq('id', (editing as CaseRow).id)
    if (res.error) { setMsg(res.error.message); return }
    setEditing(null); void cases.reload()
  }
  async function remove() {
    if (!editing || editing === 'new') return
    const { error } = await supabase.from('cases').delete().eq('id', editing.id)
    if (error) { setMsg(error.message); return }
    setEditing(null); void cases.reload(); void pays.reload()
  }

  if (cases.loading || clients.loading) return <Spinner />
  return (
    <>
      <PageHeader title="Expedientes" subtitle="Cada caso con su juzgado, número de expediente y saldo." action={<Button variant="gold" onClick={() => open('new')}>+ Nuevo expediente</Button>} />
      <ErrorNote message={cases.error ?? clients.error} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="search" placeholder="Buscar por caso, cliente, juzgado o expediente" aria-label="Buscar expedientes" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        <Select aria-label="Estado" value={filter} onChange={(e) => setFilter(e.target.value as CaseStatus | 'todos')} className="max-w-44">
          <option value="todos">Todos</option>{CASE_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </Select>
      </div>
      {!cases.data?.length ? <Empty title="Aún no hay expedientes">{clients.data?.length ? 'Crea el primero con “Nuevo expediente”.' : 'Primero agrega un cliente y luego crea su expediente.'}</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const paid = paidFor(c.id); const saldo = Math.max(0, c.fees - paid); const pct = c.fees > 0 ? Math.min(100, Math.round((paid / c.fees) * 100)) : 0
            return (
              <article key={c.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-silver-200 bg-white shadow-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-bold break-words">{c.title}</div><div className="text-sm text-silver-500 break-words">{c.clients?.full_name}</div></div>
                  <Badge tone={c.status === 'activo' ? 'green' : c.status === 'suspendido' ? 'amber' : 'gray'}>{CASE_STATUS.find((s) => s.id === c.status)?.label}</Badge>
                </div>
                <div className="text-xs text-silver-500 break-words">{[c.case_type, c.court, c.file_number ? `Exp. ${c.file_number}` : ''].filter(Boolean).join(' · ')}</div>
                {c.fees > 0 && (
                  <div>
                    <div className="text-xs tabular-nums text-silver-500">Honorarios <b className="text-navy-900">{mxn(c.fees)}</b> · Pagado <b className="text-navy-900">{mxn(paid)}</b> · Saldo <b className="text-navy-900">{mxn(saldo)}</b></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded bg-silver-200" aria-hidden="true"><div className="h-full bg-gold-400" style={{ width: `${pct}%` }} /></div>
                  </div>
                )}
                <div className="mt-auto pt-1"><button type="button" onClick={() => open(c)} className="rounded-md border border-silver-200 px-2 py-1 text-xs font-semibold">Editar</button></div>
              </article>
            )
          })}
        </div>
      )}
      {editing && (
        <Modal wide title={editing === 'new' ? 'Nuevo expediente' : 'Editar expediente'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ErrorNote message={msg} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Cliente"><Select required value={draft.client_id} onChange={(e) => setDraft({ ...draft, client_id: e.target.value })}>
                <option value="">Elige un cliente</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</Select></Field>
              <Field label="Tipo de caso"><Select value={draft.case_type} onChange={(e) => setDraft({ ...draft, case_type: e.target.value })}>{CASE_TYPES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Nombre del caso" className="sm:col-span-2"><Input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ej. Divorcio López vs. Pérez" /></Field>
              <Field label="Juzgado"><Input value={draft.court} onChange={(e) => setDraft({ ...draft, court: e.target.value })} /></Field>
              <Field label="Número de expediente"><Input value={draft.file_number} onChange={(e) => setDraft({ ...draft, file_number: e.target.value })} /></Field>
              <Field label="Contraparte"><Input value={draft.counterpart} onChange={(e) => setDraft({ ...draft, counterpart: e.target.value })} /></Field>
              <Field label="Estado"><Select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CaseStatus })}>{CASE_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>
              <Field label="Fecha de apertura"><Input type="date" value={draft.opened_on} onChange={(e) => setDraft({ ...draft, opened_on: e.target.value })} /></Field>
              <Field label="Honorarios pactados (MXN)"><Input type="number" min={0} step={100} inputMode="numeric" value={draft.fees} onChange={(e) => setDraft({ ...draft, fees: e.target.value })} /></Field>
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

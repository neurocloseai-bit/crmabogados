import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import type { CaseRow, Client } from '../lib/types'
import { waLink } from '../lib/format'
import { Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Spinner, Textarea } from '../components/ui'
import { ConfirmDelete } from './Leads'

type Draft = { full_name: string; phone: string; email: string; address: string; notes: string }
const blank: Draft = { full_name: '', phone: '', email: '', address: '', notes: '' }

export default function Clients() {
  const firmId = useFirmId()
  const clients = useQuery<Client[]>(() => supabase.from('clients').select('*').order('full_name'), [])
  const cases = useQuery<Pick<CaseRow, 'id' | 'client_id' | 'status'>[]>(() => supabase.from('cases').select('id, client_id, status'), [])
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const list = (clients.data ?? []).filter((c) => !q.trim() || [c.full_name, c.phone, c.email].join(' ').toLowerCase().includes(q.trim().toLowerCase()))
  const countFor = (id: string) => (cases.data ?? []).filter((c) => c.client_id === id && c.status === 'activo').length

  function open(c: Client | 'new') {
    setMsg(null); setEditing(c)
    setDraft(c === 'new' ? blank : { full_name: c.full_name, phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '', notes: c.notes ?? '' })
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    const row = { full_name: draft.full_name.trim(), phone: draft.phone.trim() || null, email: draft.email.trim() || null, address: draft.address.trim() || null, notes: draft.notes.trim() || null }
    const res = editing === 'new' ? await supabase.from('clients').insert({ ...row, firm_id: firmId }) : await supabase.from('clients').update(row).eq('id', (editing as Client).id)
    if (res.error) { setMsg(res.error.message); return }
    setEditing(null); void clients.reload()
  }
  async function remove() {
    if (!editing || editing === 'new') return
    const { error } = await supabase.from('clients').delete().eq('id', editing.id)
    if (error) { setMsg(error.message); return }
    setEditing(null); void clients.reload(); void cases.reload()
  }

  if (clients.loading) return <Spinner />
  return (
    <>
      <PageHeader title="Clientes" subtitle="Personas que ya contrataron o van a contratar. Sus casos viven en Expedientes." action={<Button variant="gold" onClick={() => open('new')}>+ Nuevo cliente</Button>} />
      <ErrorNote message={clients.error} />
      <Input type="search" placeholder="Buscar por nombre, teléfono o correo" aria-label="Buscar clientes" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-md" />
      {!clients.data?.length ? <Empty title="Todavía no hay clientes">Agrégalos aquí o convierte un lead con “Hacer cliente”.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => {
            const wa = waLink(c.phone); const n = countFor(c.id)
            return (
              <article key={c.id} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-silver-200 bg-white shadow-card p-4">
                <div className="font-bold break-words">{c.full_name}</div>
                <div className="text-sm text-silver-500 break-words">{[c.phone, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</div>
                <div className="text-xs font-semibold text-navy-700">{n} {n === 1 ? 'caso activo' : 'casos activos'}</div>
                <div className="mt-auto flex gap-2 pt-1 text-xs">
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-md bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">WhatsApp</a>}
                  <button type="button" onClick={() => open(c)} className="rounded-md border border-silver-200 px-2 py-1 font-semibold">Editar</button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {editing && (
        <Modal title={editing === 'new' ? 'Nuevo cliente' : 'Editar cliente'} onClose={() => setEditing(null)}>
          <form onSubmit={save}>
            <ErrorNote message={msg} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre completo" className="sm:col-span-2"><Input required value={draft.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input inputMode="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} /></Field>
              <Field label="Correo"><Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} /></Field>
              <Field label="Domicilio" className="sm:col-span-2"><Input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Field>
              <Field label="Notas" className="sm:col-span-2"><Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              {editing !== 'new' ? <ConfirmDelete onConfirm={() => void remove()} /> : <span />}
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit">Guardar</Button></div>
            </div>
            {editing !== 'new' && <p className="mt-3 text-xs text-silver-500">Al eliminar un cliente también se eliminan sus expedientes, pagos y términos.</p>}
          </form>
        </Modal>
      )}
    </>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { DOC_CATEGORIES, MILESTONE_STATUS, MILESTONE_TEMPLATES, type CaseRow, type CaseUpdate, type DocRow, type Milestone, type MilestoneStatus } from '../lib/types'
import { fdate, fileSize, today } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { ConfirmDelete } from './Leads'
import { UploadModal } from './Documents'
import { InviteClient } from '../components/InviteClient'

type CaseFull = CaseRow & { clients: { id: string; full_name: string; phone: string | null } | null }
const BUCKET = 'firm-documents'
const card = 'mb-5 rounded-2xl border border-silver-200 bg-white p-4 shadow-card'

export default function CaseDetail() {
  const { id = '' } = useParams()
  const firmId = useFirmId()
  const kase = useQuery<CaseFull[]>(() => supabase.from('cases').select('*, clients(id, full_name, phone)').eq('id', id), [id])
  const miles = useQuery<Milestone[]>(() => supabase.from('case_milestones').select('*').eq('case_id', id).order('position'), [id])
  const updates = useQuery<CaseUpdate[]>(() => supabase.from('case_updates').select('*').eq('case_id', id).order('created_at', { ascending: false }), [id])
  const docs = useQuery<DocRow[]>(() => supabase.from('documents').select('*').eq('case_id', id).order('created_at', { ascending: false }), [id])
  const allCases = useQuery<Pick<CaseRow, 'id' | 'title'>[]>(() => supabase.from('cases').select('id, title').order('title'), [])
  const [msg, setMsg] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)

  const c = kase.data?.[0]
  if (kase.loading || miles.loading) return <Spinner />
  if (!c) return <Empty title="No encontramos este expediente"><Link to="/expedientes" className="font-semibold text-navy-700 underline">Volver a expedientes</Link></Empty>

  return (
    <>
      <Link to="/expedientes" className="mb-3 inline-block text-sm font-semibold text-navy-700 hover:underline">← Expedientes</Link>
      <PageHeader title={c.title} subtitle={[c.clients?.full_name, c.case_type, c.court, c.file_number ? `Exp. ${c.file_number}` : ''].filter(Boolean).join(' · ')} />
      <ErrorNote message={msg ?? kase.error ?? miles.error ?? updates.error ?? docs.error} />
      {c.clients && <div className="mb-5"><InviteClient clientId={c.clients.id} name={c.clients.full_name} phone={c.clients.phone} /></div>}
      <ClientView c={c} onSaved={() => void kase.reload()} setMsg={setMsg} />
      <Stages caseId={c.id} caseType={c.case_type} firmId={firmId} rows={miles.data ?? []} reload={() => void miles.reload()} setMsg={setMsg} />
      <Updates caseId={c.id} firmId={firmId} rows={updates.data ?? []} reload={() => void updates.reload()} setMsg={setMsg} />
      <section aria-label="Escritos" className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg text-navy-800">Escritos del expediente</h2>
          <Button variant="gold" onClick={() => setUpload(true)} className="!py-1.5 text-xs">+ Subir escrito</Button>
        </div>
        <p className="mb-3 text-xs text-silver-500">Solo verá tu cliente los marcados como “Visible”. Tus notas internas nunca se muestran.</p>
        {!docs.data?.length ? <p className="text-sm text-silver-500">Aún no hay documentos en este expediente.</p> : (
          <ul className="flex flex-col divide-y divide-silver-200">
            {docs.data.map((d) => <DocRowItem key={d.id} d={d} reload={() => void docs.reload()} setMsg={setMsg} />)}
          </ul>
        )}
      </section>
      {upload && <UploadModal firmId={firmId} cases={allCases.data ?? [{ id: c.id, title: c.title }]} defaultCaseId={c.id} defaultCategory="escrito" onClose={() => setUpload(false)} onDone={() => { setUpload(false); void docs.reload() }} />}
    </>
  )
}

function ClientView({ c, onSaved, setMsg }: { c: CaseFull; onSaved: () => void; setMsg: (m: string | null) => void }) {
  const [summary, setSummary] = useState(c.client_summary ?? '')
  const [step, setStep] = useState(c.client_next_step ?? '')
  const [date, setDate] = useState(c.client_next_step_date ?? '')
  const [saved, setSaved] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault(); setMsg(null); setSaved(false)
    const { error } = await supabase.from('cases').update({ client_summary: summary.trim() || null, client_next_step: step.trim() || null, client_next_step_date: date || null }).eq('id', c.id)
    if (error) { setMsg(error.message); return }
    setSaved(true); onSaved()
  }
  return (
    <form onSubmit={save} className={card} aria-label="Lo que ve el cliente">
      <h2 className="mb-1 font-display text-lg text-navy-800">Lo que ve tu cliente</h2>
      <p className="mb-3 text-xs text-silver-500">Escribe en lenguaje sencillo. Esto aparece arriba en su portal.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Siguiente paso" className="sm:col-span-2"><Input value={step} maxLength={200} onChange={(e) => { setStep(e.target.value); setSaved(false) }} placeholder="Ej. Audiencia de pruebas en el juzgado" /></Field>
        <Field label="Fecha"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSaved(false) }} /></Field>
        <Field label="Cómo va el caso (resumen)" className="sm:col-span-3"><Textarea value={summary} maxLength={1500} onChange={(e) => { setSummary(e.target.value); setSaved(false) }} placeholder="Ej. Ya presentamos la demanda y estamos esperando que el juez la admita. No necesitas hacer nada por ahora." /></Field>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">{saved && <span role="status" className="text-xs font-semibold text-emerald-700">Guardado</span>}<Button type="submit">Guardar</Button></div>
    </form>
  )
}

function Stages({ caseId, caseType, firmId, rows, reload, setMsg }: { caseId: string; caseType: string | null; firmId: string; rows: Milestone[]; reload: () => void; setMsg: (m: string | null) => void }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eDesc, setEDesc] = useState('')
  const nextPos = rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0

  async function run(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p
    if (error) setMsg(error.message); else { setMsg(null); reload() }
  }
  const add = (e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; void run(supabase.from('case_milestones').insert({ firm_id: firmId, case_id: caseId, position: nextPos, title: title.trim(), description: desc.trim() || null })); setTitle(''); setDesc('') }
  const loadTemplate = () => {
    const names = MILESTONE_TEMPLATES[caseType ?? ''] ?? MILESTONE_TEMPLATES['Otro']
    void run(supabase.from('case_milestones').insert(names.map((t, i) => ({ firm_id: firmId, case_id: caseId, position: i, title: t, status: i === 0 ? 'en_curso' : 'pendiente' }))))
  }
  const setStatus = (m: Milestone, status: MilestoneStatus) => void run(supabase.from('case_milestones').update({ status, completed_on: status === 'hecha' ? today() : null }).eq('id', m.id))
  async function move(i: number, dir: -1 | 1) {
    const a = rows[i], b = rows[i + dir]
    if (!a || !b) return
    const r1 = await supabase.from('case_milestones').update({ position: b.position }).eq('id', a.id)
    const r2 = await supabase.from('case_milestones').update({ position: a.position }).eq('id', b.id)
    const error = r1.error ?? r2.error
    if (error) setMsg(error.message); else { setMsg(null); reload() }
  }
  const saveEdit = (m: Milestone) => { void run(supabase.from('case_milestones').update({ title: eTitle.trim() || m.title, description: eDesc.trim() || null }).eq('id', m.id)); setEditing(null) }

  return (
    <section aria-label="Etapas" className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-navy-800">Etapas del juicio</h2>
        {!rows.length && <Button variant="ghost" onClick={loadTemplate} className="!py-1.5 text-xs">Cargar etapas típicas de {caseType ?? 'este caso'}</Button>}
      </div>
      {!rows.length ? <p className="mb-3 text-sm text-silver-500">Define las etapas para que tu cliente vea en cuál va. Puedes editarlas, reordenarlas y agregar las tuyas.</p> : (
        <ol className="mb-4 flex flex-col gap-2">
          {rows.map((m, i) => (
            <li key={m.id} className="rounded-xl border border-silver-200 p-3">
              {editing === m.id ? (
                <div className="flex flex-col gap-2">
                  <Input aria-label="Título de la etapa" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
                  <Textarea aria-label="Explicación para el cliente" value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Qué significa esta etapa, en palabras sencillas (opcional)" />
                  <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)} className="!py-1.5 text-xs">Cancelar</Button><Button onClick={() => saveEdit(m)} className="!py-1.5 text-xs">Guardar</Button></div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold break-words">{i + 1}. {m.title} {m.status === 'hecha' && <Badge tone="green">Hecha{m.completed_on ? ` · ${fdate(m.completed_on)}` : ''}</Badge>}{m.status === 'en_curso' && <Badge tone="amber">En curso</Badge>}</div>
                    {m.description && <p className="text-sm text-silver-500 break-words">{m.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <Select aria-label={`Estado de ${m.title}`} value={m.status} onChange={(e) => setStatus(m, e.target.value as MilestoneStatus)} className="!w-auto !py-1 text-xs">{MILESTONE_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select>
                    <button type="button" aria-label="Subir etapa" disabled={i === 0} onClick={() => void move(i, -1)} className="rounded-md border border-silver-200 px-2 py-1 disabled:opacity-40">↑</button>
                    <button type="button" aria-label="Bajar etapa" disabled={i === rows.length - 1} onClick={() => void move(i, 1)} className="rounded-md border border-silver-200 px-2 py-1 disabled:opacity-40">↓</button>
                    <button type="button" onClick={() => { setEditing(m.id); setETitle(m.title); setEDesc(m.description ?? '') }} className="rounded-md border border-silver-200 px-2 py-1 font-semibold">Editar</button>
                    <button type="button" aria-label={`Quitar ${m.title}`} onClick={() => void run(supabase.from('case_milestones').delete().eq('id', m.id))} className="rounded-md border border-red-200 px-2 py-1 text-red-700">✕</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <Input aria-label="Nueva etapa" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Nueva etapa" />
        <Input aria-label="Explicación de la nueva etapa" value={desc} maxLength={1000} onChange={(e) => setDesc(e.target.value)} placeholder="Explicación (opcional)" />
        <Button type="submit" variant="ghost">Agregar</Button>
      </form>
    </section>
  )
}

function Updates({ caseId, firmId, rows, reload, setMsg }: { caseId: string; firmId: string; rows: CaseUpdate[]; reload: () => void; setMsg: (m: string | null) => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const { error } = await supabase.from('case_updates').insert({ firm_id: firmId, case_id: caseId, title: title.trim(), body: body.trim() || null })
    if (error) { setMsg(error.message); return }
    setMsg(null); setTitle(''); setBody(''); reload()
  }
  async function del(id: string) {
    const { error } = await supabase.from('case_updates').delete().eq('id', id)
    if (error) setMsg(error.message); else reload()
  }
  return (
    <section aria-label="Avances" className={card}>
      <h2 className="mb-1 font-display text-lg text-navy-800">Avances para el cliente</h2>
      <p className="mb-3 text-xs text-silver-500">Cada avance se publica de inmediato en su portal. Escríbelo como se lo dirías por WhatsApp.</p>
      <form onSubmit={add} className="mb-4 flex flex-col gap-2">
        <Input aria-label="Título del avance" required value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Presentamos la demanda" />
        <Textarea aria-label="Detalle del avance" value={body} maxLength={3000} onChange={(e) => setBody(e.target.value)} placeholder="Detalle (opcional)" />
        <div className="flex justify-end"><Button type="submit" variant="gold">Publicar avance</Button></div>
      </form>
      {!rows.length ? <p className="text-sm text-silver-500">Todavía no publicas avances.</p> : (
        <ul className="flex flex-col gap-3">
          {rows.map((u) => (
            <li key={u.id} className="flex items-start justify-between gap-2 border-l-2 border-gold-400 pl-3">
              <div className="min-w-0"><div className="text-xs text-silver-500">{fdate(u.created_at.slice(0, 10), true)}</div><div className="font-semibold break-words">{u.title}</div>{u.body && <p className="whitespace-pre-line text-sm break-words">{u.body}</p>}</div>
              <ConfirmDelete label="Quitar" onConfirm={() => void del(u.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DocRowItem({ d, reload, setMsg }: { d: DocRow; reload: () => void; setMsg: (m: string | null) => void }) {
  async function toggle(v: boolean) {
    const { error } = await supabase.from('documents').update({ visible_to_client: v }).eq('id', d.id)
    if (error) setMsg(error.message); else { setMsg(null); reload() }
  }
  async function download() {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 60, { download: d.file_name })
    if (error || !data) { setMsg(error?.message ?? 'No se pudo generar la descarga.'); return }
    window.location.href = data.signedUrl
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <div className="font-semibold break-words">{d.title}</div>
        <div className="text-xs text-silver-500 break-words">{DOC_CATEGORIES.find((x) => x.id === d.category)?.label} · {fdate(d.created_at.slice(0, 10), true)} · {fileSize(d.size_bytes)}</div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 font-semibold"><input type="checkbox" checked={d.visible_to_client} onChange={(e) => void toggle(e.target.checked)} className="h-4 w-4" />Visible para el cliente</label>
        <button type="button" onClick={() => void download()} className="rounded-md bg-navy-800 px-3 py-1.5 font-semibold text-white">Descargar</button>
      </div>
    </li>
  )
}

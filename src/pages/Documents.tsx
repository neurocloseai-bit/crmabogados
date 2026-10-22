import { useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { DOC_CATEGORIES, type CaseRow, type DocCategory, type DocRow } from '../lib/types'
import { fdate, fileSize, safeName } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Textarea } from '../components/ui'
import { ConfirmDelete } from './Leads'

const BUCKET = 'firm-documents'
const MAX_BYTES = 25 * 1024 * 1024

export default function Documents() {
  const firmId = useFirmId()
  const docs = useQuery<DocRow[]>(() => supabase.from('documents').select('*, cases(title)').order('created_at', { ascending: false }), [])
  const cases = useQuery<Pick<CaseRow, 'id' | 'title'>[]>(() => supabase.from('cases').select('id, title').order('title'), [])
  const [cat, setCat] = useState<DocCategory | 'todas'>('todas')
  const [q, setQ] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [upload, setUpload] = useState(false)
  const [editing, setEditing] = useState<DocRow | null>(null)

  const list = (docs.data ?? []).filter((d) => (cat === 'todas' || d.category === cat) && (!q.trim() || [d.title, d.file_name, d.description, d.cases?.title].join(' ').toLowerCase().includes(q.trim().toLowerCase())))

  async function download(d: DocRow) {
    setMsg(null)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 60, { download: d.file_name })
    if (error || !data) { setMsg(error?.message ?? 'No se pudo generar la descarga.'); return }
    window.location.href = data.signedUrl
  }
  async function remove(d: DocRow) {
    const { error: e1 } = await supabase.storage.from(BUCKET).remove([d.storage_path])
    if (e1) { setMsg(e1.message); return }
    const { error: e2 } = await supabase.from('documents').delete().eq('id', d.id)
    if (e2) { setMsg(e2.message); return }
    setEditing(null); void docs.reload()
  }

  if (docs.loading) return <Spinner />
  return (
    <>
      <PageHeader title="Documentos" subtitle="Tu biblioteca de machotes, demandas, escritos y contratos. Sube una vez, descarga cuando lo necesites." action={<Button variant="gold" onClick={() => setUpload(true)}>+ Subir documento</Button>} />
      <ErrorNote message={docs.error ?? msg} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="search" placeholder="Buscar por título, archivo o nota" aria-label="Buscar documentos" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />
        <Select aria-label="Categoría" value={cat} onChange={(e) => setCat(e.target.value as DocCategory | 'todas')} className="max-w-48">
          <option value="todas">Todas las categorías</option>{DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </Select>
      </div>
      {!docs.data?.length ? <Empty title="Tu biblioteca está vacía">Sube tus machotes de demandas, escritos y contratos para reutilizarlos después. Acepta Word, PDF, imágenes y más, hasta 25 MB cada uno.</Empty> : !list.length ? <Empty title="Sin resultados">Prueba con otra búsqueda o categoría.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <article key={d.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-silver-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0 font-bold break-words">{d.title}</div><Badge tone="blue">{DOC_CATEGORIES.find((c) => c.id === d.category)?.label}</Badge></div>
              <div className="text-xs text-silver-500 break-words">{d.file_name} · {fileSize(d.size_bytes)} · {fdate(d.created_at.slice(0, 10), true)}</div>
              {d.cases?.title && <div className="text-xs font-semibold text-navy-700">Expediente: {d.cases.title}</div>}
              {d.description && <p className="text-sm text-silver-500 break-words">{d.description}</p>}
              <div className="mt-auto flex gap-2 pt-1 text-xs">
                <button type="button" onClick={() => void download(d)} className="rounded-md bg-navy-800 px-3 py-1.5 font-semibold text-white">Descargar</button>
                <button type="button" onClick={() => setEditing(d)} className="rounded-md border border-silver-200 px-3 py-1.5 font-semibold">Editar</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {upload && <UploadModal firmId={firmId} cases={cases.data ?? []} onClose={() => setUpload(false)} onDone={() => { setUpload(false); void docs.reload() }} />}
      {editing && <EditModal doc={editing} cases={cases.data ?? []} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void docs.reload() }} onDelete={() => void remove(editing)} />}
    </>
  )
}

function UploadModal({ firmId, cases, onClose, onDone }: { firmId: string; cases: Pick<CaseRow, 'id' | 'title'>[]; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<DocCategory>('machote')
  const [caseId, setCaseId] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!file) { setErr('Elige un archivo.'); return }
    if (file.size > MAX_BYTES) { setErr('El archivo pesa más de 25 MB.'); return }
    setBusy(true); setErr(null)
    const path = `${firmId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
    if (up.error) { setErr(up.error.message); setBusy(false); return }
    const { error } = await supabase.from('documents').insert({ firm_id: firmId, case_id: caseId || null, title: title.trim() || file.name, category, description: desc.trim() || null, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size })
    if (error) { await supabase.storage.from(BUCKET).remove([path]); setErr(error.message); setBusy(false); return }
    onDone()
  }
  return (
    <Modal title="Subir documento" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorNote message={err} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Archivo" className="sm:col-span-2"><input ref={fileRef} required type="file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, '')) }} className="w-full rounded-lg border border-dashed border-silver-200 bg-silver-50 p-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white" /></Field>
          <Field label="Título" className="sm:col-span-2"><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Demanda de divorcio incausado" /></Field>
          <Field label="Categoría"><Select value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>{DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Field label="Expediente (opcional)"><Select value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Biblioteca general</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
          <Field label="Nota" className="sm:col-span-2"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Cuándo usarlo, qué campos cambiar…" /></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Subiendo…' : 'Subir'}</Button></div>
      </form>
    </Modal>
  )
}

function EditModal({ doc, cases, onClose, onSaved, onDelete }: { doc: DocRow; cases: Pick<CaseRow, 'id' | 'title'>[]; onClose: () => void; onSaved: () => void; onDelete: () => void }) {
  const [title, setTitle] = useState(doc.title)
  const [category, setCategory] = useState<DocCategory>(doc.category)
  const [caseId, setCaseId] = useState(doc.case_id ?? '')
  const [desc, setDesc] = useState(doc.description ?? '')
  const [err, setErr] = useState<string | null>(null)
  async function save(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('documents').update({ title: title.trim(), category, case_id: caseId || null, description: desc.trim() || null }).eq('id', doc.id)
    if (error) { setErr(error.message); return }
    onSaved()
  }
  return (
    <Modal title="Editar documento" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorNote message={err} />
        <p className="mb-3 text-xs text-silver-500 break-words">{doc.file_name}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título" className="sm:col-span-2"><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Categoría"><Select value={category} onChange={(e) => setCategory(e.target.value as DocCategory)}>{DOC_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Field label="Expediente"><Select value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Biblioteca general</option>{cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
          <Field label="Nota" className="sm:col-span-2"><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <ConfirmDelete label="Eliminar archivo" onConfirm={onDelete} />
          <div className="flex gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit">Guardar</Button></div>
        </div>
      </form>
    </Modal>
  )
}

import { useState } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import { DOC_CATEGORIES, type CaseUpdate, type Milestone } from '../lib/types'
import { fdate, fileSize } from '../lib/format'
import { Badge, Empty, ErrorNote, PageHeader, Spinner } from '../components/ui'
import { Icon, Logo } from '../components/icons'

interface PortalCase {
  id: string; title: string; case_type: string | null; court: string | null; file_number: string | null
  status: string; opened_on: string | null; next_step: string | null; next_step_date: string | null
  summary: string | null; client_name: string; firm_name: string
}
interface PortalDoc { id: string; title: string; category: string; file_name: string; size_bytes: number | null; created_at: string; storage_path: string }

const BUCKET = 'firm-documents'

function PortalLayout() {
  const { session, signOut } = useAuth()
  const cases = useQuery<PortalCase[]>(() => supabase.rpc('portal_my_cases'), [])
  const firmName = cases.data?.[0]?.firm_name ?? 'Tu despacho'
  return (
    <div className="min-h-screen">
      <header className="bg-hero text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={40} />
            <div className="min-w-0">
              <div className="truncate font-display text-base tracking-wider">{firmName}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold-300">Portal del cliente</div>
            </div>
          </div>
          <button type="button" onClick={() => void signOut()} className="flex flex-none items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white/85 hover:bg-white/10" aria-label={`Cerrar sesión de ${session?.user.email ?? ''}`}>
            <Icon name="out" className="h-4 w-4" /><span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6"><Outlet /></main>
    </div>
  )
}

export default function Portal() {
  return (
    <Routes>
      <Route element={<PortalLayout />}>
        <Route index element={<PortalHome />} />
        <Route path="caso/:id" element={<PortalCaseView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function PortalHome() {
  const cases = useQuery<PortalCase[]>(() => supabase.rpc('portal_my_cases'), [])
  if (cases.loading) return <Spinner />
  const list = cases.data ?? []
  if (list.length === 1) return <Navigate to={`/caso/${list[0].id}`} replace />
  return (
    <>
      <PageHeader title="Mis casos" subtitle="Elige un caso para ver cómo va." />
      <ErrorNote message={cases.error} />
      {!list.length ? <Empty title="Aún no tienes casos aquí">Tu abogado los verá aparecer en cuanto abra tu expediente.</Empty> : (
        <div className="grid gap-3">
          {list.map((c) => (
            <Link key={c.id} to={`/caso/${c.id}`} className="rounded-2xl border border-silver-200 bg-white p-4 shadow-card hover:border-gold-400">
              <div className="font-bold break-words">{c.title}</div>
              <div className="text-sm text-silver-500">{[c.case_type, c.court].filter(Boolean).join(' · ')}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

function PortalCaseView() {
  const { id = '' } = useParams()
  const cases = useQuery<PortalCase[]>(() => supabase.rpc('portal_my_cases'), [])
  const miles = useQuery<Milestone[]>(() => supabase.from('case_milestones').select('*').eq('case_id', id).order('position'), [id])
  const updates = useQuery<CaseUpdate[]>(() => supabase.from('case_updates').select('*').eq('case_id', id).order('created_at', { ascending: false }), [id])
  const docs = useQuery<PortalDoc[]>(() => supabase.rpc('portal_case_documents', { p_case: id }), [id])
  const [msg, setMsg] = useState<string | null>(null)

  const c = cases.data?.find((x) => x.id === id)
  if (cases.loading || miles.loading) return <Spinner />
  if (!c) return <Empty title="No encontramos este caso"><Link to="/" className="font-semibold text-navy-700 underline">Volver a mis casos</Link></Empty>

  const steps = miles.data ?? []
  const done = steps.filter((s) => s.status === 'hecha').length
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0
  const current = steps.find((s) => s.status === 'en_curso') ?? steps.find((s) => s.status === 'pendiente')

  async function download(d: PortalDoc) {
    setMsg(null)
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 60, { download: d.file_name })
    if (error || !data) { setMsg(error?.message ?? 'No se pudo generar la descarga.'); return }
    window.location.href = data.signedUrl
  }

  return (
    <>
      <Link to="/" className="mb-3 inline-block text-sm font-semibold text-navy-700 hover:underline">← Mis casos</Link>
      <PageHeader title={c.title} subtitle={[c.case_type, c.court, c.file_number ? `Expediente ${c.file_number}` : ''].filter(Boolean).join(' · ')} />
      <ErrorNote message={msg ?? cases.error ?? miles.error ?? updates.error ?? docs.error} />

      {(c.next_step || c.next_step_date) && (
        <section aria-label="Siguiente paso" className="mb-5 rounded-2xl border border-gold-400 bg-gold-300/15 p-4 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gold-500">Siguiente paso</div>
          <div className="mt-1 text-lg font-bold text-navy-900 break-words">{c.next_step ?? 'Pendiente de definir'}</div>
          {c.next_step_date && <div className="mt-1 text-sm text-navy-800">Fecha: <b>{fdate(c.next_step_date, true)}</b></div>}
        </section>
      )}

      {c.summary && (
        <section aria-label="Resumen" className="mb-5 rounded-2xl border border-silver-200 bg-white p-4 shadow-card">
          <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-silver-500">Cómo va tu caso</h2>
          <p className="whitespace-pre-line text-sm text-navy-900 break-words">{c.summary}</p>
        </section>
      )}

      <section aria-label="Etapas del juicio" className="mb-5 rounded-2xl border border-silver-200 bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-navy-800">Etapas del juicio</h2>
          {steps.length > 0 && <Badge tone={pct === 100 ? 'green' : 'blue'}>{done} de {steps.length}</Badge>}
        </div>
        {steps.length > 0 && <div className="mb-4 h-2 overflow-hidden rounded bg-silver-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del caso"><div className="h-full bg-gradient-to-r from-gold-300 to-gold-400" style={{ width: `${pct}%` }} /></div>}
        {!steps.length ? <p className="text-sm text-silver-500">Tu abogado todavía no publica las etapas.</p> : (
          <ol className="relative flex flex-col gap-4">
            {steps.map((s, i) => {
              const isCurrent = current?.id === s.id
              return (
                <li key={s.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span aria-hidden="true" className={`grid h-7 w-7 flex-none place-items-center rounded-full border-2 text-xs font-bold ${s.status === 'hecha' ? 'border-emerald-500 bg-emerald-500 text-white' : isCurrent ? 'border-gold-400 bg-gold-300 text-navy-950' : 'border-silver-200 bg-white text-silver-500'}`}>{s.status === 'hecha' ? '✓' : i + 1}</span>
                    {i < steps.length - 1 && <span aria-hidden="true" className={`mt-1 w-0.5 flex-1 ${s.status === 'hecha' ? 'bg-emerald-300' : 'bg-silver-200'}`} />}
                  </div>
                  <div className="min-w-0 pb-1">
                    <div className={`font-semibold break-words ${s.status === 'pendiente' && !isCurrent ? 'text-silver-500' : 'text-navy-900'}`}>
                      {s.title} <span className="ml-1 align-middle">{s.status === 'hecha' ? <Badge tone="green">Hecha{s.completed_on ? ` · ${fdate(s.completed_on)}` : ''}</Badge> : isCurrent ? <Badge tone="amber">Aquí vamos</Badge> : null}</span>
                    </div>
                    {s.description && <p className="text-sm text-silver-500 break-words">{s.description}</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section aria-label="Avances" className="mb-5 rounded-2xl border border-silver-200 bg-white p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg text-navy-800">Avances recientes</h2>
        {!updates.data?.length ? <p className="text-sm text-silver-500">Cuando haya novedades, tu abogado las publicará aquí.</p> : (
          <ul className="flex flex-col gap-3">
            {updates.data.map((u) => (
              <li key={u.id} className="border-l-2 border-gold-400 pl-3">
                <div className="text-xs text-silver-500">{fdate(u.created_at.slice(0, 10), true)}</div>
                <div className="font-semibold break-words">{u.title}</div>
                {u.body && <p className="whitespace-pre-line text-sm text-navy-900 break-words">{u.body}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Escritos y documentos" className="mb-8 rounded-2xl border border-silver-200 bg-white p-4 shadow-card">
        <h2 className="mb-3 font-display text-lg text-navy-800">Escritos y documentos</h2>
        {!docs.data?.length ? <p className="text-sm text-silver-500">Aún no hay documentos compartidos contigo.</p> : (
          <ul className="flex flex-col divide-y divide-silver-200">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="font-semibold break-words">{d.title}</div>
                  <div className="text-xs text-silver-500 break-words">{DOC_CATEGORIES.find((x) => x.id === d.category)?.label ?? d.category} · {fdate(d.created_at.slice(0, 10), true)} · {fileSize(d.size_bytes)}</div>
                </div>
                <button type="button" onClick={() => void download(d)} className="flex-none rounded-md bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white">Descargar</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

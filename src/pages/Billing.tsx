import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useFirmId } from '../auth/AuthProvider'
import { useQuery } from '../lib/useQuery'
import type { CaseRow, Client, Payment } from '../lib/types'
import { addDays, addMonths, daysBetween, fdate, mxn, today } from '../lib/format'
import { Badge, Button, Empty, ErrorNote, Field, Input, Modal, PageHeader, Select, Spinner, Stat } from '../components/ui'
import { ConfirmDelete } from './Leads'

type Freq = 'semanal' | 'quincenal' | 'mensual'
type CaseOpt = Pick<CaseRow, 'id' | 'title' | 'fees' | 'client_id'>
const METHODS = ['Efectivo', 'Transferencia', 'Depósito', 'Tarjeta', 'Otro']

function step(date: string, freq: Freq, i: number): string {
  return freq === 'semanal' ? addDays(date, 7 * i) : freq === 'quincenal' ? addDays(date, 15 * i) : addMonths(date, i)
}
function buildSchedule(total: number, down: number, n: number, freq: Freq, first: string, start: string) {
  const rows: { kind: 'anticipo' | 'mensualidad'; amount: number; due_date: string }[] = []
  if (down > 0) rows.push({ kind: 'anticipo', amount: down, due_date: start })
  const rest = Math.max(0, total - down)
  const base = Math.floor((rest / n) * 100) / 100
  for (let i = 0; i < n; i++) {
    const amount = i === n - 1 ? Math.round((rest - base * (n - 1)) * 100) / 100 : base
    if (amount > 0) rows.push({ kind: 'mensualidad', amount, due_date: step(first, freq, i) })
  }
  return rows
}

export default function Billing() {
  const firmId = useFirmId()
  const pays = useQuery<Payment[]>(() => supabase.from('payments').select('*, clients(full_name), cases(title)').order('due_date', { nullsFirst: false }), [])
  const cases = useQuery<CaseOpt[]>(() => supabase.from('cases').select('id, title, fees, client_id').in('status', ['activo', 'suspendido']).order('title'), [])
  const clients = useQuery<Pick<Client, 'id' | 'full_name'>[]>(() => supabase.from('clients').select('id, full_name').order('full_name'), [])
  const [msg, setMsg] = useState<string | null>(null)
  const [paying, setPaying] = useState<Payment | null>(null)
  const [payDraft, setPayDraft] = useState({ paid_on: today(), method: METHODS[1], note: '' })
  const [plan, setPlan] = useState(false)
  const [loose, setLoose] = useState(false)

  const t = today()
  const all = pays.data ?? []
  const pending = all.filter((p) => !p.paid_on)
  const overdue = pending.filter((p) => p.due_date && p.due_date < t)
  const month = t.slice(0, 7)
  const paidMonth = all.filter((p) => p.paid_on?.startsWith(month)).reduce((s, p) => s + p.amount, 0)
  const paidList = all.filter((p) => p.paid_on).sort((a, b) => (b.paid_on ?? '').localeCompare(a.paid_on ?? '')).slice(0, 15)

  async function confirmPay(e: FormEvent) {
    e.preventDefault()
    if (!paying) return
    const { error } = await supabase.from('payments').update({ paid_on: payDraft.paid_on, method: payDraft.method, note: payDraft.note.trim() || null }).eq('id', paying.id)
    if (error) { setMsg(error.message); return }
    setPaying(null); void pays.reload()
  }
  async function undo(p: Payment) {
    const { error } = await supabase.from('payments').update({ paid_on: null, method: null }).eq('id', p.id)
    if (error) setMsg(error.message); else void pays.reload()
  }
  async function removePayment() {
    if (!paying) return
    const { error } = await supabase.from('payments').delete().eq('id', paying.id)
    if (error) { setMsg(error.message); return }
    setPaying(null); void pays.reload()
  }

  if (pays.loading || cases.loading || clients.loading) return <Spinner />
  return (
    <>
      <PageHeader title="Cobranza" subtitle="Planes de pago, saldos y pagos recibidos." action={<div className="flex gap-2"><Button variant="ghost" onClick={() => setLoose(true)}>Registrar pago</Button><Button variant="gold" onClick={() => setPlan(true)}>+ Plan de pagos</Button></div>} />
      <ErrorNote message={pays.error ?? msg} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Por cobrar" value={mxn(pending.reduce((s, p) => s + p.amount, 0))} />
        <Stat label="Vencido" value={mxn(overdue.reduce((s, p) => s + p.amount, 0))} tone={overdue.length ? 'alert' : 'normal'} />
        <Stat label="Cobrado este mes" value={mxn(paidMonth)} />
        <Stat label="Pagos pendientes" value={pending.length} />
      </div>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-silver-500">Pendientes</h2>
      {!pending.length ? <Empty title="No hay pagos pendientes">Crea un plan de pagos para un cliente y aquí verás cada pago con su fecha.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-silver-200 bg-white shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-silver-100 text-[11px] uppercase tracking-wider text-silver-500"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">Concepto</th><th className="px-3 py-2 text-right">Monto</th><th className="px-3 py-2" /></tr></thead>
            <tbody className="divide-y divide-silver-200">
              {pending.map((p) => {
                const late = p.due_date && p.due_date < t
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{p.due_date ? fdate(p.due_date) : 'Sin fecha'} {late ? <Badge tone="red">{Math.abs(daysBetween(t, p.due_date!))} d</Badge> : p.due_date === t ? <Badge tone="amber">Hoy</Badge> : null}</td>
                    <td className="px-3 py-2"><div className="font-semibold">{p.clients?.full_name}</div><div className="text-xs text-silver-500">{p.cases?.title ?? 'Sin expediente aún'}</div></td>
                    <td className="px-3 py-2 capitalize">{p.kind}</td>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">{mxn(p.amount)}</td>
                    <td className="px-3 py-2 text-right"><Button variant="ghost" onClick={() => { setMsg(null); setPayDraft({ paid_on: today(), method: METHODS[1], note: '' }); setPaying(p) }}>Registrar pago</Button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-6 mb-2 text-xs font-bold uppercase tracking-widest text-silver-500">Cobrados recientemente</h2>
      {!paidList.length ? <p className="text-sm text-silver-500">Aún no hay pagos registrados.</p> : (
        <ul className="divide-y divide-silver-200 rounded-2xl border border-silver-200 bg-white shadow-card">
          {paidList.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span><b>{p.clients?.full_name}</b> · {p.cases?.title ?? 'sin expediente aún'}<span className="block text-xs text-silver-500">{fdate(p.paid_on, true)} · {p.method ?? '—'} · <span className="capitalize">{p.kind}</span></span></span>
              <span className="flex items-center gap-3"><b className="tabular-nums">{mxn(p.amount)}</b><button type="button" onClick={() => void undo(p)} className="text-xs font-semibold text-silver-500 underline">Deshacer</button></span>
            </li>
          ))}
        </ul>
      )}

      {paying && (
        <Modal title="Registrar pago" onClose={() => setPaying(null)}>
          <form onSubmit={confirmPay}>
            <p className="mb-3 text-sm"><b>{paying.clients?.full_name}</b> · {mxn(paying.amount)} <span className="capitalize">({paying.kind})</span></p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Fecha de pago"><Input required type="date" value={payDraft.paid_on} onChange={(e) => setPayDraft({ ...payDraft, paid_on: e.target.value })} /></Field>
              <Field label="Forma de pago"><Select value={payDraft.method} onChange={(e) => setPayDraft({ ...payDraft, method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
              <Field label="Nota" className="sm:col-span-2"><Input value={payDraft.note} onChange={(e) => setPayDraft({ ...payDraft, note: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <ConfirmDelete label="Eliminar pago" onConfirm={() => void removePayment()} />
              <div className="flex gap-2"><Button variant="ghost" onClick={() => setPaying(null)}>Cancelar</Button><Button type="submit">Marcar pagado</Button></div>
            </div>
          </form>
        </Modal>
      )}
      {plan && <PlanModal firmId={firmId} clients={clients.data ?? []} cases={cases.data ?? []} onClose={() => setPlan(false)} onDone={() => { setPlan(false); void pays.reload() }} />}
      {loose && <LooseModal firmId={firmId} clients={clients.data ?? []} cases={cases.data ?? []} onClose={() => setLoose(false)} onDone={() => { setLoose(false); void pays.reload() }} />}
    </>
  )
}


type ClientOpt = Pick<Client, 'id' | 'full_name'>

function PlanModal({ firmId, clients, cases, onClose, onDone }: { firmId: string; clients: ClientOpt[]; cases: CaseOpt[]; onClose: () => void; onDone: () => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [caseId, setCaseId] = useState('')
  const [total, setTotal] = useState('')
  const [down, setDown] = useState('')
  const [n, setN] = useState('6')
  const [freq, setFreq] = useState<Freq>('mensual')
  const [first, setFirst] = useState(step(today(), 'mensual', 1))
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const T = Number(total) || 0, D = Number(down) || 0, N = Math.max(1, Math.min(120, Math.floor(Number(n) || 1)))
  const valid = T > 0 && D >= 0 && D < T && !!first
  const rows = valid ? buildSchedule(T, D, N, freq, first, today()) : []

  const mine = cases.filter((c) => c.client_id === clientId)
  function pickClient(id: string) {
    setClientId(id); setCaseId('')
    const own = cases.filter((c) => c.client_id === id)
    if (own.length === 1) { setCaseId(own[0].id); if (own[0].fees) setTotal(String(own[0].fees)) }
  }
  function pickCase(id: string) {
    setCaseId(id); const c = cases.find((x) => x.id === id)
    if (c?.fees) setTotal(String(c.fees))
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!clientId) { setErr('Elige un cliente. Si no existe, créalo en Clientes.'); return }
    if (!valid) { setErr('Revisa los montos: el anticipo debe ser menor al total.'); return }
    setBusy(true); setErr(null)
    const { data: plan, error } = await supabase.from('payment_plans').insert({ firm_id: firmId, client_id: clientId, case_id: caseId || null, total: T, down_payment: D, installments: N, frequency: freq, first_due: first }).select('id').single()
    if (error || !plan) { setErr(error?.message ?? 'No se pudo crear el plan.'); setBusy(false); return }
    const { error: e2 } = await supabase.from('payments').insert(rows.map((r) => ({ ...r, firm_id: firmId, client_id: clientId, case_id: caseId || null, plan_id: plan.id })))
    if (e2) { await supabase.from('payment_plans').delete().eq('id', plan.id); setErr(e2.message); setBusy(false); return }
    onDone()
  }
  return (
    <Modal wide title="Nuevo plan de pagos" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorNote message={err} />
        {!clients.length ? <p className="text-sm text-silver-500">Primero agrega un cliente en Clientes.</p> : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cliente"><Select value={clientId} onChange={(e) => pickClient(e.target.value)}>{clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</Select></Field>
            <Field label="Expediente (opcional)"><Select value={caseId} onChange={(e) => pickCase(e.target.value)}><option value="">Aún sin expediente</option>{mine.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
            <Field label="Total a cobrar (MXN)"><Input required type="number" min={1} step={100} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} /></Field>
            <Field label="Anticipo hoy (MXN)"><Input type="number" min={0} step={100} inputMode="numeric" value={down} onChange={(e) => setDown(e.target.value)} /></Field>
            <Field label="Número de pagos"><Input type="number" min={1} max={120} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></Field>
            <Field label="Frecuencia"><Select value={freq} onChange={(e) => { const f = e.target.value as Freq; setFreq(f); setFirst(step(today(), f, 1)) }}><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option></Select></Field>
            <Field label="Fecha del primer pago"><Input required type="date" value={first} onChange={(e) => setFirst(e.target.value)} /></Field>
          </div>
        )}
        {rows.length > 0 && (
          <div className="mt-4 rounded-lg bg-silver-100 p-3 text-sm">
            <div className="mb-1 font-semibold">Calendario: {rows.length} pagos, total {mxn(rows.reduce((s, r) => s + r.amount, 0))}</div>
            <ul className="max-h-40 overflow-y-auto text-xs tabular-nums">{rows.map((r, i) => <li key={i} className="flex justify-between py-0.5"><span className="capitalize">{r.kind} · {fdate(r.due_date, true)}</span><b>{mxn(r.amount)}</b></li>)}</ul>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy || !clients.length}>{busy ? 'Creando…' : 'Crear plan'}</Button></div>
      </form>
    </Modal>
  )
}

function LooseModal({ firmId, clients, cases, onClose, onDone }: { firmId: string; clients: ClientOpt[]; cases: CaseOpt[]; onClose: () => void; onDone: () => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '')
  const [caseId, setCaseId] = useState('')
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today())
  const [method, setMethod] = useState(METHODS[1])
  const [err, setErr] = useState<string | null>(null)
  async function save(e: FormEvent) {
    e.preventDefault()
    if (!clientId) { setErr('Elige un cliente.'); return }
    const { error } = await supabase.from('payments').insert({ firm_id: firmId, client_id: clientId, case_id: caseId || null, kind: 'pago', amount: Number(amount), due_date: paidOn, paid_on: paidOn, method })
    if (error) { setErr(error.message); return }
    onDone()
  }
  return (
    <Modal title="Registrar pago recibido" onClose={onClose}>
      <form onSubmit={save}>
        <ErrorNote message={err} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente"><Select value={clientId} onChange={(e) => { setClientId(e.target.value); const own = cases.filter((c) => c.client_id === e.target.value); setCaseId(own.length === 1 ? own[0].id : '') }}>{clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</Select></Field>
          <Field label="Expediente (opcional)"><Select value={caseId} onChange={(e) => setCaseId(e.target.value)}><option value="">Aún sin expediente</option>{cases.filter((c) => c.client_id === clientId).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>
          <Field label="Monto (MXN)"><Input required type="number" min={1} step={50} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="Fecha de pago"><Input required type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
          <Field label="Forma de pago" className="sm:col-span-2"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        </div>
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={!clients.length}>Guardar</Button></div>
      </form>
    </Modal>
  )
}

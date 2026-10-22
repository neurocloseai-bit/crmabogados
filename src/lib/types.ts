export type Stage = 'nuevo' | 'contactado' | 'consulta' | 'cotizado' | 'cliente' | 'perdido'

export interface Lead {
  id: string; firm_id: string; name: string; phone: string | null; source: string | null
  case_type: string | null; stage: Stage; quoted: number; follow_up_date: string | null
  notes: string | null; created_at: string
}
export interface Client {
  id: string; firm_id: string; lead_id: string | null; full_name: string; phone: string | null
  email: string | null; address: string | null; notes: string | null; created_at: string
}
export type CaseStatus = 'activo' | 'suspendido' | 'concluido' | 'archivado'
export interface CaseRow {
  id: string; firm_id: string; client_id: string; title: string; case_type: string | null
  court: string | null; file_number: string | null; counterpart: string | null
  status: CaseStatus; opened_on: string | null; fees: number; notes: string | null
  clients?: { full_name: string } | null
}
export type DeadlineKind = 'termino' | 'audiencia' | 'cita' | 'pago' | 'otro'
export interface Deadline {
  id: string; firm_id: string; case_id: string | null; title: string; kind: DeadlineKind
  due_date: string; due_time: string | null; court: string | null; file_number: string | null
  notes: string | null; done: boolean
  cases?: { title: string; clients?: { full_name: string } | null } | null
}
export interface Holiday { id: string; firm_id: string; day: string; label: string | null }
export interface PaymentPlan {
  id: string; firm_id: string; case_id: string; total: number; down_payment: number
  installments: number; frequency: 'semanal' | 'quincenal' | 'mensual'; first_due: string | null
}
export interface Payment {
  id: string; firm_id: string; case_id: string; plan_id: string | null
  kind: 'anticipo' | 'mensualidad' | 'pago'; amount: number; due_date: string | null
  paid_on: string | null; method: string | null; note: string | null
  cases?: { title: string; clients?: { full_name: string } | null } | null
}
export type DocCategory = 'machote' | 'demanda' | 'contestacion' | 'escrito' | 'contrato' | 'poder' | 'otro'
export interface DocRow {
  id: string; firm_id: string; case_id: string | null; title: string; category: DocCategory
  description: string | null; storage_path: string; file_name: string; mime_type: string | null
  size_bytes: number | null; created_at: string
  cases?: { title: string } | null
}

export const STAGES: { id: Stage; label: string }[] = [
  { id: 'nuevo', label: 'Nuevo' }, { id: 'contactado', label: 'Contactado' },
  { id: 'consulta', label: 'Consulta agendada' }, { id: 'cotizado', label: 'Cotizado' },
  { id: 'cliente', label: 'Cliente' }, { id: 'perdido', label: 'Perdido' },
]
export const CASE_TYPES = ['Divorcio de mutuo acuerdo', 'Divorcio contencioso', 'Pensión alimenticia', 'Despido injustificado', 'Desalojo', 'Cobro de pagaré', 'Otro']
export const SOURCES = ['Anuncio de Facebook', 'Marketplace', 'WhatsApp directo', 'Recomendación', 'Otro']
export const DEADLINE_KINDS: { id: DeadlineKind; label: string }[] = [
  { id: 'termino', label: 'Término procesal' }, { id: 'audiencia', label: 'Audiencia' },
  { id: 'cita', label: 'Cita con cliente' }, { id: 'pago', label: 'Pago de cliente' }, { id: 'otro', label: 'Otro' },
]
export const DOC_CATEGORIES: { id: DocCategory; label: string }[] = [
  { id: 'machote', label: 'Machote' }, { id: 'demanda', label: 'Demanda' }, { id: 'contestacion', label: 'Contestación' },
  { id: 'escrito', label: 'Escrito' }, { id: 'contrato', label: 'Contrato' }, { id: 'poder', label: 'Poder' }, { id: 'otro', label: 'Otro' },
]
export const CASE_STATUS: { id: CaseStatus; label: string }[] = [
  { id: 'activo', label: 'Activo' }, { id: 'suspendido', label: 'Suspendido' },
  { id: 'concluido', label: 'Concluido' }, { id: 'archivado', label: 'Archivado' },
]

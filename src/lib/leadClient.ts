import { supabase } from './supabase'

type LeadLite = { id: string; name: string; phone: string | null; case_type?: string | null }

/** Crea la ficha en Clientes si el lead todavía no tiene una. Devuelve un mensaje de error, o null si todo salió bien. */
export async function ensureClientForLead(firmId: string, lead: LeadLite): Promise<string | null> {
  const { data, error } = await supabase.from('clients').select('id').eq('lead_id', lead.id).limit(1)
  if (error) return error.message
  if (data?.length) return null
  const { error: e2 } = await supabase.from('clients').insert({ firm_id: firmId, lead_id: lead.id, full_name: lead.name, phone: lead.phone })
  return e2?.message ?? null
}

/** Pasa a Clientes a todos los leads que ya están en etapa “Cliente” pero no tienen ficha. Devuelve cuántos creó. */
export async function syncClientLeads(firmId: string): Promise<number> {
  const [leads, clients] = await Promise.all([
    supabase.from('leads').select('id, name, phone').eq('stage', 'cliente'),
    supabase.from('clients').select('lead_id').not('lead_id', 'is', null),
  ])
  if (leads.error || clients.error) return 0
  const have = new Set((clients.data ?? []).map((c) => c.lead_id as string))
  const missing = (leads.data ?? []).filter((l) => !have.has(l.id as string))
  if (!missing.length) return 0
  const { error } = await supabase.from('clients').insert(missing.map((l) => ({ firm_id: firmId, lead_id: l.id, full_name: l.name, phone: l.phone })))
  return error ? 0 : missing.length
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useQuery } from '../lib/useQuery'
import { waLink } from '../lib/format'
import { Button, ErrorNote } from './ui'
import { ConfirmDelete } from '../pages/Leads'

/** Acceso del cliente al portal: genera un código de un solo uso y muestra si ya tiene cuenta. */
export function InviteClient({ clientId, name, phone }: { clientId: string; name: string; phone: string | null }) {
  const accounts = useQuery<{ user_id: string }[]>(() => supabase.from('client_users').select('user_id').eq('client_id', clientId), [clientId])
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const n = accounts.data?.length ?? 0

  async function generate() {
    setBusy(true); setErr(null); setCopied(false)
    const { data, error } = await supabase.rpc('create_client_invite', { p_client: clientId })
    if (error) setErr(error.message); else setCode(data as string)
    setBusy(false)
  }
  async function revoke() {
    const { error } = await supabase.from('client_users').delete().eq('client_id', clientId)
    if (error) setErr(error.message); else void accounts.reload()
  }

  const pretty = code ? code.replace(/(.{4})(?=.)/g, '$1-') : ''
  const text = code ? `Hola ${name.split(' ')[0]}, ya puedes ver cómo va tu caso en línea: ${window.location.origin}\nToca “Soy cliente: tengo un código de acceso”, crea tu contraseña y escribe este código: ${pretty}\nEl código sirve una sola vez y vence en 14 días.` : ''
  const wa = waLink(phone)

  return (
    <section aria-label="Acceso al portal" className="rounded-xl border border-silver-200 bg-silver-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm"><b>Portal del cliente:</b> {n ? `${n} ${n === 1 ? 'cuenta con acceso' : 'cuentas con acceso'}` : 'sin acceso todavía'}</div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => void generate()} disabled={busy} className="!py-1.5 text-xs">{busy ? 'Generando…' : n ? 'Nuevo código' : 'Invitar al portal'}</Button>
          {n > 0 && <ConfirmDelete label="Quitar acceso" onConfirm={() => void revoke()} />}
        </div>
      </div>
      <ErrorNote message={err} />
      {code && (
        <div className="mt-3 rounded-lg border border-gold-400 bg-white p-3">
          <div className="text-xs text-silver-500">Código de un solo uso (vence en 14 días)</div>
          <div className="my-1 font-mono text-xl font-bold tracking-widest text-navy-900">{pretty}</div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="rounded-md border border-silver-200 px-3 py-1.5 font-semibold" onClick={() => { void navigator.clipboard?.writeText(text).then(() => setCopied(true)) }}>{copied ? 'Copiado' : 'Copiar mensaje'}</button>
            {wa && <a className="rounded-md bg-emerald-100 px-3 py-1.5 font-semibold text-emerald-800" target="_blank" rel="noopener noreferrer" href={`${wa}?text=${encodeURIComponent(text)}`}>Enviar por WhatsApp</a>}
          </div>
        </div>
      )}
    </section>
  )
}

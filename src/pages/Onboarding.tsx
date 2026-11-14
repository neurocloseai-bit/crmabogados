import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Button, ErrorNote, Field, Input } from '../components/ui'

const INTENT = 'portal_intent'
const readIntent = () => { try { return localStorage.getItem(INTENT) === '1' } catch { return false } }
export const setPortalIntent = (on: boolean) => { try { if (on) localStorage.setItem(INTENT, '1'); else localStorage.removeItem(INTENT) } catch { /* sin almacenamiento */ } }

export default function Onboarding() {
  const { refresh, signOut } = useAuth()
  const [mode, setMode] = useState<'firm' | 'code'>(readIntent() ? 'code' : 'firm')
  const [name, setName] = useState('')
  const [fullName, setFullName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.rpc('create_firm', { p_name: name, p_full_name: fullName })
    if (error) { setError(error.message); setBusy(false); return }
    await refresh()
    setBusy(false)
  }

  async function claim(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.rpc('claim_client_invite', { p_code: code })
    if (error) { setError(error.message); setBusy(false); return }
    setPortalIntent(false)
    await refresh()
    setBusy(false)
  }

  if (mode === 'code') {
    return (
      <AuthShell>
        <form onSubmit={claim}>
          <h2 className="font-display text-2xl tracking-wide text-navy-800">Acceso de clientes</h2>
          <p className="mb-6 mt-1 text-sm text-silver-500">Escribe el código que te dio tu abogado por WhatsApp. Con él verás en qué etapa va tu caso, tu siguiente paso y tus documentos.</p>
          <ErrorNote message={error} />
          <div className="flex flex-col gap-4">
            <Field label="Código de acceso"><Input required autoComplete="off" autoCapitalize="characters" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" className="text-center font-mono tracking-widest" /></Field>
            <Button type="submit" variant="gold" disabled={busy} className="!py-3 text-base">{busy ? 'Verificando…' : 'Entrar a mi caso'}</Button>
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setMode('firm'); setError(null) }} className="font-semibold text-navy-700 hover:underline">Soy abogado</button>
            <button type="button" onClick={() => void signOut()} className="text-silver-500 hover:underline">Salir</button>
          </div>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={submit}>
        <h2 className="font-display text-2xl tracking-wide text-navy-800">Crea tu despacho</h2>
        <p className="mb-6 mt-1 text-sm text-silver-500">Es el espacio donde vivirán tus leads, clientes y expedientes. Solo tú y quienes agregues podrán verlo.</p>
        <ErrorNote message={error} />
        <div className="flex flex-col gap-4">
          <Field label="Nombre del despacho"><Input required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Maldonado Abogados" /></Field>
          <Field label="Tu nombre"><Input maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej. Lic. David Maldonado" /></Field>
          <Button type="submit" variant="gold" disabled={busy} className="!py-3 text-base">{busy ? 'Creando…' : 'Crear despacho'}</Button>
        </div>
        <div className="mt-5 flex items-center justify-between text-sm">
          <button type="button" onClick={() => { setMode('code'); setError(null) }} className="font-semibold text-navy-700 hover:underline">Soy cliente y tengo un código</button>
          <button type="button" onClick={() => void signOut()} className="text-silver-500 hover:underline">Salir</button>
        </div>
      </form>
    </AuthShell>
  )
}

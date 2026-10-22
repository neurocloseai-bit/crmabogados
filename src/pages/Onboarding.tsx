import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { AuthShell } from '../components/AuthShell'
import { Button, ErrorNote, Field, Input } from '../components/ui'

export default function Onboarding() {
  const { refresh, signOut } = useAuth()
  const [name, setName] = useState('')
  const [fullName, setFullName] = useState('')
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
        <button type="button" onClick={() => void signOut()} className="mt-5 text-sm text-silver-500 hover:underline">Salir</button>
      </form>
    </AuthShell>
  )
}

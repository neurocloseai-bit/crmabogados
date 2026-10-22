import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorNote, Field, Input } from '../components/ui'

function friendly(msg: string): string {
  if (/invalid login/i.test(msg)) return 'Correo o contraseña incorrectos.'
  if (/already registered/i.test(msg)) return 'Ese correo ya tiene cuenta. Inicia sesión.'
  if (/password/i.test(msg) && /6|short|weak/i.test(msg)) return 'La contraseña debe tener al menos 8 caracteres.'
  return msg
}

export default function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null); setInfo(null)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(friendly(error.message))
    } else {
      if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); setBusy(false); return }
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(friendly(error.message))
      else if (!data.session) setInfo('Te enviamos un correo para confirmar tu cuenta. Ábrelo y después inicia sesión.')
    }
    setBusy(false)
  }

  async function reset() {
    if (!email) { setError('Escribe tu correo primero.'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(friendly(error.message)); else setInfo('Te enviamos un enlace para cambiar tu contraseña.')
  }

  return (
    <div className="grid min-h-screen place-items-center bg-navy-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 text-center">
          <div className="font-display text-2xl tracking-wider text-navy-800">Despacho CRM</div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold-500">Leads · Expedientes · Cobranza</div>
        </div>
        <ErrorNote message={error} />
        {info && <div role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}
        <div className="flex flex-col gap-3">
          <Field label="Correo"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Contraseña"><Input type="password" required minLength={mode === 'up' ? 8 : undefined} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" disabled={busy}>{busy ? 'Un momento…' : mode === 'in' ? 'Entrar' : 'Crear cuenta'}</Button>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs">
          <button type="button" className="font-semibold text-navy-700 underline" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); setInfo(null) }}>
            {mode === 'in' ? 'Crear una cuenta' : 'Ya tengo cuenta'}
          </button>
          {mode === 'in' && <button type="button" className="text-silver-500 underline" onClick={() => void reset()}>Olvidé mi contraseña</button>}
        </div>
      </form>
    </div>
  )
}

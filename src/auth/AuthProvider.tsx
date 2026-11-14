import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Firm { id: string; name: string; role: string; fullName: string | null }
interface Ctx {
  session: Session | null
  firm: Firm | null
  /** true si la cuenta es de un cliente del despacho (portal) y no de un miembro */
  portal: boolean
  loading: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [firm, setFirm] = useState<Firm | null>(null)
  const [portal, setPortal] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadFirm = useCallback(async (s: Session | null) => {
    if (!s) { setFirm(null); setPortal(false); return }
    const { data } = await supabase
      .from('firm_members')
      .select('firm_id, role, full_name, firms(name)')
      .eq('user_id', s.user.id)
      .maybeSingle()
    if (!data) {
      setFirm(null)
      const { data: cu } = await supabase.from('client_users').select('client_id').eq('user_id', s.user.id).limit(1)
      setPortal(Boolean(cu?.length))
      return
    }
    setPortal(false)
    const f = data.firms as unknown as { name: string } | { name: string }[] | null
    const name = Array.isArray(f) ? f[0]?.name : f?.name
    setFirm({ id: data.firm_id as string, name: name ?? 'Mi despacho', role: data.role as string, fullName: (data.full_name as string | null) ?? null })
  }, [])

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      await loadFirm(data.session)
      if (alive) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Se difiere para no bloquear el callback de auth con otra llamada a Supabase.
      setTimeout(() => { void loadFirm(s) }, 0)
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [loadFirm])

  const value = useMemo<Ctx>(() => ({
    session, firm, portal, loading,
    refresh: async () => { await loadFirm(session) },
    signOut: async () => { await supabase.auth.signOut(); setFirm(null); setPortal(false) },
  }), [session, firm, portal, loading, loadFirm])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth(): Ctx {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth fuera de AuthProvider')
  return c
}
export function useFirmId(): string {
  const { firm } = useAuth()
  if (!firm) throw new Error('Sin despacho')
  return firm.id
}

import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { configured } from './lib/supabase'
import { Layout } from './components/Layout'
import { Spinner } from './components/ui'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Followups from './pages/Followups'
import LeadProfile from './pages/LeadProfile'
import Clients from './pages/Clients'
import Cases from './pages/Cases'
import Agenda from './pages/Agenda'
import Billing from './pages/Billing'
import Documents from './pages/Documents'

function Setup() {
  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-2 font-display text-2xl text-navy-800">Falta conectar Supabase</h1>
      <p className="text-sm text-silver-500">Crea un archivo <code>.env</code> con <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> (o agrégalos como variables de entorno en Vercel) y vuelve a cargar.</p>
    </div>
  )
}

export default function App() {
  const { session, firm, loading } = useAuth()
  if (!configured) return <Setup />
  if (loading) return <Spinner />
  if (!session) return <Login />
  if (!firm) return <Onboarding />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadProfile />} />
        <Route path="seguimiento" element={<Followups />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="expedientes" element={<Cases />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="cobranza" element={<Billing />} />
        <Route path="documentos" element={<Documents />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'gold' }) {
  const v = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700',
    gold: 'bg-gold-400 text-navy-950 hover:bg-gold-300',
    ghost: 'border border-silver-200 bg-white text-navy-900 hover:bg-silver-100',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variant]
  return <button type="button" {...p} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${v} ${focus} ${className}`} />
}

const field = `w-full min-w-0 rounded-lg border border-silver-200 bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-silver-500 ${focus}`
export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-silver-500">{label}</span>
      {children}
    </label>
  )
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${field} ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${field} ${p.className ?? ''}`} />
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${field} min-h-20 ${p.className ?? ''}`} />

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`mt-[4vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-xl border border-silver-200 bg-white p-5 shadow-xl`}>
        <h2 className="mb-4 font-display text-lg tracking-wide text-navy-800">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'red' | 'amber' | 'green' | 'blue' }) {
  const t = {
    gray: 'bg-silver-100 text-navy-800', red: 'bg-red-100 text-red-800', amber: 'bg-amber-100 text-amber-800',
    green: 'bg-emerald-100 text-emerald-800', blue: 'bg-blue-100 text-blue-800',
  }[tone]
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${t}`}>{children}</span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-silver-200 bg-white px-5 py-10 text-center text-sm text-silver-500">
      <b className="mb-1 block text-base text-navy-900">{title}</b>{children}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl tracking-wide text-navy-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-silver-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Stat({ label, value, tone = 'normal' }: { label: string; value: ReactNode; tone?: 'normal' | 'alert' }) {
  return (
    <div className="min-w-0 rounded-xl border border-silver-200 bg-white px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-silver-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-bold tabular-nums ${tone === 'alert' ? 'text-red-700' : 'text-navy-800'}`}>{value}</div>
    </div>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
}
export const Spinner = () => <div className="p-8 text-center text-sm text-silver-500">Cargando…</div>

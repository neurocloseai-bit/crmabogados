import { Icon, type IconName } from './icons'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'gold' }) {
  const v = {
    primary: 'bg-navy-800 text-white shadow-sm hover:bg-navy-700 hover:shadow-md',
    gold: 'bg-gradient-to-b from-gold-300 to-gold-400 text-navy-950 shadow-sm hover:from-gold-300 hover:to-gold-300 hover:shadow-md',
    ghost: 'border border-silver-200 bg-white text-navy-900 hover:bg-silver-100',
    danger: 'border border-red-300 bg-white text-red-700 hover:bg-red-50',
  }[variant]
  return <button type="button" {...p} className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${v} ${focus} ${className}`} />
}

const field = `w-full min-w-0 rounded-lg border border-silver-200 bg-white px-3 py-2.5 text-sm text-navy-900 shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition-colors placeholder:text-silver-500 hover:border-silver-500/40 ${focus}`
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/60 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`mt-[4vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl border border-silver-200 bg-white p-6 shadow-2xl animate-rise`}>
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
    <div className="rounded-2xl border border-dashed border-silver-200 bg-white/70 px-5 py-10 text-center text-sm text-silver-500">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-gold-300/30 text-gold-500"><Icon name="scales" /></span>
      <b className="mb-1 block text-base text-navy-900">{title}</b>{children}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl tracking-wide text-navy-800">{title}<span className="mt-1.5 block h-0.5 w-10 rounded bg-gold-400" /></h1>
        {subtitle && <p className="mt-2 text-sm text-silver-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Stat({ label, value, tone = 'normal', icon }: { label: string; value: ReactNode; tone?: 'normal' | 'alert'; icon?: IconName }) {
  const alert = tone === 'alert'
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-silver-200 bg-white p-4 shadow-card animate-rise">
      <span className={`absolute inset-y-0 left-0 w-1 ${alert ? 'bg-red-500' : 'bg-gold-400'}`} />
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-silver-500">{label}</div>
        {icon && <span className={`grid h-8 w-8 flex-none place-items-center rounded-lg ${alert ? 'bg-red-50 text-red-600' : 'bg-navy-800/5 text-navy-800'}`}><Icon name={icon} className="h-4 w-4" /></span>}
      </div>
      <div className={`mt-2 text-3xl font-bold tabular-nums ${alert ? 'text-red-700' : 'text-navy-800'}`}>{value}</div>
    </div>
  )
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null
  return <div role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>
}
export const Spinner = () => <div className="p-8 text-center text-sm text-silver-500">Cargando…</div>

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })
export const mxn = (n: number | null | undefined) => money.format(n ?? 0)

export function parseDay(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const today = () => ymd(new Date())
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)
}
export function fdate(s: string | null | undefined, withYear = false): string {
  if (!s) return ''
  return parseDay(s).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}
export function addDays(s: string, n: number): string {
  const d = parseDay(s); d.setDate(d.getDate() + n); return ymd(d)
}
export function addMonths(s: string, n: number): string {
  const d = parseDay(s); const day = d.getDate()
  d.setDate(1); d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last)); return ymd(d)
}
/** Suma días hábiles (sin sábados, domingos ni los inhábiles dados), contando desde el día siguiente. */
export function addBusinessDays(start: string, n: number, holidays: Set<string>): string {
  const d = parseDay(start); let c = 0, guard = 0
  while (c < n && guard < 4000) {
    d.setDate(d.getDate() + 1); guard++
    const w = d.getDay()
    if (w !== 0 && w !== 6 && !holidays.has(ymd(d))) c++
  }
  return ymd(d)
}
export function waLink(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  return `https://wa.me/${digits.length === 10 ? '52' + digits : digits}`
}
export function fileSize(n: number | null | undefined): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}
export function safeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120)
}

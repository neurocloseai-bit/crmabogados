import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  home: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5" />,
  leads: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5M16.5 5.2a3.2 3.2 0 0 1 0 5.6M18 14.8c1.8.5 2.8 2.1 3 4.7" /></>,
  follow: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8.5 14.5l2.2 2.2 4.3-4.4" /></>,
  clients: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.5-3.8 3.3-6 7-6s6.5 2.2 7 6" /></>,
  cases: <><path d="M3.5 7.5A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19A1.5 1.5 0 0 1 20.5 9.7V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z" /></>,
  agenda: <><path d="M12 3v2M5 8h14M7.5 21h9M12 5a6.5 6.5 0 0 1 6.5 6.5c0 3.5.8 4.8 1.5 5.5H4c.7-.7 1.5-2 1.5-5.5A6.5 6.5 0 0 1 12 5z" /></>,
  money: <><circle cx="12" cy="12" r="8.5" /><path d="M14.7 9.2c-.4-.9-1.4-1.4-2.7-1.4-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2.1 2.7.9 2.7 2.1-1.1 2-2.7 2c-1.4 0-2.4-.6-2.8-1.6M12 6.2v1.6M12 16.2v1.6" /></>,
  docs: <><path d="M6.5 3.5h7.2L18.5 8.3V19a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM13.5 3.7V8.5H18.4M8.5 12.5h7M8.5 16h7" /></>,
  scales: <path d="M12 4v16M7 20h10M5 8h14M5 8l-2.5 6a3 3 0 0 0 5 0zM19 8l-2.5 6a3 3 0 0 0 5 0z" />,
  out: <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14M10 12h10M17 8.5l3.5 3.5-3.5 3.5" />,
  shield: <path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.4 7 9 4.2-1.6 7-4.8 7-9V6zM9 12l2.2 2.2L15.2 10" />,
  bolt: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6z" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  alert: <path d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17.2v.1" />,
}

export type IconName = keyof typeof P
export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{P[name]}</svg>
  )
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <span className="grid flex-none place-items-center rounded-xl bg-gradient-to-br from-gold-300 to-gold-500 text-navy-950 shadow-lg shadow-black/20" style={{ width: size, height: size }}>
      <Icon name="scales" className="h-[58%] w-[58%]" />
    </span>
  )
}

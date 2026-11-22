import type { ReactNode } from 'react'

/** كارت عادي (اتشال منه ميلان الـ 3D واللمعة) */
export function HoloCard({ children, className = '' }: { children: ReactNode; className?: string; strength?: number }) {
  return <div className={`holo ${className}`}>{children}</div>
}
/** اتشالت منصّة الحلقات (كريستال) */
export function HoloPodium() {
  return null
}

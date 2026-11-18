'use client'

import { LayoutGroup, MotionConfig, motion } from 'framer-motion'

export type DockItem = { id: string | null; label: string }

/** دوك زجاجي عايم بمؤشر متوهج بينتقل بين الأقسام (انتقال spring على layoutId) */
export function GlassDock({ items, active, onSelect, label }: { items: DockItem[]; active: string | null; onSelect: (id: string | null) => void; label: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="glass-dock">
        <div className="glass-dock" role="group" aria-label={label}>
          {items.map((item) => {
            const on = item.id === active
            return (
              <button key={item.id ?? 'all'} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => onSelect(item.id)}>
                {on && <motion.span layoutId="dock-glow" className="glass-dock-glow" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <span className="glass-dock-label">{item.label}</span>
              </button>
            )
          })}
        </div>
      </LayoutGroup>
    </MotionConfig>
  )
}

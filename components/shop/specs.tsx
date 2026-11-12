'use client'

import { PLACEHOLDERS } from '@/lib/config'
import type { Product } from './types'

export function Specs({ product }: { product: Product }) {
  const rows: Array<[string, string | null | undefined, string]> = [
    ['البطارية', product.battery, PLACEHOLDERS.battery],
    ['الضمان', product.warranty, PLACEHOLDERS.warranty],
    ['محتويات العلبة', product.boxContents, PLACEHOLDERS.box],
  ]
  return (
    <dl className="specs">
      {rows.map(([label, value, placeholder]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={value ? '' : 'todo'}>{value || placeholder}</dd>
        </div>
      ))}
    </dl>
  )
}

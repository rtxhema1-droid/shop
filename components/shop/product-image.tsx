'use client'

import Image from 'next/image'
import { ImageOff } from 'lucide-react'
import { PLACEHOLDERS } from '@/lib/config'

/**
 * صورة المنتج الفعلي فقط. لو مفيش صورة بنعرض عنصر نائب واضح بين أقواس (مفيش صور مولّدة ولا إيموجي).
 * الحجم الصحيح بيتطلب عن طريق sizes + محمّل lib/image-loader.ts (WebP بأحجام 480/800/1200).
 */
export function ProductImage({ src, alt, sizes, priority = false, showPlaceholderText = true }: { src: string | null | undefined; alt: string; sizes: string; priority?: boolean; showPlaceholderText?: boolean }) {
  if (!src) {
    return (
      <span className="img-ph" role="img" aria-label={`${alt} — لا توجد صورة`}>
        <ImageOff aria-hidden="true" />
        {showPlaceholderText && <span>{PLACEHOLDERS.image}</span>}
      </span>
    )
  }
  return <Image src={src} alt={alt} fill sizes={sizes} className="img-fill" priority={priority} loading={priority ? undefined : 'lazy'} />
}

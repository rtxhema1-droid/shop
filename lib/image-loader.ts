// محمّل صور next/image: بيختار أقرب حجم من (480 / 800 / 1200) من غير ما نعتمد على خدمة خارجية.
const BUCKETS = [480, 800, 1200]

export default function imageLoader({ src, width }: { src: string; width: number; quality?: number }) {
  const bucket = BUCKETS.find((size) => size >= width) ?? 1200
  // صور الداتابيز (المسار القديم): السيرفر بيقدّمها WebP بالحجم المطلوب
  if (src.startsWith('/api/products/')) return `${src}${src.includes('?') ? '&' : '?'}w=${bucket}`
  // صور مخزن الصور: اسم الملف بينتهي بالحجم
  if (/-(480|800|1200)\.webp$/.test(src)) return src.replace(/-(480|800|1200)\.webp$/, `-${bucket}.webp`)
  // أي رابط خارجي بيفضل زي ما هو
  return src
}

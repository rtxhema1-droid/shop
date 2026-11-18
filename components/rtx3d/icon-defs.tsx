/**
 * تدرّجات مشتركة لخطوط الأيقونات (CSS: stroke: url(#rtx-ig)).
 * userSpaceOnUse على إحداثيات 24x24 عشان الخطوط المستقيمة (زي + و −) تتلوّن برضه.
 */
export function IconDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <linearGradient id="rtx-ig" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0" stopColor="#00F0FF" />
          <stop offset="1" stopColor="#B77BFF" />
        </linearGradient>
        <linearGradient id="rtx-ig-hot" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="22" y2="22">
          <stop offset="0" stopColor="#FFC857" />
          <stop offset="1" stopColor="#00F0FF" />
        </linearGradient>
      </defs>
    </svg>
  )
}

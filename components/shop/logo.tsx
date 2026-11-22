/** لوجو RTX SHOP: علامة (جناحين) + الاسم. نفس الشكل في المقدمة والهيدر والفوتر. */
export function LogoMark() {
  return (
    <svg className="zmark" viewBox="0 0 52 36" aria-hidden="true">
      <path d="M2 7 31 2.5Q38 1.5 38 8.5V11L2 16Z" fill="#CCD0CF" />
      <path d="M7 19 38 14V22Q38 28 31 29L7 33Z" fill="#9BA8AB" />
      <path d="M41 9h5q5 0 5 5v8q0 5-5 5h-5Z" fill="#4A5C6A" />
    </svg>
  )
}

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`zlogo ${className}`} aria-hidden="true">
      <LogoMark />
      <span className="zlogo-word"><span>RTX</span><b>SHOP</b></span>
    </span>
  )
}

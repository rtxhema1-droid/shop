/** رقم موبايل مصري: 01XXXXXXXXX (بنقبل +20 و 0020 والأرقام العربية). بيرجع null لو مش صحيح. */
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
}

export function parseEgyptianPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let digits = normalizeDigits(value).replace(/[\s\-().]/g, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('0020')) digits = digits.slice(4)
  else if (digits.startsWith('20') && digits.length === 12) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`
  return /^01[0125]\d{8}$/.test(digits) ? digits : null
}

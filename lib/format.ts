import { CURRENCY_LABEL, WHATSAPP_NUMBER } from '@/lib/config'
import { toWhatsAppNumber } from '@/lib/phone'

/** المبالغ متخزنة بالقرش (1 جنيه = 100 قرش) */
export function money(cents: unknown) {
  const value = Number(cents ?? 0) / 100
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${CURRENCY_LABEL}`
}

export function dateLabel(value: unknown) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }).format(new Date(String(value)))
}

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

/** رابط واتساب لرقم عميل معيّن برسالة جاهزة (null لو الرقم مش صحيح) */
export function customerWhatsappLink(phone: unknown, message: string) {
  const number = toWhatsAppNumber(phone)
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null
}

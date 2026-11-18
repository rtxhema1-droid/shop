import { STORE_NAME } from '@/lib/config'

/** رسايل إشعار العميل بحالة الطلب (بتتستخدم في رابط wa.me وفي واتساب الرسمي). آمنة تتحمّل في المتصفح. */
export type NotifiableStatus = 'accepted' | 'rejected' | 'delivered'

export const isNotifiableStatus = (status: string): status is NotifiableStatus => status === 'accepted' || status === 'rejected' || status === 'delivered'

/** الجملة اللي بتكمّل «طلبك رقم X …» */
export const STATUS_PHRASE: Record<NotifiableStatus, string> = {
  accepted: 'اتقبل وبنجهّزه للشحن',
  rejected: 'للأسف اترفض',
  delivered: 'اتسلّم',
}

export function orderStatusMessage(status: NotifiableStatus, order: { customerName: string; code: string }) {
  const name = order.customerName.trim().split(/\s+/)[0] || 'عميلنا'
  const head = `أهلاً ${name}، معاك ${STORE_NAME}.`
  if (status === 'accepted') return `${head}\nطلبك رقم ${order.code} اتقبل وبنجهّزه للشحن. هنتواصل معاك لتأكيد ميعاد التوصيل، والدفع كاش عند الاستلام.`
  if (status === 'rejected') return `${head}\nللأسف مقدرناش ننفّذ طلبك رقم ${order.code}. لو عايز بديل أو عندك أي استفسار ابعتلنا هنا وهنساعدك.`
  return `${head}\nطلبك رقم ${order.code} اتسلّم. شكراً لثقتك فينا، ولو عندك أي ملاحظة ابعتلنا هنا.`
}

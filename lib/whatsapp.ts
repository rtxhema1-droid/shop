import { STATUS_PHRASE, orderStatusMessage, type NotifiableStatus } from '@/lib/order-messages'
import { toWhatsAppNumber } from '@/lib/phone'

/**
 * إرسال إشعار حالة الطلب عن طريق واجهة واتساب الرسمية (WhatsApp Cloud API) — اختياري.
 * بيشتغل بس لو المتغيّرات دي متضبطة: WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID.
 *  - مع WHATSAPP_TEMPLATE_NAME: بيبعت قالب معتمد (يشتغل في أي وقت). القالب لازم يكون فيه 3 متغيّرات في الـ body:
 *    {{1}} اسم العميل، {{2}} رقم الطلب، {{3}} حالة الطلب. اللغة من WHATSAPP_TEMPLATE_LANG (الافتراضي ar).
 *  - من غير قالب: بيبعت رسالة نصية عادية، وواتساب بيقبلها بس لو العميل كلّمك خلال آخر 24 ساعة.
 * لو الإرسال فشل لأي سبب، الطلب نفسه بيكمل عادي والواجهة بتعرض رابط wa.me جاهز بدل كده.
 */
export const whatsappApiEnabled = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)

export async function sendOrderStatusWhatsApp(order: { customerName: string; customerPhone: string; code: string }, status: NotifiableStatus) {
  if (!whatsappApiEnabled()) return false
  const to = toWhatsAppNumber(order.customerPhone)
  if (!to) return false
  const template = process.env.WHATSAPP_TEMPLATE_NAME
  const name = order.customerName.trim().split(/\s+/)[0] || 'عميلنا'
  const body = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || 'ar' },
          components: [{ type: 'body', parameters: [name, order.code, STATUS_PHRASE[status]].map((text) => ({ type: 'text', text })) }],
        },
      }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: orderStatusMessage(status, order) } }
  try {
    const version = process.env.WHATSAPP_API_VERSION || 'v21.0'
    const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4000),
    })
    if (!response.ok) {
      console.error('[rtx-shop-whatsapp]', response.status, (await response.text().catch(() => '')).slice(0, 300))
      return false
    }
    return true
  } catch (error) {
    console.error('[rtx-shop-whatsapp]', error)
    return false
  }
}

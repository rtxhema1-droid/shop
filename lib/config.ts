// إعدادات عامة (آمنة تتحمّل في المتصفح)
export const STORE_NAME = 'RTX SHOP'
export const WHATSAPP_NUMBER = '201203601981' // +20 120 360 1981
export const WHATSAPP_DISPLAY = '0120 360 1981'
export const CURRENCY = 'EGP'
export const CURRENCY_LABEL = 'ج.م'
export const MAX_QTY_PER_PRODUCT = 10

/**
 * الوعد الوحيد اللي بيتكرر في الهيدر والهيرو والفوتر وشاشة الدخول.
 * مكتوب هنا مرة واحدة عشان يتغير من مكان واحد. مفيش فيه غير اللي الكود نفسه بيثبته
 * (الدفع كاش عند الاستلام + محافظات الشحن الموجودة في الداتابيز).
 * لو المالك أكد ضمان على المنتجات، يضيفه هنا.
 */
export const PROMISE = 'الدفع كاش عند الاستلام'
export const PROMISE_SUB = 'شحن لكل محافظات مصر'

/** عناصر نائبة: المالك هو اللي يملاها قبل النشر. ما بنخترعش بيانات. */
export const PLACEHOLDERS = {
  warranty: '[مدة الضمان — يكتبها المالك]',
  delivery: '[مدة التوصيل — يحددها المالك]',
  battery: '[البطارية — يكتبها المالك]',
  box: '[محتويات العلبة — يكتبها المالك]',
  image: '[صورة المنتج الفعلي]',
} as const

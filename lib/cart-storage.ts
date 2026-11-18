import { MAX_QTY_PER_PRODUCT } from '@/lib/config'

/** السلة متخزنة في المتصفح (localStorage) كخريطة { productId: quantity } — مشتركة بين المتجر وصفحة المنتج. */
export const CART_KEY = 'rtx-cart'
export type StoredCart = Record<string, number>

export function readStoredCart(): StoredCart {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || '{}')
    const clean: StoredCart = {}
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const [id, qty] of Object.entries(saved as Record<string, unknown>)) {
        if (typeof qty === 'number' && Number.isInteger(qty) && qty > 0) clean[id] = Math.min(qty, MAX_QTY_PER_PRODUCT)
      }
    }
    return clean
  } catch {
    return {}
  }
}

export function storedCartCount() {
  return Object.values(readStoredCart()).reduce((sum, qty) => sum + qty, 0)
}

/** بيضيف للسلة المخزنة (بحد المخزون والحد الأقصى للكمية) ويرجّع إجمالي عدد القطع */
export function addToStoredCart(product: { id: string; stock: number }, quantity = 1) {
  const cart = readStoredCart()
  cart[product.id] = Math.min((cart[product.id] ?? 0) + quantity, product.stock, MAX_QTY_PER_PRODUCT)
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart))
  } catch {
    /* تجاهل */
  }
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0)
}

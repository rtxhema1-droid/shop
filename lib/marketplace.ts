import { getDb, makeId, nowIso, placeholders, tx, type Db, type Row } from '@/lib/db'
import { burnVerify, hashPassword, verifyPassword } from '@/lib/security'
import { MAX_QTY_PER_PRODUCT } from '@/lib/config'
import { migrateLegacyImages, parseDataUrl, resizeLegacyImage, snapWidth, storeUploadedImage } from '@/lib/image-store'
import {
  ApiError,
  getVendorPermissions,
  hasVendorPermission,
  vendorPermissionKeys,
  type SessionUser,
  type VendorPermission,
} from '@/lib/store'
import {
  cleanImageData,
  cleanImageUrl,
  cleanText,
  cleanUsername,
  normalizePhone,
  optionalEmail,
  optionalSpec,
  optionalText,
  requirePassword,
  toCents,
  toDeliveryDays,
  toPercent,
  toStock,
} from '@/lib/validate'

type Json = Record<string, unknown>

/** عمولة المنصة الافتراضية لمنتجات التجار (المالك بيعدلها لكل منتج) */
export const DEFAULT_VENDOR_COMMISSION = 10

// ───────────────────────── الحسابات ─────────────────────────

const WINDOW_MS = 10 * 60 * 1000

/** بيحسب المحاولات الأخيرة تحت مفتاح معين، ولو عدّت الحد بيرفض */
async function assertBelowLimit(db: Db, key: string, limit: number, message: string) {
  const since = new Date(Date.now() - WINDOW_MS).toISOString()
  const row = await db.get<{ total: number }>('SELECT COUNT(*) AS total FROM login_attempts WHERE identifier = ? AND created_at > ?', [key, since])
  if (Number(row?.total ?? 0) >= limit) throw new ApiError(429, message)
}

async function recordAttempt(db: Db, key: string) {
  await db.run('INSERT INTO login_attempts (id, identifier, created_at) VALUES (?, ?, ?)', [makeId(), key, nowIso()])
  if (Math.random() < 0.05) await db.run('DELETE FROM login_attempts WHERE created_at < ?', [new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()])
}

export async function signUpCustomer(input: Json, ip = 'unknown') {
  const db = await getDb()
  await assertBelowLimit(db, `signup:${ip}`, 6, 'عملت حسابات كتير في وقت قصير — استنى شوية وجرب تاني')
  const name = cleanText(input.name, 'الاسم', 100)
  const phone = normalizePhone(input.phone)
  const email = optionalEmail(input.email)
  const password = requirePassword(input.password)
  const exists = await db.get('SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)', [phone, email])
  if (exists) throw new ApiError(409, 'الرقم ده (أو الإيميل) متسجل قبل كده — جرب تسجل دخول')
  const id = makeId()
  try {
    await db.run(
      `INSERT INTO users (id, name, username, email, password_hash, role, phone, created_at) VALUES (?, ?, ?, ?, ?, 'user', ?, ?)`,
      [id, name, phone, email, hashPassword(password), phone, nowIso()],
    )
  } catch {
    // تسجيلين في نفس اللحظة بنفس الرقم — القيد الفريد في الداتابيز بيمنع التكرار
    throw new ApiError(409, 'الرقم ده (أو الإيميل) متسجل قبل كده — جرب تسجل دخول')
  }
  await recordAttempt(db, `signup:${ip}`)
  return id
}

export async function authenticate(identifierRaw: unknown, passwordRaw: unknown, ip = 'unknown') {
  const db = await getDb()
  const raw = cleanText(identifierRaw, 'رقم الموبايل أو اسم المستخدم', 254).toLowerCase()
  const password = typeof passwordRaw === 'string' ? passwordRaw.slice(0, 200) : ''
  let phone = raw
  try {
    phone = normalizePhone(raw)
  } catch {
    phone = raw
  }
  const tooMany = 'حاولت كتير غلط — استنى 10 دقايق وجرب تاني'
  // الحد على الجهاز نفسه + الحساب (عشان حد غريب ميقفلش حساب غيره)، وحد عام على الجهاز، وحد أعلى على الحساب من أي مكان
  await assertBelowLimit(db, `ip:${ip}`, 30, tooMany)
  await assertBelowLimit(db, `ipid:${ip}|${raw}`, 6, tooMany)
  await assertBelowLimit(db, raw, 40, tooMany)
  const user = await db.get<{ id: string; passwordHash: string }>(
    'SELECT id, password_hash FROM users WHERE username = ? OR username = ? OR email = ?',
    [raw, phone, raw],
  )
  if (!user) burnVerify(password)
  if (!user || !verifyPassword(password, user.passwordHash)) {
    await recordAttempt(db, `ip:${ip}`)
    await recordAttempt(db, `ipid:${ip}|${raw}`)
    await recordAttempt(db, raw)
    throw new ApiError(401, 'البيانات غلط — اتأكد من الرقم/اسم المستخدم وكلمة السر')
  }
  await db.run('DELETE FROM login_attempts WHERE identifier = ?', [`ipid:${ip}|${raw}`])
  return user.id
}

export async function changePassword(user: SessionUser, current: unknown, next: unknown) {
  const db = await getDb()
  const row = await db.get<{ passwordHash: string }>('SELECT password_hash FROM users WHERE id = ?', [user.id])
  if (!row || typeof current !== 'string' || !verifyPassword(current, row.passwordHash)) throw new ApiError(400, 'كلمة السر الحالية غلط')
  const password = requirePassword(next)
  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hashPassword(password), user.id])
  await db.run('DELETE FROM sessions WHERE user_id = ?', [user.id])
}

function parsePermissions(value: unknown): Set<VendorPermission> {
  const requested = value === undefined ? [...vendorPermissionKeys] : value
  if (!Array.isArray(requested) || requested.some((item) => typeof item !== 'string' || !vendorPermissionKeys.includes(item as VendorPermission))) {
    throw new ApiError(400, 'الصلاحيات مش صحيحة')
  }
  const permissions = new Set(requested as VendorPermission[])
  if (permissions.has('manage_orders')) permissions.add('view_orders')
  return permissions
}

export async function createVendor(input: Json) {
  const name = cleanText(input.name, 'اسم التاجر', 100)
  const storeName = cleanText(input.storeName, 'اسم المتجر', 120)
  const username = cleanUsername(input.username)
  const phone = normalizePhone(input.phone)
  const storeAddress = cleanText(input.storeAddress, 'عنوان المتجر', 240)
  const email = optionalEmail(input.email)
  const password = requirePassword(input.password)
  const permissions = parsePermissions(input.permissions)
  const id = makeId()
  await tx(async (db) => {
    if (await db.get('SELECT id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)', [username, email])) {
      throw new ApiError(409, 'اسم المستخدم (أو الإيميل) ده مستخدم قبل كده')
    }
    await db.run(
      `INSERT INTO users (id, name, username, email, password_hash, role, phone, store_name, store_address, created_at) VALUES (?, ?, ?, ?, ?, 'vendor', ?, ?, ?, ?)`,
      [id, name, username, email, hashPassword(password), phone, storeName, storeAddress, nowIso()],
    )
    for (const permission of vendorPermissionKeys) {
      await db.run('INSERT INTO vendor_permissions (user_id, permission, enabled) VALUES (?, ?, ?)', [id, permission, permissions.has(permission) ? 1 : 0])
    }
  })
  return id
}

export async function updateVendorPermissions(vendorId: string, input: Json) {
  const db = await getDb()
  if (!(await db.get(`SELECT id FROM users WHERE id = ? AND role = 'vendor'`, [vendorId]))) throw new ApiError(404, 'التاجر مش موجود')
  if (!Array.isArray(input.permissions)) throw new ApiError(400, 'الصلاحيات مش صحيحة')
  const permissions = parsePermissions(input.permissions)
  await tx(async (t) => {
    await t.run('DELETE FROM vendor_permissions WHERE user_id = ?', [vendorId])
    for (const permission of vendorPermissionKeys) {
      await t.run('INSERT INTO vendor_permissions (user_id, permission, enabled) VALUES (?, ?, ?)', [vendorId, permission, permissions.has(permission) ? 1 : 0])
    }
  })
  return getVendorPermissions(vendorId)
}

// ───────────────────────── الأقسام ─────────────────────────

export async function getCategories() {
  const db = await getDb()
  return db.all('SELECT id, name, parent_id, icon, sort_order FROM categories ORDER BY sort_order, name')
}

function cleanIcon(value: unknown, fallback: string) {
  const icon = typeof value === 'string' ? value.trim().slice(0, 8) : ''
  return icon || fallback
}

export async function createCategory(input: Json) {
  const db = await getDb()
  const name = cleanText(input.name, 'اسم القسم', 80)
  const parentId = typeof input.parentId === 'string' && input.parentId ? input.parentId : null
  let fallbackIcon = '🛍️'
  if (parentId) {
    const parent = await db.get<{ icon: string; parentId: string | null }>('SELECT icon, parent_id FROM categories WHERE id = ?', [parentId])
    if (!parent) throw new ApiError(404, 'القسم الرئيسي مش موجود')
    if (parent.parentId) throw new ApiError(400, 'مسموح بمستوى واحد بس من الأقسام الفرعية')
    fallbackIcon = parent.icon
  }
  const duplicate = await db.get('SELECT id FROM categories WHERE name = ? AND COALESCE(parent_id, \'\') = ?', [name, parentId ?? ''])
  if (duplicate) throw new ApiError(409, 'القسم ده موجود بالفعل')
  const last = await db.get<{ top: number | null }>('SELECT MAX(sort_order) AS top FROM categories WHERE COALESCE(parent_id, \'\') = ?', [parentId ?? ''])
  const id = `cat-${makeId().slice(0, 8)}`
  await db.run('INSERT INTO categories (id, name, parent_id, icon, sort_order) VALUES (?, ?, ?, ?, ?)', [id, name, parentId, cleanIcon(input.icon, fallbackIcon), Number(last?.top ?? -1) + 1])
  return id
}

export async function updateCategory(id: string, input: Json) {
  const db = await getDb()
  const current = await db.get<{ icon: string }>('SELECT icon FROM categories WHERE id = ?', [id])
  if (!current) throw new ApiError(404, 'القسم مش موجود')
  const name = cleanText(input.name, 'اسم القسم', 80)
  await db.run('UPDATE categories SET name = ?, icon = ? WHERE id = ?', [name, cleanIcon(input.icon, current.icon), id])
}

export async function deleteCategory(id: string) {
  const db = await getDb()
  if (!(await db.get('SELECT id FROM categories WHERE id = ?', [id]))) throw new ApiError(404, 'القسم مش موجود')
  if (await db.get('SELECT id FROM categories WHERE parent_id = ? LIMIT 1', [id])) throw new ApiError(409, 'القسم ده فيه أقسام فرعية — امسحها الأول')
  if (await db.get('SELECT id FROM products WHERE category_id = ? LIMIT 1', [id])) throw new ApiError(409, 'القسم ده فيه منتجات — انقلها لقسم تاني الأول')
  await db.run('DELETE FROM categories WHERE id = ?', [id])
}

// ───────────────────────── الشحن ─────────────────────────

export async function getZones() {
  const db = await getDb()
  return db.all('SELECT id, name, shipping_fee_cents, delivery_days_min, delivery_days_max FROM zones ORDER BY sort_order, name')
}

export async function updateZoneFee(id: string, input: Json) {
  const db = await getDb()
  const fee = toCents(input.shippingFee, 'سعر الشحن')
  // مدة التوصيل اختيارية: لو مبعوتة بتتحدّث، ولو مش مبعوتة بتفضل زي ما هي
  const hasDays = 'deliveryDaysMin' in input || 'deliveryDaysMax' in input
  const days = hasDays ? toDeliveryDays(input.deliveryDaysMin, input.deliveryDaysMax) : null
  const result = days
    ? await db.run('UPDATE zones SET shipping_fee_cents = ?, delivery_days_min = ?, delivery_days_max = ? WHERE id = ?', [fee, days.min, days.max, id])
    : await db.run('UPDATE zones SET shipping_fee_cents = ? WHERE id = ?', [fee, id])
  if (!result.changes) throw new ApiError(404, 'المحافظة مش موجودة')
}

// ───────────────────────── المنتجات ─────────────────────────

const PRODUCT_FIELDS = `p.id, p.name, p.description, p.price_cents, p.old_price_cents, p.stock, p.category_id,
  p.image_url, p.updated_at, (p.image_data IS NOT NULL) AS has_image, p.vendor_id, u.store_name,
  p.battery, p.warranty, p.box_contents`

function shapeProduct(row: Row) {
  const { hasImage, imageUrl, active, ...rest } = row
  const shaped: Row = {
    ...rest,
    imageUrl: Boolean(hasImage) ? `/api/products/${row.id}/image?v=${encodeURIComponent(String(row.updatedAt))}` : (imageUrl ?? null),
  }
  if (active !== undefined) shaped.active = Number(active) === 1
  return shaped
}

/** المنتج اللي خلص مخزونه بيفضل ظاهر (stock = 0) والواجهة بتعرضه بحالة «نفد المخزون». الطلب نفسه بيترفض في createOrders لو المخزون مش كفاية. */
export async function getPublicProducts() {
  const db = await getDb()
  const rows = await db.all(
    `SELECT ${PRODUCT_FIELDS} FROM products p JOIN users u ON u.id = p.vendor_id
     WHERE p.active = 1 ORDER BY p.created_at DESC LIMIT 1000`,
  )
  return rows.map(shapeProduct)
}

export async function getProductImage(id: string, width?: unknown) {
  const db = await getDb()
  const row = await db.get<{ imageData: string | null }>('SELECT image_data FROM products WHERE id = ?', [id])
  const image = parseDataUrl(row?.imageData)
  if (!image) return null
  // من غير ?w= بنرجّع الأصلي (توافق مع الروابط القديمة)، ومعاه بنرجّع WebP مصغّر
  return width === undefined || width === null || width === '' ? image : resizeLegacyImage(image, snapWidth(width))
}

async function readProductInput(db: Db, input: Json) {
  const name = cleanText(input.name, 'اسم المنتج', 120)
  const categoryId = cleanText(input.categoryId, 'القسم', 80)
  if (!(await db.get('SELECT id FROM categories WHERE id = ?', [categoryId]))) throw new ApiError(400, 'القسم ده مش موجود')
  const priceCents = toCents(input.price, 'السعر')
  const oldPriceCents = input.oldPrice === '' || input.oldPrice === undefined || input.oldPrice === null ? null : toCents(input.oldPrice, 'السعر قبل الخصم')
  if (oldPriceCents !== null && oldPriceCents <= priceCents) throw new ApiError(400, 'السعر قبل الخصم لازم يبقى أكبر من سعر البيع')
  return {
    name,
    categoryId,
    description: optionalText(input.description, 3000),
    priceCents,
    oldPriceCents,
    stock: toStock(input.stock),
    imageUrl: cleanImageUrl(input.imageUrl),
    imageData: cleanImageData(input.imageData),
    battery: optionalSpec(input.battery),
    warranty: optionalSpec(input.warranty),
    boxContents: optionalSpec(input.boxContents, 400),
  }
}

async function assertSeller(db: Db, vendorId: string) {
  const seller = await db.get<{ role: string }>(`SELECT role FROM users WHERE id = ? AND role IN ('owner', 'vendor')`, [vendorId])
  if (!seller) throw new ApiError(404, 'التاجر مش موجود')
  return seller.role
}

export async function createProduct(actor: SessionUser, input: Json) {
  const db = await getDb()
  let vendorId: string
  if (actor.role === 'owner') {
    vendorId = typeof input.vendorId === 'string' && input.vendorId ? input.vendorId : actor.id
  } else if (actor.role === 'vendor') {
    if (!(await hasVendorPermission(actor.id, 'manage_products'))) throw new ApiError(403, 'معندكش صلاحية إدارة المنتجات')
    vendorId = actor.id
  } else {
    throw new ApiError(403, 'معندكش صلاحية إدارة المنتجات')
  }
  const sellerRole = await assertSeller(db, vendorId)
  const data = await readProductInput(db, input)
  let commission = sellerRole === 'owner' ? 0 : DEFAULT_VENDOR_COMMISSION
  if (actor.role === 'owner' && input.commissionPercent !== undefined && input.commissionPercent !== '') commission = toPercent(input.commissionPercent)
  const id = makeId()
  const now = nowIso()
  const stored = await storeUploadedImage(id, data.imageData, data.imageUrl)
  await db.run(
    `INSERT INTO products (id, vendor_id, category_id, name, description, price_cents, old_price_cents, stock, image_url, image_data, commission_percent, active, created_at, updated_at, battery, warranty, box_contents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    [id, vendorId, data.categoryId, data.name, data.description, data.priceCents, data.oldPriceCents, data.stock, stored.imageUrl, stored.imageData, commission, now, now, data.battery, data.warranty, data.boxContents],
  )
  return id
}

async function loadEditableProduct(actor: SessionUser, id: string) {
  const db = await getDb()
  const product = await db.get<{ vendorId: string }>('SELECT vendor_id FROM products WHERE id = ?', [id])
  if (!product) throw new ApiError(404, 'المنتج مش موجود')
  if (actor.role === 'vendor') {
    if (!(await hasVendorPermission(actor.id, 'manage_products'))) throw new ApiError(403, 'معندكش صلاحية إدارة المنتجات')
    if (product.vendorId !== actor.id) throw new ApiError(403, 'مينفعش تعدل منتجات تاجر تاني')
  } else if (actor.role !== 'owner') {
    throw new ApiError(403, 'معندكش صلاحية إدارة المنتجات')
  }
  return { db, product }
}

export async function updateProduct(actor: SessionUser, id: string, input: Json) {
  const { db, product } = await loadEditableProduct(actor, id)
  const data = await readProductInput(db, input)
  let vendorId = product.vendorId
  if (actor.role === 'owner' && typeof input.vendorId === 'string' && input.vendorId) {
    await assertSeller(db, input.vendorId)
    vendorId = input.vendorId
  }
  const sets = ['vendor_id = ?', 'category_id = ?', 'name = ?', 'description = ?', 'price_cents = ?', 'old_price_cents = ?', 'stock = ?', 'updated_at = ?', 'battery = ?', 'warranty = ?', 'box_contents = ?']
  const params: unknown[] = [vendorId, data.categoryId, data.name, data.description, data.priceCents, data.oldPriceCents, data.stock, nowIso(), data.battery, data.warranty, data.boxContents]
  if (input.clearImage === true) {
    sets.push('image_url = NULL', 'image_data = NULL')
  } else if (data.imageData) {
    const stored = await storeUploadedImage(id, data.imageData, null)
    sets.push('image_data = ?', 'image_url = ?')
    params.push(stored.imageData, stored.imageUrl)
  } else if (data.imageUrl) {
    sets.push('image_url = ?', 'image_data = NULL')
    params.push(data.imageUrl)
  }
  if (typeof input.active === 'boolean') {
    sets.push('active = ?')
    params.push(input.active ? 1 : 0)
  }
  if (actor.role === 'owner' && input.commissionPercent !== undefined && input.commissionPercent !== '') {
    sets.push('commission_percent = ?')
    params.push(toPercent(input.commissionPercent))
  }
  await db.run(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...params, id])
}

export async function setProductCommission(id: string, input: Json) {
  const db = await getDb()
  const result = await db.run('UPDATE products SET commission_percent = ? WHERE id = ?', [toPercent(input.percent), id])
  if (!result.changes) throw new ApiError(404, 'المنتج مش موجود')
}

export async function archiveProduct(actor: SessionUser, id: string) {
  const { db } = await loadEditableProduct(actor, id)
  await db.run('UPDATE products SET active = 0 WHERE id = ?', [id])
}

export async function setProductVisibility(actor: SessionUser, id: string, active: unknown) {
  if (typeof active !== 'boolean') throw new ApiError(400, 'حدّد هل المنتج يظهر في المتجر ولا لأ')
  const { db } = await loadEditableProduct(actor, id)
  await db.run('UPDATE products SET active = ?, updated_at = ? WHERE id = ?', [active ? 1 : 0, nowIso(), id])
}

export async function deleteProductPermanently(actor: SessionUser, id: string) {
  const { db } = await loadEditableProduct(actor, id)
  const used = await db.get<{ total: number }>('SELECT COUNT(*) AS total FROM order_items WHERE product_id = ?', [id])
  if (Number(used?.total ?? 0) > 0) throw new ApiError(409, 'المنتج ده ليه طلبات قبل كده، فاخفيه بدل ما تحذفه نهائياً')
  await db.run('DELETE FROM products WHERE id = ?', [id])
}

// ───────────────────────── الطلبات ─────────────────────────

async function notifyOwner(db: Db, kind: string, title: string, body: string, orderId: string | null) {
  await db.run('INSERT INTO notifications (id, order_id, kind, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)', [makeId(), orderId, kind, title, body, nowIso()])
}

type CartItem = { productId: string; name: string; priceCents: number; commission: number; quantity: number }

export async function createOrders(customer: SessionUser, input: Json) {
  const list = input.items
  if (!Array.isArray(list) || list.length === 0 || list.length > 30) throw new ApiError(400, 'السلة فاضية — ضيف منتج الأول')
  const phone = normalizePhone(input.phone ?? customer.phone, 'رقم الموبايل')
  const address = cleanText(input.address, 'العنوان', 300)
  const notes = optionalText(input.notes, 300)
  const zoneId = cleanText(input.zoneId, 'المحافظة', 80)
  const created = await tx(async (db) => {
    const zone = await db.get<{ id: string; name: string; shippingFeeCents: number }>('SELECT id, name, shipping_fee_cents FROM zones WHERE id = ?', [zoneId])
    if (!zone) throw new ApiError(400, 'المحافظة دي مش متاحة للتوصيل')
    const groups = new Map<string, { storeName: string; items: CartItem[] }>()
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') throw new ApiError(400, 'بيانات المنتج مش صحيحة')
      const entry = raw as Json
      const productId = cleanText(entry.productId, 'المنتج', 80)
      const quantity = Number(entry.quantity)
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY_PER_PRODUCT) throw new ApiError(400, `الكمية لازم تبقى من 1 لـ ${MAX_QTY_PER_PRODUCT}`)
      const product = await db.get<{ id: string; vendorId: string; name: string; priceCents: number; stock: number; commissionPercent: number; storeName: string }>(
        `SELECT p.id, p.vendor_id, p.name, p.price_cents, p.stock, p.commission_percent, u.store_name
         FROM products p JOIN users u ON u.id = p.vendor_id WHERE p.id = ? AND p.active = 1`,
        [productId],
      )
      if (!product) throw new ApiError(409, 'في منتج في السلة مبقاش متاح')
      const group = groups.get(product.vendorId) ?? { storeName: product.storeName, items: [] }
      const duplicate = group.items.find((item) => item.productId === productId)
      if (duplicate) {
        duplicate.quantity += quantity
        if (duplicate.quantity > MAX_QTY_PER_PRODUCT) throw new ApiError(400, `أقصى كمية من المنتج الواحد ${MAX_QTY_PER_PRODUCT}`)
      } else {
        group.items.push({ productId, name: product.name, priceCents: Number(product.priceCents), commission: Number(product.commissionPercent), quantity })
      }
      groups.set(product.vendorId, group)
    }
    const createdAt = nowIso()
    const summary: Array<{ id: string; code: string; storeName: string; subtotalCents: number; shippingFeeCents: number }> = []
    for (const [vendorId, group] of groups) {
      const subtotal = group.items.reduce((total, item) => total + item.priceCents * item.quantity, 0)
      const orderId = makeId()
      await db.run(
        `INSERT INTO orders (id, customer_id, vendor_id, zone_id, zone_name, customer_name, customer_phone, delivery_address, notes, status, subtotal_cents, shipping_fee_cents, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
        [orderId, customer.id, vendorId, zone.id, zone.name, customer.name, phone, address, notes, subtotal, Number(zone.shippingFeeCents), createdAt],
      )
      for (const item of group.items) {
        await db.run(
          'INSERT INTO order_items (id, order_id, product_id, product_name, unit_price_cents, quantity, commission_percent) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [makeId(), orderId, item.productId, item.name, item.priceCents, item.quantity, item.commission],
        )
        const stock = await db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.quantity, item.productId, item.quantity])
        if (!stock.changes) throw new ApiError(409, `المخزون مش كفاية لـ «${item.name}»`)
      }
      await notifyOwner(db, 'new_order', 'طلب جديد', `${customer.name} (${phone}) طلب ${group.items.length} منتج من ${group.storeName} — ${zone.name}`, orderId)
      summary.push({ id: orderId, code: orderId.slice(0, 8).toUpperCase(), storeName: group.storeName, subtotalCents: subtotal, shippingFeeCents: Number(zone.shippingFeeCents) })
    }
    return summary
  })
  return created
}

export async function updateOrderStatus(actor: SessionUser, orderId: string, action: unknown) {
  const db = await getDb()
  const order = await db.get<{ id: string; vendorId: string; status: string }>('SELECT id, vendor_id, status FROM orders WHERE id = ?', [orderId])
  if (!order) throw new ApiError(404, 'الطلب مش موجود')
  if (actor.role === 'vendor') {
    if (order.vendorId !== actor.id) throw new ApiError(403, 'مينفعش تدير طلب تاجر تاني')
    if (!(await hasVendorPermission(actor.id, 'manage_orders'))) throw new ApiError(403, 'معندكش صلاحية تحديث الطلبات')
  } else if (actor.role !== 'owner') {
    throw new ApiError(403, 'الإجراء ده للمالك والتاجر بس')
  }
  const next = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : action === 'deliver' ? 'delivered' : ''
  if (!next) throw new ApiError(400, 'الإجراء مش معروف')
  if ((next === 'accepted' || next === 'rejected') && order.status !== 'new') throw new ApiError(409, 'الطلب ده اتعمله إجراء قبل كده')
  if (next === 'delivered' && order.status !== 'accepted') throw new ApiError(409, 'لازم تقبل الطلب الأول قبل ما تأكد التسليم')
  return tx(async (t) => {
    const now = nowIso()
    if (next === 'delivered') {
      const changed = await t.run(`UPDATE orders SET status = 'delivered', delivered_at = ? WHERE id = ? AND status = 'accepted'`, [now, orderId])
      if (!changed.changes) throw new ApiError(409, 'حالة الطلب اتغيرت — حدّث الصفحة وجرب تاني')
      const items = await t.all<{ unitPriceCents: number; quantity: number; commissionPercent: number }>(
        'SELECT unit_price_cents, quantity, commission_percent FROM order_items WHERE order_id = ?',
        [orderId],
      )
      const commission = items.reduce((sum, item) => sum + Math.round((Number(item.unitPriceCents) * Number(item.quantity) * Number(item.commissionPercent)) / 100), 0)
      if (commission > 0) {
        await t.run('INSERT INTO wallet_ledger (id, order_id, amount_cents, description, created_at) VALUES (?, ?, ?, ?, ?)', [makeId(), orderId, commission, `عمولة الطلب ${orderId.slice(0, 8).toUpperCase()}`, now])
        await t.run(`UPDATE wallet_accounts SET balance_cents = balance_cents + ?, updated_at = ? WHERE id = 'owner'`, [commission, now])
      }
      return { status: next, commissionCents: commission }
    }
    const changed = await t.run('UPDATE orders SET status = ? WHERE id = ? AND status = ?', [next, orderId, order.status])
    if (!changed.changes) throw new ApiError(409, 'حالة الطلب اتغيرت — حدّث الصفحة وجرب تاني')
    if (next === 'rejected') {
      const items = await t.all<{ productId: string; quantity: number }>('SELECT product_id, quantity FROM order_items WHERE order_id = ?', [orderId])
      for (const item of items) await t.run('UPDATE products SET stock = stock + ? WHERE id = ?', [Number(item.quantity), item.productId])
    }
    return { status: next, commissionCents: 0 }
  })
}

export async function verifyDelivery(customer: SessionUser, orderId: string, confirmed: unknown) {
  const answer = confirmed === true ? 'confirmed' : confirmed === false ? 'disputed' : null
  if (!answer) throw new ApiError(400, 'قولنا استلمت الطلب ولا لأ')
  const db = await getDb()
  const order = await db.get<{ customerId: string; status: string }>('SELECT customer_id, status FROM orders WHERE id = ?', [orderId])
  if (!order || order.customerId !== customer.id) throw new ApiError(404, 'الطلب مش موجود')
  if (order.status !== 'delivered') throw new ApiError(409, 'تقدر تأكد الاستلام بعد ما الطلب يتسلّم')
  await db.run(`UPDATE orders SET customer_verification = ? WHERE id = ? AND status = 'delivered'`, [answer, orderId])
  if (answer === 'disputed') {
    await notifyOwner(db, 'delivery_dispute', 'عميل بيقول إنه مستلمش', `${customer.name} بيقول إنه لسه مستلمش الطلب ${orderId.slice(0, 8).toUpperCase()}.`, orderId)
  }
  return answer
}

export async function markNotificationRead(id: string) {
  const db = await getDb()
  const result = await db.run('UPDATE notifications SET read_at = ? WHERE id = ?', [nowIso(), id])
  if (!result.changes) throw new ApiError(404, 'الإشعار مش موجود')
}

export async function markAllNotificationsRead() {
  const db = await getDb()
  await db.run('UPDATE notifications SET read_at = ? WHERE read_at IS NULL', [nowIso()])
}

// ───────────────────────── البيانات اللي بتظهر في الصفحات ─────────────────────────

/** بيانات المتجر العامة (أقسام + منتجات + محافظات) */
export async function getCatalog() {
  const [categories, products, zones] = await Promise.all([getCategories(), getPublicProducts(), getZones()])
  return { categories, products, zones }
}

async function loadOrders(db: Db, scope: string, params: unknown[], hideCommission: boolean) {
  const rows = await db.all(
    `SELECT o.id, o.status, o.customer_name, o.customer_phone, o.delivery_address, o.zone_name, o.notes,
       o.subtotal_cents, o.shipping_fee_cents, o.created_at, o.delivered_at, o.customer_verification,
       v.store_name, v.name AS vendor_name
     FROM orders o JOIN users v ON v.id = o.vendor_id ${scope}
     ORDER BY o.created_at DESC LIMIT 200`,
    params,
  )
  const ids = rows.map((row) => String(row.id))
  const items = ids.length
    ? await db.all(`SELECT order_id, product_id, product_name, unit_price_cents, quantity, commission_percent FROM order_items WHERE order_id IN (${placeholders(ids.length)})`, ids)
    : []
  return rows.map((order) => {
    const mine = items.filter((item) => item.orderId === order.id)
    const commissionCents = mine.reduce((sum, item) => sum + Math.round((Number(item.unitPriceCents) * Number(item.quantity) * Number(item.commissionPercent)) / 100), 0)
    return {
      ...order,
      items: mine.map((item) => ({
        productId: item.productId,
        name: item.productName,
        quantity: Number(item.quantity),
        unitPriceCents: Number(item.unitPriceCents),
        ...(hideCommission ? {} : { commissionPercent: Number(item.commissionPercent) }),
      })),
      ...(hideCommission ? {} : { commissionCents }),
    }
  })
}

export async function getDashboard(user: SessionUser) {
  const db = await getDb()
  const isOwner = user.role === 'owner'
  const isVendor = user.role === 'vendor'
  const permissions = isVendor ? await getVendorPermissions(user.id) : []
  const canViewOrders = isOwner || user.role === 'user' || permissions.includes('view_orders')
  const canManageProducts = isOwner || (isVendor && permissions.includes('manage_products'))
  const scope = isOwner ? '' : isVendor ? 'WHERE o.vendor_id = ?' : 'WHERE o.customer_id = ?'
  const scopeParams = isOwner ? [] : [user.id]

  const orders = canViewOrders ? await loadOrders(db, scope, scopeParams, user.role === 'user') : []

  let stats = { total: 0, pending: 0, accepted: 0, delivered: 0, salesCents: 0 }
  let commissionTotalCents = 0
  if (!isOwner && !isVendor) {
    stats = { total: orders.length, pending: 0, accepted: 0, delivered: 0, salesCents: 0 }
  } else if (canViewOrders) {
    const rows = await db.all<{ status: string; total: number; subtotal: number }>(
      `SELECT o.status, COUNT(*) AS total, COALESCE(SUM(o.subtotal_cents), 0) AS subtotal FROM orders o ${scope} GROUP BY o.status`,
      scopeParams,
    )
    for (const row of rows) {
      stats.total += Number(row.total)
      if (row.status === 'new') stats.pending = Number(row.total)
      if (row.status === 'accepted') stats.accepted = Number(row.total)
      if (row.status === 'delivered') {
        stats.delivered = Number(row.total)
        stats.salesCents = Number(row.subtotal)
      }
    }
    if (isVendor) {
      const commission = await db.get<{ total: number }>(
        'SELECT COALESCE(SUM(l.amount_cents), 0) AS total FROM wallet_ledger l JOIN orders o ON o.id = l.order_id WHERE o.vendor_id = ?',
        [user.id],
      )
      commissionTotalCents = Number(commission?.total ?? 0)
    }
  }

  let products: Row[] = []
  if (isOwner || (isVendor && canManageProducts)) {
    const rows = await db.all(
      `SELECT ${PRODUCT_FIELDS}, p.active, p.commission_percent
       FROM products p JOIN users u ON u.id = p.vendor_id
       ${isOwner ? '' : 'WHERE p.vendor_id = ? AND p.active = 1'}
       ORDER BY p.created_at DESC LIMIT 1000`,
      isOwner ? [] : [user.id],
    )
    products = rows.map(shapeProduct)
  }

  let vendors: Row[] = []
  let sellers: Row[] = []
  let wallet: Row | null = null
  let ledger: Row[] = []
  let notifications: Row[] = []
  let unreadCount = 0
  let weakOwnerPassword = false
  if (isOwner) {
    const owner = await db.get<{ passwordHash: string }>('SELECT password_hash FROM users WHERE id = ?', [user.id])
    weakOwnerPassword = Boolean(owner && verifyPassword('RTXHEMA3117', owner.passwordHash))
    const vendorRows = await db.all('SELECT id, name, username, phone, store_name, store_address, created_at FROM users WHERE role = \'vendor\' ORDER BY created_at DESC')
    const permissionRows = await db.all<{ userId: string; permission: string }>('SELECT user_id, permission FROM vendor_permissions WHERE enabled = 1')
    vendors = vendorRows.map((vendor) => ({ ...vendor, permissions: permissionRows.filter((row) => row.userId === vendor.id).map((row) => row.permission) }))
    sellers = [{ id: user.id, storeName: user.storeName ?? 'RTX Shop' }, ...vendorRows.map((vendor) => ({ id: vendor.id, storeName: vendor.storeName }))]
    wallet = (await db.get('SELECT balance_cents FROM wallet_accounts WHERE id = \'owner\'')) ?? { balanceCents: 0 }
    ledger = await db.all('SELECT id, order_id, amount_cents, description, created_at FROM wallet_ledger ORDER BY created_at DESC LIMIT 50')
    notifications = await db.all('SELECT id, order_id, kind, title, body, read_at, created_at FROM notifications ORDER BY created_at DESC LIMIT 40')
    const unread = await db.get<{ total: number }>('SELECT COUNT(*) AS total FROM notifications WHERE read_at IS NULL')
    unreadCount = Number(unread?.total ?? 0)
  }

  return { orders, stats, commissionTotalCents, products, vendors, sellers, wallet, ledger, notifications, unreadCount, permissions, weakOwnerPassword }
}

/** نقل الصور القديمة (base64 في الداتابيز) لمخزن الصور على دفعات. الصور القديمة بتفضل شغالة لحد ما تتنقل. */
export async function migrateProductImages(limit: unknown) {
  const batch = Math.min(Math.max(Number(limit) || 10, 1), 25)
  const db = await getDb()
  return migrateLegacyImages(db, batch)
}

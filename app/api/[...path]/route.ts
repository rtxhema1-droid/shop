import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { DbNotConfiguredError } from '@/lib/db'
import {
  ApiError,
  SESSION_COOKIE,
  destroySession,
  getCurrentUser,
  issueSession,
  requireRole,
} from '@/lib/store'
import {
  archiveProduct,
  authenticate,
  changePassword,
  createCategory,
  createOrders,
  createProduct,
  createVendor,
  deleteCategory,
  getCatalog,
  getDashboard,
  getProductImage,
  markAllNotificationsRead,
  markNotificationRead,
  migrateProductImages,
  setProductCommission,
  setProductVisibility,
  deleteProductPermanently,
  signUpCustomer,
  updateCategory,
  updateOrderStatus,
  updateProduct,
  updateVendorPermissions,
  updateZoneFee,
  verifyDelivery,
} from '@/lib/marketplace'
import { requirePassword } from '@/lib/validate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ path: string[] }> }
type JsonBody = Record<string, unknown>

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || request.headers.get('x-real-ip') || 'unknown'
  return ip.slice(0, 64)
}

async function readBody(request: NextRequest, limit = 64_000): Promise<JsonBody> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > limit * 2) throw new ApiError(413, 'حجم البيانات كبير أوي')
  const text = await request.text()
  if (text.length > limit) throw new ApiError(413, 'حجم البيانات كبير أوي')
  let value: unknown
  try {
    value = JSON.parse(text || '{}')
  } catch {
    throw new ApiError(400, 'صيغة البيانات غلط')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'البيانات مش صالحة')
  return value as JsonBody
}

function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  const requestOrigin = new URL(request.url).origin
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost || request.headers.get('host')
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, '')}:` : new URL(request.url).protocol
  const proxyOrigin = host ? `${protocol}//${host}` : requestOrigin
  if (origin && origin !== requestOrigin && origin !== proxyOrigin) throw new ApiError(403, 'الطلب اترفض')
  const site = request.headers.get('sec-fetch-site')
  if (site === 'cross-site' || site === 'same-site') throw new ApiError(403, 'الطلب اترفض')
  const type = request.headers.get('content-type') ?? ''
  if (request.method !== 'DELETE' && !type.toLowerCase().startsWith('application/json')) throw new ApiError(415, 'نوع البيانات مش مدعوم')
}

async function startSession(userId: string) {
  const { token, maxAge } = await issueSession(userId)
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })
}

async function handleGet(request: NextRequest, path: string[]) {
  const [resource, id, sub] = path
  if (resource === 'products' && id && sub === 'image') {
    const image = await getProductImage(id, new URL(request.url).searchParams.get('w'))
    if (!image) return json({ error: 'الصورة مش موجودة' }, 404)
    return new NextResponse(new Uint8Array(image.body), {
      headers: { 'Content-Type': image.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }
  const user = await getCurrentUser()
  if (resource === 'session') return json({ user })
  if (resource === 'catalog') return json(await getCatalog())
  if (resource === 'dashboard') {
    const current = requireRole(user, ['owner', 'vendor', 'user'])
    return json({ user: current, dashboard: await getDashboard(current) })
  }
  return json({ error: 'المسار مش موجود' }, 404)
}

async function handlePost(request: NextRequest, path: string[]) {
  assertSameOrigin(request)
  const [resource, id, sub] = path
  const body = await readBody(request, resource === 'products' ? 700_000 : 64_000)

  if (resource === 'sign-up') {
    const userId = await signUpCustomer(body, clientIp(request))
    await startSession(userId)
    return json({ userId }, 201)
  }
  if (resource === 'sign-in') {
    await startSession(await authenticate(body.identifier, body.password, clientIp(request)))
    return json({ signedIn: true })
  }
  if (resource === 'sign-out') {
    const store = await cookies()
    const token = store.get(SESSION_COOKIE)?.value
    if (token) await destroySession(token)
    store.delete(SESSION_COOKIE)
    return json({ signedOut: true })
  }

  const user = await getCurrentUser()
  if (resource === 'account' && id === 'password') {
    const current = requireRole(user, ['owner', 'vendor', 'user'])
    await changePassword(current, body.currentPassword, body.newPassword)
    await startSession(current.id)
    return json({ changed: true })
  }
  if (resource === 'vendors') {
    requireRole(user, ['owner'])
    requirePassword(body.password)
    return json({ vendorId: await createVendor(body) }, 201)
  }
  if (resource === 'products') {
    const current = requireRole(user, ['owner', 'vendor'])
    return json({ productId: await createProduct(current, body) }, 201)
  }
  if (resource === 'images' && id === 'migrate') {
    requireRole(user, ['owner'])
    return json(await migrateProductImages(body.limit))
  }
  if (resource === 'categories') {
    requireRole(user, ['owner'])
    return json({ categoryId: await createCategory(body) }, 201)
  }
  if (resource === 'orders' && id && sub === 'verify') {
    const current = requireRole(user, ['user'])
    return json({ verification: await verifyDelivery(current, id, body.confirmed) })
  }
  if (resource === 'orders') {
    const current = requireRole(user, ['user'])
    return json({ orders: await createOrders(current, body) }, 201)
  }
  if (resource === 'notifications' && id === 'read-all') {
    requireRole(user, ['owner'])
    await markAllNotificationsRead()
    return json({ markedRead: true })
  }
  if (resource === 'notifications' && id && sub === 'read') {
    requireRole(user, ['owner'])
    await markNotificationRead(id)
    return json({ markedRead: true })
  }
  return json({ error: 'المسار مش موجود' }, 404)
}

async function handlePatch(request: NextRequest, path: string[]) {
  assertSameOrigin(request)
  const [resource, id, sub] = path
  const body = await readBody(request, resource === 'products' ? 700_000 : 64_000)
  const user = await getCurrentUser()
  if (resource === 'vendors' && id && sub === 'permissions') {
    requireRole(user, ['owner'])
    return json({ permissions: await updateVendorPermissions(id, body) })
  }
  if (resource === 'products' && id && sub === 'visibility') {
    const current = requireRole(user, ['owner', 'vendor'])
    await setProductVisibility(current, id, body.active)
    return json({ updated: true })
  }
  if (resource === 'products' && id && sub === 'commission') {
    requireRole(user, ['owner'])
    await setProductCommission(id, body)
    return json({ updated: true })
  }
  if (resource === 'products' && id) {
    const current = requireRole(user, ['owner', 'vendor'])
    await updateProduct(current, id, body)
    return json({ updated: true })
  }
  if (resource === 'categories' && id) {
    requireRole(user, ['owner'])
    await updateCategory(id, body)
    return json({ updated: true })
  }
  if (resource === 'zones' && id) {
    requireRole(user, ['owner'])
    await updateZoneFee(id, body)
    return json({ updated: true })
  }
  if (resource === 'orders' && id && sub === 'status') {
    const current = requireRole(user, ['owner', 'vendor'])
    return json(await updateOrderStatus(current, id, body.action))
  }
  return json({ error: 'المسار مش موجود' }, 404)
}

async function handleDelete(request: NextRequest, path: string[]) {
  assertSameOrigin(request)
  const [resource, id, sub] = path
  const user = await getCurrentUser()
  if (resource === 'products' && id && sub === 'permanent') {
    const current = requireRole(user, ['owner'])
    await deleteProductPermanently(current, id)
    return json({ deleted: true })
  }
  if (resource === 'products' && id) {
    const current = requireRole(user, ['owner', 'vendor'])
    await archiveProduct(current, id)
    return json({ deleted: true })
  }
  if (resource === 'categories' && id) {
    requireRole(user, ['owner'])
    await deleteCategory(id)
    return json({ deleted: true })
  }
  return json({ error: 'المسار مش موجود' }, 404)
}

async function run(request: NextRequest, context: RouteContext, method: 'GET' | 'POST' | 'PATCH' | 'DELETE') {
  try {
    const { path = [] } = await context.params
    if (method === 'GET') return await handleGet(request, path)
    if (method === 'POST') return await handlePost(request, path)
    if (method === 'PATCH') return await handlePatch(request, path)
    return await handleDelete(request, path)
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, error.status)
    if (error instanceof DbNotConfiguredError) return json({ error: error.message }, 503)
    console.error('[rtx-shop-api]', error)
    return json({ error: 'حصلت مشكلة غير متوقعة — جرب تاني' }, 500)
  }
}

export const GET = (request: NextRequest, context: RouteContext) => run(request, context, 'GET')
export const POST = (request: NextRequest, context: RouteContext) => run(request, context, 'POST')
export const PATCH = (request: NextRequest, context: RouteContext) => run(request, context, 'PATCH')
export const DELETE = (request: NextRequest, context: RouteContext) => run(request, context, 'DELETE')

import { cookies } from 'next/headers'
import { getDb, makeId, nowIso } from '@/lib/db'
import { hashToken, newToken } from '@/lib/security'
import { ApiError } from '@/lib/errors'

export { ApiError }
export type Role = 'owner' | 'vendor' | 'user'
export const vendorPermissionKeys = ['manage_products', 'view_orders', 'manage_orders'] as const
export type VendorPermission = (typeof vendorPermissionKeys)[number]
export type SessionUser = {
  id: string
  name: string
  username: string
  email: string | null
  role: Role
  phone: string | null
  storeName: string | null
}

export const SESSION_COOKIE = 'rtx_session'
const SESSION_DAYS = 30

export async function issueSession(userId: string) {
  const db = await getDb()
  const token = newToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * SESSION_DAYS).toISOString()
  await db.run('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)', [hashToken(token), userId, expiresAt, nowIso()])
  if (Math.random() < 0.05) await db.run('DELETE FROM sessions WHERE expires_at < ?', [nowIso()])
  return { token, maxAge: 60 * 60 * 24 * SESSION_DAYS }
}

export async function destroySession(token: string) {
  const db = await getDb()
  await db.run('DELETE FROM sessions WHERE token_hash = ?', [hashToken(token)])
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const db = await getDb()
  const user = await db.get<SessionUser>(
    `SELECT u.id, u.name, u.username, u.email, u.role, u.phone, u.store_name
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    [hashToken(token), nowIso()],
  )
  return user ?? null
}

export function requireRole(user: SessionUser | null, roles: Role[]) {
  if (!user) throw new ApiError(401, 'لازم تسجل دخول الأول')
  if (!roles.includes(user.role)) throw new ApiError(403, 'مش مسموحلك تعمل الإجراء ده')
  return user
}

export async function getVendorPermissions(userId: string): Promise<VendorPermission[]> {
  const db = await getDb()
  const rows = await db.all<{ permission: string }>('SELECT permission FROM vendor_permissions WHERE user_id = ? AND enabled = 1', [userId])
  const granted = new Set(rows.map((row) => row.permission))
  return vendorPermissionKeys.filter((permission) => granted.has(permission))
}

export async function hasVendorPermission(userId: string, permission: VendorPermission) {
  const db = await getDb()
  return Boolean(await db.get('SELECT 1 AS ok FROM vendor_permissions WHERE user_id = ? AND permission = ? AND enabled = 1', [userId, permission]))
}

export { makeId, nowIso }

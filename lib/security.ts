import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}

export function verifyPassword(password: string, saved: string) {
  const [saltHex, hashHex] = saved.split(':')
  if (!saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function newToken() {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

// hash وهمي بنقارن عليه لما المستخدم مش موجود، عشان زمن الرد يبقى واحد وميتعرفش مين مسجل
const DUMMY_HASH = hashPassword(randomBytes(12).toString('hex'))
export function burnVerify(password: string) {
  verifyPassword(password, DUMMY_HASH)
}

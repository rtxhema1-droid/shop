import pg from 'pg'
import type { Pool, PoolClient } from 'pg'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { hashPassword } from '@/lib/security'
import { runColumnMigrations } from '@/lib/migrations'

/**
 * طبقة الداتابيز:
 *  - على Vercel (أو أي سيرفر): Postgres عن طريق DATABASE_URL  (دايم ومحفوظ)
 *  - على جهازك للتجربة بس: SQLite محلي لو مفيش DATABASE_URL
 * كل الـ SQL مكتوب بصيغة تشتغل على الاتنين، وبنكتب علامة ? للمتغيرات.
 * النتايج بترجع بأسماء camelCase (price_cents -> priceCents).
 */

export type Row = Record<string, any>
export type Db = {
  all: <T = Row>(sql: string, params?: unknown[]) => Promise<T[]>
  get: <T = Row>(sql: string, params?: unknown[]) => Promise<T | undefined>
  run: (sql: string, params?: unknown[]) => Promise<{ changes: number }>
}
type Exec = (sql: string, params: unknown[]) => Promise<{ rows: Row[]; changes: number }>
type SqliteDb = {
  exec: (sql: string) => void
  prepare: (sql: string) => { all: (...p: unknown[]) => Row[]; run: (...p: unknown[]) => { changes: number | bigint } }
}
type State = { pool?: Pool; sqlite?: SqliteDb; main?: Db; ready?: Promise<void>; chain?: Promise<unknown> }

const globalState = globalThis as typeof globalThis & { __rtxState?: State }
const state: State = (globalState.__rtxState ??= {})

export class DbNotConfiguredError extends Error {
  constructor() {
    super('DATABASE_URL مش متضبط. ضيف قاعدة بيانات Postgres في Vercel (Storage) وبعدها اعمل Redeploy.')
  }
}

export const nowIso = () => new Date().toISOString()
export const makeId = () => randomUUID()
export const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(',')

const camel = (key: string) => key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
function camelRow(row: Row): Row {
  const out: Row = {}
  for (const key of Object.keys(row)) {
    const value = row[key]
    out[camel(key)] = typeof value === 'bigint' ? Number(value) : value
  }
  return out
}
const clean = (params: unknown[]) => params.map((value) => (value === undefined ? null : value))

function makeDb(exec: Exec): Db {
  return {
    all: async <T = Row>(sql: string, params: unknown[] = []) => (await exec(sql, clean(params))).rows.map(camelRow) as T[],
    get: async <T = Row>(sql: string, params: unknown[] = []) => {
      const { rows } = await exec(sql, clean(params))
      return rows[0] ? (camelRow(rows[0]) as T) : undefined
    },
    run: async (sql: string, params: unknown[] = []) => ({ changes: (await exec(sql, clean(params))).changes }),
  }
}

function toPostgres(sql: string) {
  let index = 0
  return sql.replace(/\?/g, () => `$${++index}`)
}
const clientExec = (client: Pool | PoolClient): Exec => async (sql, params) => {
  const result = await client.query(toPostgres(sql), params as unknown[])
  return { rows: result.rows as Row[], changes: result.rowCount ?? 0 }
}

function connectionString() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || ''
}

function createPool(url: string) {
  pg.types.setTypeParser(20, (value: string) => Number(value)) // BIGINT
  pg.types.setTypeParser(1700, (value: string) => Number(value)) // NUMERIC (SUM)
  const parsed = new URL(url)
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname)
  parsed.searchParams.delete('sslmode')
  parsed.searchParams.delete('supa')
  return new pg.Pool({
    connectionString: parsed.toString(),
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_MAX || 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  })
}

function createSqlite(): SqliteDb {
  const getBuiltin = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule
  const sqliteModule = getBuiltin?.('node:sqlite') as { DatabaseSync: new (file: string) => SqliteDb } | undefined
  if (!sqliteModule) throw new Error('محتاج Node 22.5 أو أحدث، أو ضيف DATABASE_URL')
  const directory = path.join(process.cwd(), 'data')
  mkdirSync(directory, { recursive: true })
  const database = new sqliteModule.DatabaseSync(process.env.SQLITE_PATH || path.join(directory, 'rtx-shop.sqlite'))
  database.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
  return database
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'vendor', 'user')),
  phone TEXT,
  store_name TEXT,
  store_address TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
CREATE TABLE IF NOT EXISTS vendor_permissions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN ('manage_products', 'view_orders', 'manage_orders')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  PRIMARY KEY (user_id, permission)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(identifier, created_at);
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id),
  icon TEXT NOT NULL DEFAULT '🛍️',
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  shipping_fee_cents BIGINT NOT NULL CHECK (shipping_fee_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES users(id),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents BIGINT NOT NULL CHECK (price_cents >= 0),
  old_price_cents BIGINT,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  image_data TEXT,
  commission_percent DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (commission_percent >= 0 AND commission_percent <= 100),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active, created_at);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id),
  vendor_id TEXT NOT NULL REFERENCES users(id),
  zone_id TEXT REFERENCES zones(id),
  zone_name TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('new', 'accepted', 'rejected', 'delivered')),
  subtotal_cents BIGINT NOT NULL CHECK (subtotal_cents >= 0),
  shipping_fee_cents BIGINT NOT NULL CHECK (shipping_fee_cents >= 0),
  created_at TEXT NOT NULL,
  delivered_at TEXT,
  customer_verification TEXT NOT NULL DEFAULT 'pending' CHECK (customer_verification IN ('pending', 'confirmed', 'disputed'))
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON orders(vendor_id, created_at);
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price_cents BIGINT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  commission_percent DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS wallet_accounts (
  id TEXT PRIMARY KEY CHECK (id = 'owner'),
  balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
`

// ───────── بيانات أولية (بتتحط مرة واحدة بس) ─────────
const ZONES: Array<[string, string, number]> = [
  ['cairo', 'القاهرة', 50], ['giza', 'الجيزة', 50], ['qalyubia', 'القليوبية', 55], ['alexandria', 'الإسكندرية', 60],
  ['gharbia', 'الغربية', 70], ['dakahlia', 'الدقهلية', 70], ['sharqia', 'الشرقية', 70], ['monufia', 'المنوفية', 65],
  ['kafr-el-sheikh', 'كفر الشيخ', 70], ['beheira', 'البحيرة', 70], ['damietta', 'دمياط', 75],
  ['port-said', 'بورسعيد', 75], ['ismailia', 'الإسماعيلية', 75], ['suez', 'السويس', 75],
  ['fayoum', 'الفيوم', 80], ['beni-suef', 'بني سويف', 85], ['minya', 'المنيا', 90],
  ['assiut', 'أسيوط', 100], ['sohag', 'سوهاج', 100], ['qena', 'قنا', 105], ['luxor', 'الأقصر', 110], ['aswan', 'أسوان', 115],
  ['matrouh', 'مطروح', 110], ['red-sea', 'البحر الأحمر', 115], ['south-sinai', 'جنوب سيناء', 115],
  ['north-sinai', 'شمال سيناء', 120], ['new-valley', 'الوادي الجديد', 125],
]

const CATEGORIES: Array<{ id: string; name: string; icon: string; subs: string[] }> = [
  { id: 'electronics', name: 'الأجهزة الإلكترونية', icon: '💻', subs: ['موبايلات', 'تابلت', 'لابتوبات وكمبيوتر', 'سماعات', 'ساعات ذكية', 'شواحن وكابلات', 'كاميرات', 'شاشات وتلفزيونات', 'أجهزة جيمنج'] },
  { id: 'appliances', name: 'الأجهزة المنزلية', icon: '🏠', subs: ['ثلاجات وفريزرات', 'غسالات', 'بوتاجازات وأفران', 'مكانس كهربائية', 'أجهزة مطبخ صغيرة', 'تكييفات ومراوح'] },
  { id: 'men', name: 'أزياء رجالي', icon: '👕', subs: ['تيشرتات وقمصان', 'بناطيل', 'جاكيتات وبلوفرات', 'أحذية رجالي'] },
  { id: 'women', name: 'أزياء حريمي', icon: '👗', subs: ['فساتين', 'بلوزات وتيشرتات', 'عبايات وحجاب', 'أحذية حريمي', 'شنط'] },
  { id: 'accessories', name: 'إكسسوارات وساعات', icon: '⌚', subs: ['ساعات يد', 'نضارات', 'محافظ', 'خواتم وسلاسل'] },
  { id: 'beauty', name: 'الجمال والعناية', icon: '💄', subs: ['عطور', 'مكياج', 'العناية بالبشرة', 'العناية بالشعر'] },
  { id: 'home', name: 'المنزل والمطبخ', icon: '🍳', subs: ['أدوات مطبخ', 'مفروشات', 'ديكور', 'إضاءة'] },
  { id: 'kids', name: 'الأطفال والألعاب', icon: '🧸', subs: ['ألعاب', 'ملابس أطفال', 'مستلزمات رضع'] },
  { id: 'sports', name: 'الرياضة واللياقة', icon: '🏋️', subs: ['أجهزة رياضية', 'ملابس رياضية', 'مكملات ومستلزمات'] },
  { id: 'cars', name: 'السيارات والموتوسيكلات', icon: '🚗', subs: ['إكسسوارات سيارات', 'زيوت وصيانة', 'إكسسوارات موتوسيكلات'] },
]

async function seed(db: Db) {
  const created = nowIso()
  if (!(await db.get(`SELECT value FROM meta WHERE key = 'seed_zones'`))) {
    for (const [index, [slug, name, fee]] of ZONES.entries()) {
      await db.run('INSERT INTO zones (id, name, shipping_fee_cents, sort_order) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING', [`zone-${slug}`, name, fee * 100, index])
    }
    await db.run(`INSERT INTO meta (key, value) VALUES ('seed_zones', ?) ON CONFLICT (key) DO NOTHING`, [created])
  }
  if (!(await db.get(`SELECT value FROM meta WHERE key = 'seed_categories'`))) {
    for (const [index, category] of CATEGORIES.entries()) {
      await db.run('INSERT INTO categories (id, name, parent_id, icon, sort_order) VALUES (?, ?, NULL, ?, ?) ON CONFLICT (id) DO NOTHING', [`cat-${category.id}`, category.name, category.icon, index])
      for (const [subIndex, sub] of category.subs.entries()) {
        await db.run('INSERT INTO categories (id, name, parent_id, icon, sort_order) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING', [`cat-${category.id}-${subIndex + 1}`, sub, `cat-${category.id}`, category.icon, subIndex])
      }
    }
    await db.run(`INSERT INTO meta (key, value) VALUES ('seed_categories', ?) ON CONFLICT (key) DO NOTHING`, [created])
  }
  if (!(await db.get(`SELECT id FROM users WHERE role = 'owner' LIMIT 1`))) {
    const username = (process.env.OWNER_USERNAME || 'owner').trim().toLowerCase()
    let password = process.env.OWNER_PASSWORD || ''
    if (password.length < 10) {
      // مفيش كلمة سر قوية في المتغيرات: نولّد واحدة عشوائية ونطبعها مرة واحدة في اللوج
      password = randomBytes(12).toString('base64url')
      console.warn(`[rtx-shop] تم إنشاء حساب المالك — اسم المستخدم: ${username} | كلمة السر المؤقتة: ${password} (غيّرها بعد أول دخول)`)
    }
    await db.run(
      `INSERT INTO users (id, name, username, email, password_hash, role, store_name, created_at) VALUES (?, ?, ?, NULL, ?, 'owner', 'RTX Shop', ?) ON CONFLICT (username) DO NOTHING`,
      [makeId(), 'صاحب المتجر', username, hashPassword(password), created],
    )
  }
  await db.run(`INSERT INTO wallet_accounts (id, balance_cents, updated_at) VALUES ('owner', 0, ?) ON CONFLICT (id) DO NOTHING`, [created])
}

async function init() {
  const url = connectionString()
  if (url) {
    const pool = (state.pool ??= createPool(url))
    state.main = makeDb(clientExec(pool))
    const client = await pool.connect()
    try {
      await client.query('SELECT pg_advisory_lock(7274001)')
      await client.query(SCHEMA)
      await runColumnMigrations({
        hasColumn: async (table, column) => {
          const result = await client.query('SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2', [table, column])
          return (result.rowCount ?? 0) > 0
        },
        exec: async (sql) => { await client.query(sql) },
      })
      await seed(makeDb(clientExec(client)))
    } finally {
      await client.query('SELECT pg_advisory_unlock(7274001)').catch(() => undefined)
      client.release()
    }
    return
  }
  if (process.env.VERCEL) throw new DbNotConfiguredError()
  const sqlite = (state.sqlite ??= createSqlite())
  state.main = makeDb(async (sql, params) => {
    const statement = sqlite.prepare(sql)
    if (/^\s*(SELECT|WITH)/i.test(sql)) return { rows: statement.all(...params), changes: 0 }
    return { rows: [], changes: Number(statement.run(...params).changes) }
  })
  sqlite.exec(SCHEMA)
  await runColumnMigrations({
    hasColumn: async (table, column) => sqlite.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column),
    exec: async (sql) => { sqlite.exec(sql) },
  })
  await seed(state.main)
}

export async function getDb(): Promise<Db> {
  if (!state.ready) {
    state.ready = init().catch((error) => {
      state.ready = undefined
      throw error
    })
  }
  await state.ready
  return state.main as Db
}

/** تنفيذ مجموعة عمليات كوحدة واحدة (يا كلها تنجح يا كلها تتلغي) */
export async function tx<T>(operation: (db: Db) => Promise<T>): Promise<T> {
  await getDb()
  if (state.pool) {
    const client = await state.pool.connect()
    try {
      await client.query('BEGIN')
      const result = await operation(makeDb(clientExec(client)))
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined)
      throw error
    } finally {
      client.release()
    }
  }
  const sqlite = state.sqlite as SqliteDb
  const main = state.main as Db
  const job = async () => {
    sqlite.exec('BEGIN IMMEDIATE')
    try {
      const result = await operation(main)
      sqlite.exec('COMMIT')
      return result
    } catch (error) {
      sqlite.exec('ROLLBACK')
      throw error
    }
  }
  const next = (state.chain ?? Promise.resolve()).then(job, job)
  state.chain = next.catch(() => undefined)
  return next
}

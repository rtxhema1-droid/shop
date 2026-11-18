/**
 * Migrations آمنة: بتضيف أعمدة اختيارية بس، ومبتمسحش ولا بتغيّر أي بيانات موجودة.
 * بتتنفذ في كل تشغيل، وتتخطى أي عمود موجود بالفعل (idempotent).
 */
export type MigrationDriver = {
  /** هل العمود موجود في الجدول؟ */
  hasColumn: (table: string, column: string) => Promise<boolean>
  /** تنفيذ DDL */
  exec: (sql: string) => Promise<void>
}

export const COLUMN_MIGRATIONS: Array<{ table: string; column: string; ddl: string }> = [
  // مواصفات المنتج (كلها اختيارية)
  { table: 'products', column: 'battery', ddl: 'TEXT' },
  { table: 'products', column: 'warranty', ddl: 'TEXT' },
  { table: 'products', column: 'box_contents', ddl: 'TEXT' },
  // مدة التوصيل المتوقعة لكل محافظة بالأيام (اختيارية)
  { table: 'zones', column: 'delivery_days_min', ddl: 'INTEGER' },
  { table: 'zones', column: 'delivery_days_max', ddl: 'INTEGER' },
]

export async function runColumnMigrations(driver: MigrationDriver) {
  for (const item of COLUMN_MIGRATIONS) {
    if (await driver.hasColumn(item.table, item.column)) continue
    await driver.exec(`ALTER TABLE ${item.table} ADD COLUMN ${item.column} ${item.ddl}`)
  }
}

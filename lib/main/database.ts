import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

export function getDb() {
  if (!db) {
    const documentsPath = app.getPath('documents')
    const dbPath = path.join(documentsPath, 'example.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
  }
  return db
}

/**
 * Seed the database only once. Uses a schema_meta table to track applied seeds.
 */
export function seedDatabase() {
  const database = getDb()
  database.exec(
    `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
  )

  const hasSeed = database.prepare('SELECT 1 FROM schema_meta WHERE key = ?').get('initial_tests') // retained for backward compatibility, no longer gates test seeding

  // Always ensure required tables exist
  // Removed obsolete patient table; patient details now embedded in test_records payload and denormalized columns.
  // Proactively drop legacy patient table so it doesn't linger in user databases.
  try {
    database.exec('DROP TABLE IF EXISTS patient')
  } catch (err) {
    console.warn('[DB] Failed to drop legacy patient table (can be ignored):', err)
  }

  database.exec(`CREATE TABLE IF NOT EXISTS test (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    result TEXT,
    normal_value TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`)
  // Ensure uniqueness so we can safely INSERT OR IGNORE
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_test_category_name ON test(category, name)`)

  database.exec(`CREATE TABLE IF NOT EXISTS test_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT,
    patient_age INTEGER,
    patient_sex TEXT,
    patient_father_or_husband TEXT,
    payload TEXT NOT NULL, -- full JSON structure serialized
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  // Migration: add patient_father_or_husband column if missing (older db versions)
  try {
    const info = database.prepare('PRAGMA table_info(test_records)').all() as { name: string }[]
    const hasCol = info.some((c) => c.name === 'patient_father_or_husband')
    if (!hasCol) {
      database.exec('ALTER TABLE test_records ADD COLUMN patient_father_or_husband TEXT')
      console.warn('[DB] Added column patient_father_or_husband to test_records')
    }
  } catch (err) {
    console.error('[DB] Failed to ensure patient_father_or_husband column', err)
  }

  // Idempotent seed: always attempt to insert defaults; skip existing pairs (category,name)
  const defaultTests = [
    { category: 'Lipid Profile', name: 'Cholestrol', result: '', normal_value: '150 - 200mg%' },
    { category: 'Lipid Profile', name: 'TriGlycride', result: '', normal_value: 'Upto 150mg%' },
    { category: 'Hepatitis', name: 'ANTI HCV', result: '', normal_value: '' },
    { category: 'Hepatitis', name: 'HEP B', result: '', normal_value: '' },
    { category: 'Liver Function Test', name: 'ALT', result: '', normal_value: 'F= 31mg% M=40mg%' },
  ]
  const insertIgnore = database.prepare(
    'INSERT OR IGNORE INTO test (category, name, result, normal_value) VALUES (@category, @name, @result, @normal_value)'
  )
  const trans2 = database.transaction((items: any[]) => {
    let inserted = 0
    for (const r of items) {
      const info: any = insertIgnore.run(r)
      if (info.changes === 1) inserted++
    }
    if (!hasSeed) {
      // mark legacy seed flag so old logic (if any external code) still sees it
      database.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)').run('initial_tests', '1')
    }
    console.warn(`[DB] Default tests ensured (inserted ${inserted}, skipped ${items.length - inserted}).`)
  })
  trans2(defaultTests)
}

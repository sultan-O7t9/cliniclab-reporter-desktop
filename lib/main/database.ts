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

  const hasSeed = database.prepare('SELECT 1 FROM schema_meta WHERE key = ?').get('initial_tests')

  // Always ensure required tables exist
  database.exec(`CREATE TABLE IF NOT EXISTS patient (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    age INTEGER,
    gender TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  database.exec(`CREATE TABLE IF NOT EXISTS test (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    result TEXT,
    normal_value TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`)

  if (!hasSeed) {
    const insert = database.prepare(
      'INSERT INTO test (category, name, result, normal_value) VALUES (@category, @name, @result, @normal_value)'
    )
    const rows = [
      { category: 'Lipid Profile', name: 'Cholestrol', result: '', normal_value: '150 - 200mg%' },
      { category: 'Lipid Profile', name: 'TriGlycride', result: '', normal_value: 'Upto 150mg%' },
      { category: 'Hepatitis', name: 'ANTI HCV', result: '', normal_value: '' },
      { category: 'Hepatitis', name: 'HEP B', result: '', normal_value: '' },

      { category: 'Liver Function Test', name: 'ALT', result: '', normal_value: 'F= 31mg% M=40mg%' },
    ]
    const transaction = database.transaction((items: any[]) => {
      for (const r of items) insert.run(r)
      database.prepare('INSERT INTO schema_meta (key, value) VALUES (?, ?)').run('initial_tests', '1')
    })
    transaction(rows)
    console.warn('[DB] Seeded initial test rows.')
  } else {
    // Nothing to do
    console.warn('[DB] Seed already applied, skipping.')
  }
}

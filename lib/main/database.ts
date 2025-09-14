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
export const DEFAULT_TESTS = [
  {
    id: 10,
    category: 'Blood Group',
    name: 'BLOOD GROUP',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 7,
    category: 'CA',
    name: 'CA',
    normal_value: 'M:8.5 TO 10.5, F:8.6 TO 10.7',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 15,
    category: 'ESR',
    name: 'ESR',
    normal_value: 'M: 0 TO 15 MM/HR, F: 0 TO 20 MM/HR',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 18,
    category: 'H-Pylori',
    name: 'HPL',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 9,
    category: 'H.B',
    name: 'HB',
    normal_value: '12 TO 15',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 1,
    category: 'Hepatitis',
    name: 'ANTI HCV',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 2,
    category: 'Hepatitis',
    name: 'HEP B',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 19,
    category: 'LFT',
    name: 'ALT',
    normal_value: '30 - 40 mg%',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 20,
    category: 'LFT',
    name: 'AST',
    normal_value: 'Upto 45 mg%',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 21,
    category: 'LFT',
    name: 'ALK PHOS',
    normal_value: 'More Than 135mg%',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 22,
    category: 'LFT',
    name: 'BILLURUBIN',
    normal_value: 'Upto 1.5mg%',
    result: '',
    required: false,
    sort_order: 3,
  },
  {
    id: 11,
    category: 'Lipid Profile',
    name: 'CHOLESTROL',
    normal_value: '150-200 mg%',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 12,
    category: 'Lipid Profile',
    name: 'TRIGLYCRIDE',
    normal_value: 'Upto 150mg%',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 13,
    category: 'Lipid Profile',
    name: 'HDL',
    normal_value: 'More Than 40mg%',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 14,
    category: 'Lipid Profile',
    name: 'LDL',
    normal_value: 'Upto 150mg%',
    result: '',
    required: false,
    sort_order: 3,
  },
  {
    id: 3,
    category: 'Liver Function Test',
    name: 'ALT',
    normal_value: 'F=31mg% M=40mg%',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 23,
    category: 'MP',
    name: 'MP',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 4,
    category: 'Renal Function Test',
    name: 'BLOOD UREA',
    normal_value: '10-50 mg%',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 5,
    category: 'Renal Function Test',
    name: 'CREATENINE',
    normal_value: '0.5-1.3 mg%',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 6,
    category: 'Renal Function Test',
    name: 'URIC ACID',
    normal_value: 'M:3.0-7.0 F:2.5-5.0',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 8,
    category: 'Serology',
    name: 'BLOOD SUGAR',
    normal_value: '70-120 mg/dl',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 24,
    category: 'Triglycride',
    name: 'TRIGLYCRIDE',
    normal_value: 'UPTO 150 MG',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 16,
    category: 'Typhoid',
    name: 'IGG',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 17,
    category: 'Typhoid',
    name: 'IGM',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 25,
    category: 'UPT',
    name: 'UPT',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 26,
    category: 'URINE REPORT',
    name: 'COLOR',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 0,
  },
  {
    id: 27,
    category: 'URINE REPORT',
    name: 'TURBIDITY',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 1,
  },
  {
    id: 28,
    category: 'URINE REPORT',
    name: 'SPECIFC GRAVITY',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 2,
  },
  {
    id: 29,
    category: 'URINE REPORT',
    name: 'DEPOSIT',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 3,
  },
  {
    id: 30,
    category: 'URINE REPORT',
    name: 'PH',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 4,
  },
  {
    id: 31,
    category: 'URINE REPORT',
    name: 'GLUCOSE',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 5,
  },
  {
    id: 32,
    category: 'URINE REPORT',
    name: 'KETONES',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 6,
  },
  {
    id: 33,
    category: 'URINE REPORT',
    name: 'PROTEIN',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 7,
  },
  {
    id: 34,
    category: 'URINE REPORT',
    name: 'BLOOD',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 8,
  },
  {
    id: 35,
    category: 'URINE REPORT',
    name: 'HAEMOGLOBIN',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 9,
  },
  {
    id: 36,
    category: 'URINE REPORT',
    name: 'UROBILINOGEN',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 10,
  },
  {
    id: 37,
    category: 'URINE REPORT',
    name: 'BILLIRUBIN',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 11,
  },
  {
    id: 38,
    category: 'URINE REPORT',
    name: 'NITRITES',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 12,
  },
  {
    id: 39,
    category: 'URINE REPORT',
    name: 'LEU',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 13,
  },
  {
    id: 40,
    category: 'URINE REPORT',
    name: 'PUS CELLS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 14,
  },
  {
    id: 41,
    category: 'URINE REPORT',
    name: 'RED BLOOD CELLS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 15,
  },
  {
    id: 42,
    category: 'URINE REPORT',
    name: 'EPITHELIAL CELLS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 16,
  },
  {
    id: 43,
    category: 'URINE REPORT',
    name: 'CASTS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 17,
  },
  {
    id: 44,
    category: 'URINE REPORT',
    name: 'CRYSTALS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 18,
  },
  {
    id: 45,
    category: 'URINE REPORT',
    name: 'ANORPHOUS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 19,
  },
  {
    id: 46,
    category: 'URINE REPORT',
    name: 'ORGANISMS',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 20,
  },
  {
    id: 47,
    category: 'URINE REPORT',
    name: 'MISC',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 21,
  },
]

export function reseedTests(custom?: typeof DEFAULT_TESTS) {
  const database = getDb()
  const rows = custom || DEFAULT_TESTS
  const insertIgnore = database.prepare(
    'INSERT OR IGNORE INTO test (category, name, result, normal_value, required, sort_order) VALUES (@category, @name, @result, @normal_value, @required_int, @sort_order)'
  )
  let inserted = 0
  for (const r of rows) {
    const info: any = insertIgnore.run({
      category: r.category,
      name: r.name,
      result: r.result ?? '',
      normal_value: r.normal_value ?? '',
      required_int: r.required ? 1 : 0,
      sort_order: typeof (r as any).sort_order === 'number' ? (r as any).sort_order : null,
    })
    if (info.changes === 1) inserted++
  }
  return { inserted, skipped: rows.length - inserted }
}

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
    required INTEGER DEFAULT 0,
    sort_order INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`)
  // Ensure uniqueness so we can safely INSERT OR IGNORE
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_test_category_name ON test(category, name)`)

  // Migration: add required column if missing (older installations)
  try {
    const cols = database.prepare('PRAGMA table_info(test)').all() as { name: string }[]
    if (!cols.some((c) => c.name === 'required')) {
      database.exec('ALTER TABLE test ADD COLUMN required INTEGER DEFAULT 0')
      console.warn('[DB] Added required column to test table')
    }
    if (!cols.some((c) => c.name === 'sort_order')) {
      database.exec('ALTER TABLE test ADD COLUMN sort_order INTEGER')
      console.warn('[DB] Added sort_order column to test table')
      // Backfill existing rows: sequential per category ordered by existing id
      const rows = database.prepare('SELECT id, category FROM test ORDER BY category, id').all() as {
        id: number
        category: string
      }[]
      let currentCategory = ''
      let index = 0
      const update = database.prepare('UPDATE test SET sort_order = ? WHERE id = ?')
      for (const r of rows) {
        if (r.category !== currentCategory) {
          currentCategory = r.category
          index = 0
        }
        update.run(index++, r.id)
      }
    }
  } catch (err) {
    console.error('[DB] Failed to ensure required column on test table', err)
  }

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
  const { inserted, skipped } = reseedTests(DEFAULT_TESTS)
  if (!hasSeed) {
    database.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)').run('initial_tests', '1')
  }
  console.warn(`[DB] Default tests ensured (inserted ${inserted}, skipped ${skipped}).`)
}

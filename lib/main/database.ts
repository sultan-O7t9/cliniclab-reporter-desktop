import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

let db: Database.Database | null = null
let initializing = false

// Central storage directory + file naming
// Move from Documents to userData to avoid sharing across unrelated user edits and to follow Electron conventions.
// Provide separate dev/prod file names to avoid contamination.
const STORAGE_DIR_NAME = 'ClinicLab_Reporter_do_not_delete'
const BASE_PATH = (() => {
  // If env override set, honor it (absolute or relative to userData)
  const override = process.env.CLINICLAB_DB_PATH
  if (override) {
    try {
      const p = path.isAbsolute(override) ? override : path.join(app.getPath('userData'), override)
      return p
    } catch (e) {
      console.warn('[DB] Invalid CLINICLAB_DB_PATH override, falling back to userData:', e)
    }
  }
  return app.getPath('userData')
})()
const NEW_DB_FILENAME = app.isPackaged ? 'cliniclab_reporter.db' : 'cliniclab_reporter__dev.db'
const LEGACY_DB_FILENAME = 'example.db'

function ensureStorageDir(base: string, subFolder = STORAGE_DIR_NAME) {
  const full = path.join(base, subFolder)
  if (!fs.existsSync(full)) {
    try {
      fs.mkdirSync(full, { recursive: true })
      if (db && !initializing) {
        logEvent({ action: 'LOG_STORAGE_DIR_CREATED', payload: { path: full } })
      } else {
        console.warn('[STORAGE] Created storage directory', full)
      }
    } catch (err) {
      console.error('[STORAGE] Failed to create storage directory', err)
    }
  }
  return full
}

function migrateLegacyDatabase(legacyDocumentsPath: string, storageDir: string) {
  // For users upgrading from earlier builds that stored DB in Documents
  const legacyPath = path.join(legacyDocumentsPath, STORAGE_DIR_NAME, NEW_DB_FILENAME)
  const legacyExample = path.join(legacyDocumentsPath, LEGACY_DB_FILENAME)
  const newPath = path.join(storageDir, NEW_DB_FILENAME)
  if (fs.existsSync(newPath)) {
    // Already migrated
    return newPath
  }
  if (fs.existsSync(legacyPath)) {
    try {
      if (db && !initializing)
        logEvent({ action: 'LOG_STORAGE_MIGRATE_START', payload: { from: legacyPath, to: newPath } })
      fs.copyFileSync(legacyPath, newPath)
      // Keep legacy copy as a safety fallback, but could be removed/commented if deletion desired
      if (db && !initializing) logEvent({ action: 'LOG_STORAGE_MIGRATE_COMPLETE', payload: { newPath } })
      return newPath
    } catch (err) {
      if (db && !initializing)
        logEvent({ action: 'LOG_STORAGE_MIGRATE_FAILED', level: 'ERROR', payload: { error: String(err) } })
      console.error('[STORAGE] Migration failed', err)
    }
  } else if (fs.existsSync(legacyExample)) {
    try {
      if (db && !initializing)
        logEvent({ action: 'LOG_STORAGE_LEGACY_EXAMPLE_START', payload: { from: legacyExample, to: newPath } })
      fs.copyFileSync(legacyExample, newPath)
      if (db && !initializing) logEvent({ action: 'LOG_STORAGE_LEGACY_EXAMPLE_COMPLETE', payload: { newPath } })
      return newPath
    } catch (err) {
      console.error('[STORAGE] Legacy example migration failed', err)
      if (db && !initializing)
        logEvent({ action: 'LOG_STORAGE_LEGACY_EXAMPLE_FAILED', level: 'ERROR', payload: { error: String(err) } })
    }
  } else {
    if (db && !initializing) logEvent({ action: 'LOG_STORAGE_MIGRATE_SKIP', payload: { reason: 'no_legacy_db' } })
  }
  return newPath
}

export function getDb() {
  if (!db) {
    initializing = true
    const legacyDocuments = app.getPath('documents')
    const storageDir = ensureStorageDir(BASE_PATH)
    const targetPath = migrateLegacyDatabase(legacyDocuments, storageDir)
    db = new Database(targetPath)
    db.pragma('journal_mode = WAL')
    initializing = false
  }
  return db
}

// Structured logging helper
export type LogLevel = 'INFO' | 'WARN' | 'ERROR'
export interface LogEntryInput {
  action: string
  level?: LogLevel
  payload?: any
  message?: string
}
export function logEvent(entry: LogEntryInput) {
  try {
    const database = getDb()
    database.exec(`CREATE TABLE IF NOT EXISTS app_logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      action TEXT NOT NULL,
      level TEXT NOT NULL,
      payload TEXT,
      message TEXT
    )`)
    // Indexes for querying by action/time
    database.exec('CREATE INDEX IF NOT EXISTS idx_app_logs_action ON app_logs(action)')
    database.exec('CREATE INDEX IF NOT EXISTS idx_app_logs_ts ON app_logs(ts)')
    const now = new Date()
    const ts = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}-${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`
    const stmt = database.prepare('INSERT INTO app_logs (ts, action, level, payload, message) VALUES (?, ?, ?, ?, ?)')
    stmt.run(
      ts,
      entry.action.toUpperCase(),
      entry.level || 'INFO',
      entry.payload != null ? JSON.stringify(entry.payload) : null,
      entry.message || ''
    )
  } catch (err) {
    // Last resort: console fallback
    console.error('[LOGGING] Failed to persist log', err)
  }
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
  logEvent({ action: 'SEED_START', payload: {} })
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

  // Create index to speed up patient_name searches (case-insensitive comparisons use lowered value)
  try {
    database.exec('CREATE INDEX IF NOT EXISTS idx_test_records_patient_name ON test_records(patient_name)')
  } catch (err) {
    console.warn('[DB] Failed to create patient_name index', err)
  }

  // Optional FTS5 virtual table for patient name prefix/full-text search (fallback to LIKE if unavailable)
  try {
    database.exec(
      `CREATE VIRTUAL TABLE IF NOT EXISTS test_records_fts USING fts5(patient_name, content='test_records', content_rowid='id')`
    )
    // Sync existing rows if newly created
    database.exec(`INSERT INTO test_records_fts(rowid, patient_name)
                   SELECT id, COALESCE(patient_name,'') FROM test_records
                   WHERE NOT EXISTS (SELECT 1 FROM test_records_fts WHERE rowid = test_records.id)`)
    // Triggers to keep FTS in sync
    database.exec(`CREATE TRIGGER IF NOT EXISTS test_records_ai AFTER INSERT ON test_records BEGIN
        INSERT INTO test_records_fts(rowid, patient_name) VALUES (new.id, COALESCE(new.patient_name,''));
      END;`)
    database.exec(`CREATE TRIGGER IF NOT EXISTS test_records_ad AFTER DELETE ON test_records BEGIN
        DELETE FROM test_records_fts WHERE rowid = old.id;
      END;`)
    database.exec(`CREATE TRIGGER IF NOT EXISTS test_records_au AFTER UPDATE OF patient_name ON test_records BEGIN
        UPDATE test_records_fts SET patient_name = COALESCE(new.patient_name,'') WHERE rowid = new.id;
      END;`)
  } catch (err) {
    console.warn('[DB] FTS5 not available or failed to initialize, will fallback to LIKE search', err)
  }

  // Idempotent seed: always attempt to insert defaults; skip existing pairs (category,name)
  const { inserted, skipped } = reseedTests(DEFAULT_TESTS)
  if (!hasSeed) {
    database.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)').run('initial_tests', '1')
  }
  console.warn(`[DB] Default tests ensured (inserted ${inserted}, skipped ${skipped}).`)
  logEvent({ action: 'SEED_COMPLETE', payload: { inserted, skipped } })
}

/** Archive + reset the current database (creates a fresh schema + applies default seeds). */
export function resetDatabase() {
  if (db) {
    try {
      db.close()
    } catch (e) {
      console.error('[DB] Failed closing DB during reset', e)
    }
    db = null
  }
  const legacyDocuments = app.getPath('documents')
  const storageDir = ensureStorageDir(BASE_PATH)
  const targetPath = migrateLegacyDatabase(legacyDocuments, storageDir)
  // Archive existing file if present
  if (fs.existsSync(targetPath)) {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
    const archivePath = targetPath.replace(/\.db$/, `-${stamp}.bak.db`)
    try {
      fs.copyFileSync(targetPath, archivePath)
      fs.unlinkSync(targetPath)
      console.warn('[DB] Archived old DB to', archivePath)
      logEvent({ action: 'DB_ARCHIVED', payload: { archivePath } })
    } catch (err) {
      console.error('[DB] Failed to archive DB', err)
      logEvent({ action: 'DB_ARCHIVE_FAILED', level: 'ERROR', payload: { error: String(err) } })
    }
  }
  db = new Database(targetPath)
  db.pragma('journal_mode = WAL')
  seedDatabase()
  logEvent({ action: 'DB_RESET_COMPLETE' })
}

export function pruneOldLogs(days = 3) {
  try {
    const database = getDb()
    database.exec(`CREATE TABLE IF NOT EXISTS app_logs(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts TEXT NOT NULL,
      action TEXT NOT NULL,
      level TEXT NOT NULL,
      payload TEXT,
      message TEXT
    )`)
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const rows = database.prepare('SELECT id, ts, action, level, payload, message FROM app_logs').all() as {
      id: number
      ts: string
      action: string
      level: string
      payload: string | null
      message: string | null
    }[]
    const parseTs = (ts: string) => {
      // Format: DD/MM/YYYY-hh-mm
      const m = ts.match(/^(\d{2})\/(\d{2})\/(\d{4})-(\d{2})-(\d{2})$/)
      if (!m) return null
      const [_, dd, MM, yyyy, hh, mm] = m
      return new Date(Number(yyyy), Number(MM) - 1, Number(dd), Number(hh), Number(mm)).getTime()
    }
    const stale: typeof rows = []
    for (const r of rows) {
      const t = parseTs(r.ts)
      if (t != null && t < cutoff) stale.push(r)
    }
    if (stale.length) {
      // Archive first
      try {
        const documentsPath = app.getPath('documents')
        const storageDir = path.join(documentsPath, STORAGE_DIR_NAME)
        if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true })
        const stamp = new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '')
        const archivePath = path.join(storageDir, `purged-logs-${stamp}.txt`)
        const lines = stale.map((s) => {
          return `[${s.ts}] ${s.level} ${s.action} ${s.message || ''} ${s.payload ? s.payload : ''}`.trim()
        })
        fs.writeFileSync(archivePath, lines.join('\n'), 'utf-8')
        logEvent({ action: 'LOG_RETENTION_ARCHIVE', payload: { file: archivePath, count: stale.length } })
      } catch (archiveErr) {
        console.error('[LOGGING] Failed to archive stale logs', archiveErr)
        logEvent({ action: 'LOG_RETENTION_ARCHIVE_FAILED', level: 'ERROR', payload: { error: String(archiveErr) } })
      }
      // Delete stale
      const del = database.prepare('DELETE FROM app_logs WHERE id = ?')
      for (let i = 0; i < stale.length; i++) del.run(stale[i].id)
      logEvent({ action: 'LOG_RETENTION_PURGE', payload: { removed: stale.length, days } })
    }
  } catch (err) {
    console.error('[LOGGING] pruneOldLogs failed', err)
  }
}

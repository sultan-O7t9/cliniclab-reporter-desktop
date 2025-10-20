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
    id: 1,
    category: 'Blood Group',
    name: 'BLOOD GROUP',
    normal_value: '',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 2,
    category: 'CA',
    name: 'CA',
    normal_value: 'M:8.5 TO 10.5 F:8.6TO10.7',
    normal_spec: '{"type":"sexed-range","male":{"min":8.5,"max":10.5},"female":{"min":8.6,"max":10.7}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 3,
    category: 'ESR',
    name: 'ESR',
    normal_value: '0 TO 15 MM/HR MEN 0 TO 20 MM/HR WOMEN',
    normal_spec: '{"type":"sexed-range","male":{"min":0,"max":15},"female":{"min":0,"max":20}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 4,
    category: 'H-Pylori',
    name: 'HPL',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 5,
    category: 'H.B',
    name: 'HB',
    normal_value: '12 to 15',
    normal_spec: '{"type":"range","range":{"min":12,"max":15}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 6,
    category: 'Hepatitis',
    name: 'ANTI HCV',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 7,
    category: 'Hepatitis',
    name: 'HEP B',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 8,
    category: 'LFT',
    name: 'ALT',
    normal_value: '30 - 40mg%',
    normal_spec: '{"type":"range","range":{"min":30,"max":40}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 9,
    category: 'LFT',
    name: 'AST',
    normal_value: 'Upto 45mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":45}}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 10,
    category: 'LFT',
    name: 'ALK PHOS',
    normal_value: 'More Than 135mg%',
    normal_spec: '{"type":"range","range":{"min":135,"max":9999}}',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 11,
    category: 'LFT',
    name: 'BILLURUBIN',
    normal_value: 'Upto 1.5mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":1.5}}',
    result: '',
    required: false,
    sort_order: 3,
  },
  {
    id: 12,
    category: 'Lipid Profile',
    name: 'CHOLESTROL',
    normal_value: '150 -200mg%',
    normal_spec: '{"type":"range","range":{"min":150,"max":200}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 13,
    category: 'Lipid Profile',
    name: 'TRIGLYCRIDE',
    normal_value: 'Upto 150mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":150}}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 14,
    category: 'Lipid Profile',
    name: 'HDL',
    normal_value: 'More Than 40mg%',
    normal_spec: '{"type":"range","range":{"min":40,"max":9999}}',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 15,
    category: 'Lipid Profile',
    name: 'LDL',
    normal_value: 'Upto 150mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":150}}',
    result: '',
    required: false,
    sort_order: 3,
  },
  {
    id: 16,
    category: 'Liver Function Test',
    name: 'ALT',
    normal_value: 'F=31mg% M=40mg%',
    normal_spec: '{"type":"range","range":{"min":31,"max":40}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 17,
    category: 'MP',
    name: 'MP',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 189,
    category: 'MP',
    name: 'PF',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
    parent_id: 17,
  },
  {
    id: 190,
    category: 'MP',
    name: 'PAN',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 1,
    parent_id: 17,
  },
  {
    id: 18,
    category: 'Renal Function Test',
    name: 'BLOOD UREA',
    normal_value: '10 - 50 mg%',
    normal_spec: '{"type":"range","range":{"min":10,"max":50}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 19,
    category: 'Renal Function Test',
    name: 'CREATENINE',
    normal_value: '0.5 - 1.3 mg%',
    normal_spec: '{"type":"range","range":{"min":0.5,"max":1.3}}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 20,
    category: 'Renal Function Test',
    name: 'URIC ACID',
    normal_value: 'M:3.0-7.0 F: 2.5-5.0',
    normal_spec: '{"type":"sexed-range","male":{"min":3,"max":7},"female":{"min":2.5,"max":5}}',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 21,
    category: 'Serology',
    name: 'BLOOD SUGAR',
    normal_value: '70-120 mg/dl',
    normal_spec: '{"type":"range","range":{"min":70,"max":120}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 22,
    category: 'Triglycride',
    name: 'TRIGLYCRIDE',
    normal_value: 'UPTO  150 MG',
    normal_spec: '{"type":"range","range":{"min":0,"max":150}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 23,
    category: 'Typhoid',
    name: 'IGG',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 24,
    category: 'Typhoid',
    name: 'IGM',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 25,
    category: 'UPT',
    name: 'UPT',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
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
    'INSERT OR IGNORE INTO test (category, name, result, normal_value, normal_spec, required, sort_order, parent_id) VALUES (@category, @name, @result, @normal_value, @normal_spec, @required_int, @sort_order, @parent_id)'
  )
  // Simple parser to produce a normal_spec JSON from normal_value
  const parseNumber = (s: string): number | undefined => {
    const m = (s || '').replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/)
    if (!m) return undefined
    const n = parseFloat(m[0])
    return Number.isFinite(n) ? n : undefined
  }
  const asJson = (obj: any) => {
    try {
      return JSON.stringify(obj)
    } catch {
      return null
    }
  }
  const parseRange = (raw: string): { min?: number; max?: number } | null => {
    const s = (raw || '').replace(/\s+/g, ' ').trim()
    if (!s) return null
    let m = s.match(/^>=\s*([\d.,]+)$/i)
    if (m) return { min: parseNumber(m[1]) }
    m = s.match(/^>\s*([\d.,]+)$/i)
    if (m) return { min: parseNumber(m[1]) }
    m = s.match(/^<=\s*([\d.,]+)$/i)
    if (m) return { max: parseNumber(m[1]) }
    m = s.match(/^<\s*([\d.,]+)$/i)
    if (m) return { max: parseNumber(m[1]) }
    m = s.match(/^([\d.,]+)\s*(?:-|–|—|to)\s*([\d.,]+)$/i)
    if (m) return { min: parseNumber(m[1]), max: parseNumber(m[2]) }
    m = s.match(/^([\d.,]+)\s*\+$/)
    if (m) return { min: parseNumber(m[1]) }
    const n = parseNumber(s)
    if (n !== undefined) return { min: n, max: n }
    return null
  }
  const parseOptions = (raw: string): string[] | null => {
    const s = (raw || '').trim()
    if (!s) return null
    try {
      const arr = JSON.parse(s)
      if (Array.isArray(arr) && arr.every((x) => typeof x === 'string')) return arr as string[]
    } catch {
      /* ignore JSON parse */
    }
    if (/[|,/]/.test(s)) {
      const parts = s
        .split(/[|,/]/)
        .map((p) => p.trim())
        .filter(Boolean)
      if (parts.length >= 2) return parts
    }
    if (/\bpositive\b|\bnegative\b/i.test(s)) return ['POSITIVE', 'NEGATIVE']
    return null
  }
  const parseSexedRange = (
    raw: string
  ): { male?: { min?: number; max?: number }; female?: { min?: number; max?: number } } | null => {
    const s = (raw || '').replace(/;/g, ',')
    const parts = s
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return null
    let male: { min?: number; max?: number } | undefined
    let female: { min?: number; max?: number } | undefined
    for (const p of parts) {
      const pm = p.match(/^(m|male)\s*[:=]\s*(.+)$/i)
      const pf = p.match(/^(f|female)\s*[:=]\s*(.+)$/i)
      if (pm) male = parseRange(pm[2]) || male
      else if (pf) female = parseRange(pf[2]) || female
    }
    if (!male && !female) return null
    return { male, female }
  }
  let inserted = 0
  for (const r of rows) {
    const nv = r.normal_value ?? ''
    // Prefer provided normal_spec if present; fall back to deriving from normal_value
    let normal_spec_str: string | null = null
    const provided = (r as any).normal_spec
    if (provided && typeof provided === 'string') {
      try {
        JSON.parse(provided)
        normal_spec_str = provided
      } catch {
        normal_spec_str = null
      }
    } else if (provided && typeof provided === 'object') {
      const s = asJson(provided)
      normal_spec_str = s
    }
    if (!normal_spec_str) {
      let normal_spec: any = null
      const sexed = parseSexedRange(nv)
      if (sexed) normal_spec = { type: 'sexed-range', ...sexed }
      else {
        const rng = parseRange(nv)
        if (rng) normal_spec = { type: 'range', range: rng }
        else {
          const opts = parseOptions(nv)
          if (opts) normal_spec = { type: 'options', options: opts }
        }
      }
      normal_spec_str = normal_spec ? asJson(normal_spec) : null
    }
    const info: any = insertIgnore.run({
      category: r.category,
      name: r.name,
      result: r.result ?? '',
      normal_value: r.normal_value ?? '',
      normal_spec: normal_spec_str,
      required_int: r.required ? 1 : 0,
      sort_order: typeof (r as any).sort_order === 'number' ? (r as any).sort_order : null,
      parent_id: typeof (r as any).parent_id === 'number' ? (r as any).parent_id : null,
    })
    if (info.changes === 1) inserted++
  }
  return { inserted, skipped: rows.length - inserted }
}

// Updated canonical tests set (2025-09-22)
export const UPDATED_TESTS_2025_09_22: Array<{
  id?: number
  category: string
  name: string
  normal_value?: string
  normal_spec?: string
  result?: string
  required?: boolean
  sort_order?: number
  parent_id?: number | null
}> = [
  { id: 1, category: 'Blood Group', name: 'BLOOD GROUP', normal_value: '', result: '', required: false, sort_order: 0 },
  {
    id: 2,
    category: 'CA',
    name: 'CA',
    normal_value: 'M:8.5 TO 10.5 F:8.6TO10.7',
    normal_spec: '{"type":"sexed-range","male":{"min":8.5,"max":10.5},"female":{"min":8.6,"max":10.7}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 3,
    category: 'ESR',
    name: 'ESR',
    normal_value: '0 TO 15 MM/HR MEN 0 TO 20 MM/HR WOMEN',
    normal_spec: '{"type":"sexed-range","male":{"min":0,"max":15},"female":{"min":0,"max":20}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 4,
    category: 'H-Pylori',
    name: 'HPL',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 5,
    category: 'H.B',
    name: 'HB',
    normal_value: '12 to 15',
    normal_spec: '{"type":"range","range":{"min":12,"max":15}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 6,
    category: 'Hepatitis',
    name: 'ANTI HCV',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 7,
    category: 'Hepatitis',
    name: 'HEP B',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 8,
    category: 'LFT',
    name: 'ALT',
    normal_value: '30 - 40mg% ',
    normal_spec: '{"type":"range","range":{"min":30,"max":40}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 9,
    category: 'LFT',
    name: 'AST',
    normal_value: 'Upto 45mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":45}}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 10,
    category: 'LFT',
    name: 'ALK PHOS',
    normal_value: 'More Than 135mg%',
    normal_spec: '{"type":"range","range":{"min":135,"max":9999}}',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 11,
    category: 'LFT',
    name: 'BILLURUBIN',
    normal_value: 'Upto 1.5mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":1.5}}',
    result: '',
    required: false,
    sort_order: 3,
  },
  {
    id: 12,
    category: 'Lipid Profile',
    name: 'CHOLESTROL',
    normal_value: '150 -200mg%',
    normal_spec: '{"type":"range","range":{"min":150,"max":200}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 13,
    category: 'Lipid Profile',
    name: 'TRIGLYCRIDE',
    normal_value: 'Upto 150mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":150}}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 14,
    category: 'Lipid Profile',
    name: 'HDL',
    normal_value: 'More Than 40mg%',
    normal_spec: '{"type":"range","range":{"min":40,"max":9999}}',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 15,
    category: 'Lipid Profile',
    name: 'LDL',
    normal_value: 'Upto 150mg%',
    normal_spec: '{"type":"range","range":{"min":0,"max":150}}',
    result: '',
    required: false,
    sort_order: 3,
  },
  {
    id: 16,
    category: 'Liver Function Test',
    name: 'ALT',
    normal_value: 'F=31mg% M=40mg%',
    normal_spec: '{"type":"sexed-range","male":{"min":0,"max":40},"female":{"min":0,"max":31}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 17,
    category: 'MP',
    name: 'MP',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 189,
    category: 'MP',
    name: 'PF',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
    parent_id: 17,
  },
  {
    id: 190,
    category: 'MP',
    name: 'PAN',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 1,
    parent_id: 17,
  },
  {
    id: 18,
    category: 'Renal Function Test',
    name: 'BLOOD UREA',
    normal_value: '10 - 50 mg%',
    normal_spec: '{"type":"range","range":{"min":10,"max":50}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 19,
    category: 'Renal Function Test',
    name: 'CREATENINE',
    normal_value: '0.5 - 1.3 mg%',
    normal_spec: '{"type":"range","range":{"min":0.5,"max":1.3}}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 20,
    category: 'Renal Function Test',
    name: 'URIC ACID',
    normal_value: 'M:3.0-7.0 F: 2.5-5.0',
    normal_spec: '{"type":"sexed-range","male":{"min":3,"max":7},"female":{"min":2.5,"max":5}}',
    result: '',
    required: false,
    sort_order: 2,
  },
  {
    id: 21,
    category: 'Serology',
    name: 'BLOOD SUGAR',
    normal_value: '70-120 mg/dl',
    normal_spec: '{"type":"range","range":{"min":70,"max":120}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 22,
    category: 'Triglycride',
    name: 'TRIGLYCRIDE',
    normal_value: 'UPTO  150 MG',
    normal_spec: '{"type":"range","range":{"min":0,"max":150}}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 23,
    category: 'Typhoid',
    name: 'IGG',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  {
    id: 24,
    category: 'Typhoid',
    name: 'IGM',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 1,
  },
  {
    id: 25,
    category: 'UPT',
    name: 'UPT',
    normal_value: '',
    normal_spec:
      '{"type":"options","options":[{"label":"POSITIVE","color":"#FF0000"},{"label":"NEGATIVE","color":"#00FF00"}]}',
    result: '',
    required: false,
    sort_order: 0,
  },
  { id: 26, category: 'URINE REPORT', name: 'COLOR', normal_value: '', result: '', required: true, sort_order: 0 },
  { id: 27, category: 'URINE REPORT', name: 'TURBIDITY', normal_value: '', result: '', required: true, sort_order: 1 },
  {
    id: 28,
    category: 'URINE REPORT',
    name: 'SPECIFC GRAVITY',
    normal_value: '',
    result: '',
    required: true,
    sort_order: 2,
  },
  { id: 29, category: 'URINE REPORT', name: 'DEPOSIT', normal_value: '', result: '', required: true, sort_order: 3 },
  { id: 30, category: 'URINE REPORT', name: 'PH', normal_value: '', result: '', required: true, sort_order: 4 },
  { id: 31, category: 'URINE REPORT', name: 'GLUCOSE', normal_value: '', result: '', required: true, sort_order: 5 },
  { id: 32, category: 'URINE REPORT', name: 'KETONES', normal_value: '', result: '', required: true, sort_order: 6 },
  { id: 33, category: 'URINE REPORT', name: 'PROTEIN', normal_value: '', result: '', required: true, sort_order: 7 },
  { id: 34, category: 'URINE REPORT', name: 'BLOOD', normal_value: '', result: '', required: true, sort_order: 8 },
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
  { id: 38, category: 'URINE REPORT', name: 'NITRITES', normal_value: '', result: '', required: true, sort_order: 12 },
  { id: 39, category: 'URINE REPORT', name: 'LEU', normal_value: '', result: '', required: true, sort_order: 13 },
  { id: 40, category: 'URINE REPORT', name: 'PUS CELLS', normal_value: '', result: '', required: true, sort_order: 14 },
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
  { id: 43, category: 'URINE REPORT', name: 'CASTS', normal_value: '', result: '', required: true, sort_order: 17 },
  { id: 44, category: 'URINE REPORT', name: 'CRYSTALS', normal_value: '', result: '', required: true, sort_order: 18 },
  { id: 45, category: 'URINE REPORT', name: 'ANORPHOUS', normal_value: '', result: '', required: true, sort_order: 19 },
  { id: 46, category: 'URINE REPORT', name: 'ORGANISMS', normal_value: '', result: '', required: true, sort_order: 20 },
  { id: 47, category: 'URINE REPORT', name: 'MISC', normal_value: '', result: '', required: true, sort_order: 21 },
]

/** Check if we should prompt to apply the 2025-09-22 tests update (only prompt once). */
export function needsTestsUpdate2025(): boolean {
  try {
    const database = getDb()
    database.exec(
      `CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
    )
    const applied = database.prepare('SELECT 1 FROM schema_meta WHERE key = ?').get('tests_update_2025_09_22_applied')
    const prompted = database.prepare('SELECT 1 FROM schema_meta WHERE key = ?').get('tests_update_2025_09_22_prompted')
    return !applied && !prompted
  } catch {
    return false
  }
}

export function markTestsUpdatePrompted2025() {
  try {
    const database = getDb()
    database
      .prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)')
      .run('tests_update_2025_09_22_prompted', '1')
  } catch {
    // ignore
  }
}

/** Apply the 2025-09-22 tests update via upsert and mark applied. */
export function applyTestsUpdate2025(rows: typeof UPDATED_TESTS_2025_09_22 = UPDATED_TESTS_2025_09_22) {
  const database = getDb()
  const insertWithId = database.prepare(
    'INSERT OR IGNORE INTO test (id, category, name, result, normal_value, normal_spec, required, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const insertNoId = database.prepare(
    'INSERT OR IGNORE INTO test (category, name, result, normal_value, normal_spec, required, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const updateById = database.prepare(
    'UPDATE test SET category = ?, name = ?, result = ?, normal_value = ?, normal_spec = ?, required = ?, sort_order = ?, parent_id = ? WHERE id = ?'
  )
  const selectById = database.prepare('SELECT id FROM test WHERE id = ?')
  const selectByKeyWithParent = database.prepare(
    'SELECT id FROM test WHERE category = ? AND name = ? AND parent_id = ?'
  )
  const selectByKeyRoot = database.prepare('SELECT id FROM test WHERE category = ? AND name = ? AND parent_id IS NULL')

  let inserted = 0
  let updated = 0
  for (const raw of rows) {
    const category = raw.category?.trim() || ''
    const name = raw.name?.trim() || ''
    if (!category || !name) continue

    const base = {
      category,
      name,
      result: (raw.result || '').toString().trim(),
      normal_value: (raw.normal_value || '').toString().trim(),
      required: raw.required ? 1 : 0,
      sort_order: typeof (raw as any).sort_order === 'number' ? (raw as any).sort_order : null,
      parent_id: typeof (raw as any).parent_id === 'number' ? (raw as any).parent_id : null,
      normal_spec: null as string | null,
    }
    if (typeof (raw as any).normal_spec === 'string') {
      try {
        JSON.parse((raw as any).normal_spec)
        base.normal_spec = (raw as any).normal_spec
      } catch {
        base.normal_spec = JSON.stringify({ type: 'text' })
      }
    } else if ((raw as any).normal_spec && typeof (raw as any).normal_spec === 'object') {
      try {
        base.normal_spec = JSON.stringify((raw as any).normal_spec)
      } catch {
        base.normal_spec = JSON.stringify({ type: 'text' })
      }
    } else {
      base.normal_spec = JSON.stringify({ type: 'text' })
    }

    let existing: { id: number } | undefined
    if (raw.id && Number.isFinite(raw.id) && (raw as any).id > 0) {
      existing = selectById.get((raw as any).id) as any
    }
    if (!existing) {
      if (base.parent_id != null) existing = selectByKeyWithParent.get(base.category, base.name, base.parent_id) as any
      else existing = selectByKeyRoot.get(base.category, base.name) as any
    }
    if (existing?.id) {
      const info = updateById.run(
        base.category,
        base.name,
        base.result,
        base.normal_value,
        base.normal_spec,
        base.required,
        base.sort_order,
        base.parent_id,
        existing.id
      )
      if (info?.changes === 1) updated++
    } else {
      let info: any
      if (raw.id && Number.isFinite(raw.id) && (raw as any).id > 0) {
        info = insertWithId.run(
          (raw as any).id,
          base.category,
          base.name,
          base.result,
          base.normal_value,
          base.normal_spec,
          base.required,
          base.sort_order,
          base.parent_id
        )
      } else {
        info = insertNoId.run(
          base.category,
          base.name,
          base.result,
          base.normal_value,
          base.normal_spec,
          base.required,
          base.sort_order,
          base.parent_id
        )
      }
      if (info?.changes === 1) inserted++
    }
  }
  // Mark applied
  database
    .prepare('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)')
    .run('tests_update_2025_09_22_applied', '1')
  logEvent({ action: 'TESTS_UPDATE_2025_APPLIED', payload: { inserted, updated } })
  return { inserted, updated }
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
    normal_spec TEXT,
    required INTEGER DEFAULT 0,
    sort_order INTEGER,
    parent_id INTEGER,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  )`)
  // Note: Do not create indexes that reference parent_id before migration.
  // Indexes are (re)created after ensuring columns exist below.

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
    // Add parent_id column if missing
    if (!cols.some((c) => c.name === 'parent_id')) {
      database.exec('ALTER TABLE test ADD COLUMN parent_id INTEGER')
      console.warn('[DB] Added parent_id column to test table')
    }
    // Add normal_spec column if missing
    if (!cols.some((c) => c.name === 'normal_spec')) {
      database.exec('ALTER TABLE test ADD COLUMN normal_spec TEXT')
      console.warn('[DB] Added normal_spec column to test table')
    }
    // Recreate uniqueness with partial indexes; drop legacy index if present
    try {
      database.exec('DROP INDEX IF EXISTS idx_test_category_name')
    } catch {
      /* ignore */
    }
    database.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_test_cat_name_root ON test(category, name) WHERE parent_id IS NULL`
    )
    database.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_test_cat_name_parent ON test(category, name, parent_id) WHERE parent_id IS NOT NULL`
    )
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

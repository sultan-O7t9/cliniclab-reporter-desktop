import { type App, BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getDb, logEvent, resetDatabase } from '@/lib/main/database'
import { reseedTests, DEFAULT_TESTS } from '@/lib/main/database'
import fs from 'fs'
import path from 'path'
import QRCode from 'qrcode'

const escapeHtml = (v: any) =>
  (v == null ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const registerAppHandlers = (app: App) => {
  const resolveResourcesDir = () => {
    return app.isPackaged ? path.join(process.resourcesPath, 'resources') : path.join(app.getAppPath(), 'resources')
  }

  const getLogoDataUri = () => {
    try {
      const possible = [
        path.join(resolveResourcesDir(), 'icons', 'clinic-logo.png'),
        path.join(resolveResourcesDir(), 'icons', 'icon.png'),
      ]
      const file = possible.find((p) => fs.existsSync(p))
      if (!file) return ''
      const data = fs.readFileSync(file)
      return 'data:image/png;base64,' + data.toString('base64')
    } catch {
      return ''
    }
  }

  const buildQrForPhone = async (phoneRaw: string) => {
    const digits = phoneRaw.replace(/[^0-9+]/g, '')
    if (!digits) return ''
    try {
      // Use tel: URI so scanner-capable devices open dialer
      return await QRCode.toDataURL(`tel:${digits}`, { margin: 0, width: 128 })
    } catch {
      return ''
    }
  }

  const buildReportHtml = async (report: any) => {
    const patientName = (report?.patient?.name || '').toString().toUpperCase()
    const patientAge = report?.patient?.age || ''
    const patientSex = report?.patient?.sex || ''
    // Normalize Father/Husband: trim and only uppercase if non-empty; placeholder shown later
    const fatherOrHusbandRaw = (report?.patient?.fatherOrHusband ?? '').toString().trim()
    const fatherOrHusband = fatherOrHusbandRaw ? fatherOrHusbandRaw.toUpperCase() : ''
    const generatedAt = report?.generatedAt || new Date().toISOString()
    const registrationDate = new Date(generatedAt).toLocaleDateString()
    const categories: any[] = Array.isArray(report?.tests) ? report.tests : []
    const groupEntries = categories
      .map((cat) => {
        const tests: any[] = cat.tests || []
        if (!tests.length) return null
        const categoryName = String(cat.category || '')
        if (categoryName.toUpperCase() === 'URINE REPORT') {
          // Custom structured layout for urine report with smart defaults and typo normalization.
          const map: Record<string, any> = {}
          ;(tests || []).forEach((t: any) => {
            map[String(t.name).trim().toUpperCase()] = t
          })

          const DEFAULT_NILL = new Set([
            'GLUCOSE',
            'KETONES',
            'PROTEIN',
            'BLOOD',
            'HAEMOGLOBIN',
            'UROBILINOGEN',
            'BILLIRUBIN',
            'NITRITES',
            'LEU',
            'CASTS',
            'CRYSTALS',
            'ANORPHOUS',
            'MISC',
          ])
          const rawValue = (label: string) =>
            (map[label]?.result || map[label]?.normal || map[label]?.normal_value || '').toString().trim()
          const getVal = (label: string) => {
            const v = rawValue(label)
            if (!v && DEFAULT_NILL.has(label)) return 'NILL'
            return escapeHtml(v)
          }
          const urineHtml = `<div class="urine-report-page">
    <div class="urine-title">URINE REPORT</div>
    <div class="urine-top-grid">
      <span class="urine-label">COLOR:</span>
      <span class="urine-value">${getVal('COLOR')}</span><span class="urine-label">Turbidity:</span><span class="urine-value">${getVal('TURBIDITY')}</span><span class="urine-label">Specific Gravity:</span><span class="urine-value">${getVal('SPECIFC GRAVITY') || getVal('SPECIFIC GRAVITY')}</span><span class="urine-label">Deposit:</span><span class="urine-value">${getVal('DEPOSIT')}</span>
    </div>

    <div class="urine-columns">
      <div class="urine-col">
        <div class="urine-col-head">Chemical Examination</div>
        <table class="urine-inner-table">
          <tbody>
            <tr><td>PH</td><td>${getVal('PH')}</td></tr>
            <tr><td>GLUCOSE</td><td>${getVal('GLUCOSE')}</td></tr>
            <tr><td>KETONES</td><td>${getVal('KETONES')}</td></tr>
            <tr><td>PROTEIN</td><td>${getVal('PROTEIN')}</td></tr>
            <tr><td>BLOOD</td><td>${getVal('BLOOD')}</td></tr>
            <tr><td>HAEMOGLOBIN</td><td>${getVal('HAEMOGLOBIN')}</td></tr>
            <tr><td>UROBILINOGEN</td><td>${getVal('UROBILINOGEN')}</td></tr>
            <tr><td>BILLIRUBIN</td><td>${getVal('BILLIRUBIN')}</td></tr>
            <tr><td>NITRITES</td><td>${getVal('NITRITES')}</td></tr>
            <tr><td>LEU</td><td>${getVal('LEU')}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="urine-col">
        <div class="urine-col-head">Microscopic Examination</div>
        <table class="urine-inner-table">
          <tbody>
            <tr><td>PUS CELLS</td><td>${getVal('PUS CELLS')}</td><td class="urine-unit">/HPF</td></tr>
            <tr><td>RED BLOOD CELLS</td><td>${getVal('RED BLOOD CELLS')}</td><td class="urine-unit">/HPF</td></tr>
            <tr><td>EPITHELIAL CELLS</td><td>${getVal('EPITHELIAL CELLS')}</td><td class="urine-unit">/HPF</td></tr>
            <tr><td>CASTS</td><td>${getVal('CASTS')}</td></tr>
            <tr><td>CRYSTALS</td><td>${getVal('CRYSTALS')}</td></tr>
            <tr><td>ANORPHOUS</td><td>${getVal('ANORPHOUS')}</td><td class="urine-unit">/HPF</td></tr>
            <tr><td>ORGANISMS</td><td>${escapeHtml(rawValue('ORGANISMS'))}</td><td class="urine-unit">/HPF</td></tr>
            <tr><td>MISC</td><td>${getVal('MISC')}</td><td class="urine-unit">/HPF</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`
          return { html: urineHtml, breakAfter: true, category: categoryName, urine: true }
        }
        const hasAnyNormal = tests.some((t) => t.normal && String(t.normal).trim() !== '')
        const headerRow = `<tr>
              <th>TEST NAME</th>
              ${hasAnyNormal ? '' : '<th></th>'}
              <th>RESULT</th>
              ${hasAnyNormal ? '<th>NORMAL VALUE</th>' : ''}
            </tr>`
        const sortedTests = tests.slice().sort((a: any, b: any) => {
          const ao = typeof a.sort_order === 'number' ? a.sort_order : 999999
          const bo = typeof b.sort_order === 'number' ? b.sort_order : 999999
          if (ao !== bo) return ao - bo
          if (typeof a.id === 'number' && typeof b.id === 'number' && a.id !== b.id) return a.id - b.id
          return String(a.name).localeCompare(String(b.name))
        })
        const rows = sortedTests
          .map(
            (t: any) => `<tr>
                <td>${escapeHtml(t.name)}</td>
                ${hasAnyNormal ? '' : '<td></td>'}
                <td>${escapeHtml(t.result)}</td>
                ${hasAnyNormal ? '<td>' + escapeHtml(t.normal || '') + '</td>' : ''}
              </tr>`
          )
          .join('')
        const html = `<div class="report-group" style="margin-bottom:22px;">
              <div class="group-title">${escapeHtml(cat.category)}</div>
              <table class="report-table equal-cols">
                <thead>${headerRow}</thead>
                <tbody>${rows}</tbody>
              </table>
            </div>`
        return { html, breakAfter: !!cat.breakAfter, category: categoryName }
      })
      .filter(Boolean) as { html: string; breakAfter: boolean; category: string; urine?: boolean }[]

    const urineIndex = groupEntries.findIndex((g) => g.urine)
    const tableSections = groupEntries
      .map((entry, idx) => {
        // If urine report: ensure it's isolated on its own page
        if (entry.urine) {
          const before = idx === 0 ? '' : '<div class="page-break"></div>'
          const after = idx === groupEntries.length - 1 ? '' : '<div class="page-break"></div>'
          return before + `<div class="urine-wrapper">${entry.html}</div>` + after
        }
        const isEndOfPage = (idx + 1) % 4 === 0 && idx !== groupEntries.length - 1
        let suffix = ''
        // If there is a urine report elsewhere and this entry is adjacent, force page break boundaries
        if (entry.breakAfter) {
          suffix =
            '<div class="manual-break-spacer" aria-hidden="true"></div><div class="page-break"></div><div class="page-top-spacer"></div>'
        } else if (isEndOfPage) {
          suffix = '<div class="page-break"></div><div class="page-top-spacer"></div>'
        } else if (urineIndex !== -1 && idx > urineIndex && idx === urineIndex + 1) {
          // First normal group after urine report
          suffix = '<div class="page-top-spacer"></div>'
        }
        return entry.html + suffix
      })
      .join('')
    const PHONE_DISPLAY = '0349 4695920'
    const qrDataUri = await buildQrForPhone(PHONE_DISPLAY)
    const logoDataUri = getLogoDataUri()
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Report</title>
  <style>
  * {color:#17365d;}
  body { margin:24px; font-family:Arial,Helvetica,sans-serif; }
  .clinic-header { text-align:center; margin-bottom:24px; position:relative; }
  .clinic-header .logo { position:absolute; left:0; top:0; height:70px; }
  .clinic-header .qr { position:absolute; right:128px; top:48px; height:48px; width:48px; object-fit:contain; }
  .clinic-header .phone-label { position:absolute; right:90px; top:4px; font-size:12px; font-family:Cambria,serif; font-weight:600; letter-spacing:0.5px; }
  .clinic-header .title {text-decoration:underline; font-size:36px;color:#17365d;font-family:Cambria,serif; font-weight:700; letter-spacing:1px; }
  .clinic-header .subtitle1 {color:#17365d; font-size:10px; margin-top:4px; font-family:Arial,sans-serif;}
  .clinic-header .subtitle2, .clinic-header .subtitle3 { font-size:10px; font-family:Arial,sans-serif; line-height:1.2; margin-top:2px; color:#17365d; }
  .patient-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:4px 12px; font-family:Cambria,serif; font-size:10px; color:#17365d; max-width:70%;margin:0 auto 16px; }
  .patient-grid .cell {text-transform:uppercase; line-height:1.3; }
  .patient-grid .lbl {text-wrap:nowrap; text-transform:uppercase; margin-right:4px; }
  .report-group { page-break-inside: avoid; break-inside: avoid; margin-bottom:22px; }
  .page-break { page-break-after: always; break-after: page; }
  .content-wrapper { padding-bottom:70px; }
  .page-top-spacer { height:18px; }
  .footer { position:fixed; bottom:20px; left:24px; right:24px; font-size:12px;width:100%;display:flex;justify-content:flex-end;color:#17365d; }
  .footer .label {color:#17365d; font-size:14px; font-family:Cambria,serif; margin-right:8px; }
  .report-table { border-collapse:collapse; width:100%; max-width:70%; margin:0 auto 8px; table-layout:fixed; }
  .report-table.equal-cols th, .report-table.equal-cols td { width:33.3333%; }
  .report-table thead { border:1.5px solid #17365d; }
  .report-table th, .report-table td {  padding:6px 6px; font-size:11px; font-family:Cambria,serif; text-align:center; vertical-align:middle; }
  .report-table th { padding:2px 6px; }
  .report-table thead th { background:#f0f0f0; font-weight:600; }
  .group-title { font-family:Cambria,serif; font-size:18px; font-weight:bold; margin:12px auto 6px; text-align:center; }
  .lbl-small { font-size:9px; }
  .manual-break-spacer { height:48px; }
  /* Urine report styles */
  .urine-wrapper { page-break-inside:avoid; break-inside:avoid; }
  .urine-report-page { max-width:80%; margin:0 auto 12px; font-family:Cambria,serif; font-size:11px; }
  .urine-title { text-align:center; font-size:22px; font-weight:bold; margin:12px 0 16px; }
  .urine-top-grid {font-family:Calibri,sans-serif; font-size:12px; text-transform:uppercase;  display:grid; grid-template-columns:repeat(4,1fr);  border:1px solid #17365d; border-bottom:none; padding:4px 10px; }
  .urine-top-row { display:flex; flex-wrap:wrap; gap:8px 24px; margin:2px 0; }
  .urine-label { min-width:90px; }
  .urine-value { min-width:60px;  padding:0 4px; }
  .urine-divider { border-top:1px solid #17365d; margin:8px 0 10px; }
  .urine-columns { display:flex; align-items:flex-start; border:1px solid #17365d; font-family:Calibri,sans-serif; font-size:12px; text-transform:uppercase; }
  .urine-col { flex:1; }
  .urine-col:first-child { border-right:1px solid #17365d; }
  .urine-col-head { text-transform:uppercase;  text-align:center;border-bottom:1px solid #17365d; }
  .urine-inner-table { width:100%; border-collapse:collapse; }
  .urine-inner-table td { padding:3px 4px;  }
  .urine-inner-table tr:last-child td { border-bottom:none; }
  .urine-unit { font-size:9px; color:#17365d; padding-left:4px; }
  /* Removed automatic page-break-after on .urine-wrapper to prevent extra blank page; rely on explicit .page-break divs */
  /* @media print { .urine-wrapper { page-break-after:always; }
    .urine-wrapper:last-child { page-break-after:auto; } } */
  @media print { .report-group { page-break-inside: avoid; break-inside: avoid; } }
  </style>
  <!-- Auto print script removed to avoid duplicate dialogs when using direct print -->
</head>
<body>
  <div class="clinic-header">

    ${qrDataUri ? `<img class="qr" src="${qrDataUri}" />` : ''}
    <div class="title">SHAMIM ARSHAD CLINIC</div>

    <b class="subtitle1">NOT VALID FOR ANY COURT</b>
    <div class="subtitle2">OPPOSITE FAUJI TOWER EID GAAH CHOWK <b>KUNJAH</b></div>
    <div class="subtitle3">CELL NUMBER <b>--- ${PHONE_DISPLAY}</b></div>
  </div>
  <div class="patient-grid">
    <div class="cell"><span class="lbl">Patient Name</span></div>
    <div class="cell"><b class="lbl">${escapeHtml(patientName) || '—'}</b></div>
    <div class="cell"><span class="lbl">Registration Date</span></div>
    <div class="cell"><span class="lbl">${escapeHtml(registrationDate)}</span></div>
  <div class="cell"><span class="lbl">Father/Husband</span></div>
  <div class="cell"><b class="lbl">${escapeHtml(fatherOrHusband) || '----'}</b></div>
    <div class="cell"><span class="lbl">Collect Report</span></div>
    <div class="cell"><span class="lbl">${escapeHtml(registrationDate)}</span></div>
    <div class="cell"><span class="lbl">AGE / SEX</span></div>
    <div class="cell"><b class="lbl lbl-small">${escapeHtml(patientAge.toString())}/${escapeHtml((patientSex || '').toString().toUpperCase())}</b></div>
    <div class="cell"><span class="lbl">REGISTRATION LOCATION</span></div>
    <div class="cell"><b class="lbl lbl-small">SHAMIM ARSHAD CLINIC</b></div>
    <div class="cell"></div>
    <div class="cell"></div>
  </div>
  <div class="content-wrapper">
    ${tableSections || '<div style="font-size:12px;">No tests.</div>'}
  </div>
  <div class="footer"><span class="label">LAB TECH</span>_______________</div>
</body>
</html>`
    return html
  }
  // App operations
  handle('version', () => {
    logEvent({ action: 'VERSION_QUERY' })
    return app.getVersion()
  })
  handle('test-categories', () => {
    const db = getDb()
    logEvent({ action: 'LIST_CATEGORIES' })
    const rows = db.prepare('SELECT DISTINCT category FROM test ORDER BY category').all() as { category: string }[]
    return rows.map((r) => r.category)
  })
  handle('tests-by-category', (category: string) => {
    const db = getDb()
    logEvent({ action: 'TESTS_BY_CATEGORY', payload: { category } })
    const rows = db
      .prepare(
        'SELECT id, category, name, result, normal_value, required, sort_order, timestamp FROM test WHERE category = ? ORDER BY COALESCE(sort_order, 999999), id'
      )
      .all(category) as any[]
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      result: r.result,
      normal_value: r.normal_value,
      required: !!r.required,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
      timestamp: r.timestamp,
    })) as any
  })
  handle('save-test-record', (payload: any) => {
    const db = getDb()
    // Ensure migration ran (defensive): add column if missing before insert
    try {
      const cols = db.prepare('PRAGMA table_info(test_records)').all() as { name: string }[]
      if (!cols.some((c) => c.name === 'patient_father_or_husband')) {
        db.exec('ALTER TABLE test_records ADD COLUMN patient_father_or_husband TEXT')
      }
    } catch {
      // ignore; migration already attempted in seedDatabase
    }
    const stmt = db.prepare(
      'INSERT INTO test_records (patient_name, patient_age, patient_sex, patient_father_or_husband, payload) VALUES (?, ?, ?, ?, ?)'
    )
    const info = stmt.run(
      payload.patient?.name || '',
      payload.patient?.age ? Number(payload.patient.age) : null,
      payload.patient?.sex || '',
      payload.patient?.fatherOrHusband || '',
      JSON.stringify(payload)
    )
    const id = Number(info.lastInsertRowid)
    logEvent({ action: 'SAVE_TEST_RECORD', payload: { id } })
    return { id }
  })
  handle('generate-report-pdf', () => {
    logEvent({ action: 'GENERATE_PDF' })
    return { filePath: '', disabled: true }
  })
  handle('open-report-preview', ({ report }: { report: any }) => {
    logEvent({ action: 'OPEN_REPORT_PREVIEW' })
    const promise = (async () => {
      const win = new BrowserWindow({
        show: true,
        width: 900,
        height: 1000,
        webPreferences: { sandbox: false },
      })
      const html = await buildReportHtml(report)
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      // Return immediately; user can print via auto or Ctrl+P
      return { opened: true }
    })()
    return promise as any
  })
  handle('print-report', ({ report }: { report: any }) => {
    logEvent({ action: 'PRINT_REPORT_ATTEMPT' })
    const promise = (async () => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false },
      })
      const html = await buildReportHtml(report)
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      return await new Promise<{ printed: boolean; error?: string }>((resolve) => {
        win.webContents.print(
          {
            silent: false,
            printBackground: false,
            landscape: false,
          },
          (success, failureReason) => {
            try {
              win.destroy()
            } catch {
              /* ignore */
            }
            if (!success) {
              logEvent({ action: 'PRINT_REPORT_FAIL', level: 'ERROR', message: failureReason || 'Unknown' })
              return resolve({ printed: false, error: failureReason || 'Unknown print failure' })
            }
            logEvent({ action: 'PRINT_REPORT_SUCCESS' })
            resolve({ printed: true })
          }
        )
      })
    })()
    return promise as any
  })
  handle('recent-test-records', ({ limit }: { limit: number }) => {
    logEvent({ action: 'RECENT_TEST_RECORDS', payload: { limit } })
    const db = getDb()
    const stmt = db.prepare(
      `SELECT id, patient_name, patient_age, patient_sex, patient_father_or_husband, created_at, payload
       FROM test_records ORDER BY id DESC LIMIT ?`
    )
    const rows = stmt.all(limit) as any[]
    return rows.map((r) => {
      let cats: string | null = null
      try {
        if (r.payload) {
          const parsed = JSON.parse(r.payload)
          if (parsed && Array.isArray(parsed.tests)) {
            const set = new Set<string>()
            for (const g of parsed.tests) {
              if (g?.category) set.add(String(g.category))
            }
            cats = Array.from(set).join(', ')
          }
        }
      } catch {
        /* ignore parse errors */
      }
      return {
        id: r.id,
        patient_name: r.patient_name,
        patient_age: r.patient_age,
        patient_sex: r.patient_sex,
        patient_father_or_husband: r.patient_father_or_husband,
        created_at: r.created_at,
        test_categories: cats,
      }
    })
  })
  handle('search-test-records', ({ query, limit }: { query: string; limit: number }) => {
    logEvent({ action: 'SEARCH_TEST_RECORDS', payload: { q: query, limit } })
    const db = getDb()
    const trimmed = (query || '').trim()
    if (!trimmed) return []
    let rows: any[] = []
    try {
      // Try FTS5 MATCH first (prefix search with *) safely escaping quotes
      const ftsTerm = trimmed
        .replace(/['"`]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t + '*')
        .join(' ')
      const stmt =
        db.prepare(`SELECT r.id, r.patient_name, r.patient_age, r.patient_sex, r.patient_father_or_husband, r.created_at, r.payload
        FROM test_records_fts f JOIN test_records r ON f.rowid = r.id
        WHERE f.patient_name MATCH ? ORDER BY r.id DESC LIMIT ?`)
      rows = stmt.all(ftsTerm, limit) as any[]
    } catch {
      // Fallback to LIKE (case-insensitive)
      const like = `%${trimmed.toLowerCase()}%`
      const stmt =
        db.prepare(`SELECT id, patient_name, patient_age, patient_sex, patient_father_or_husband, created_at, payload
        FROM test_records WHERE LOWER(patient_name) LIKE ? ORDER BY id DESC LIMIT ?`)
      rows = stmt.all(like, limit) as any[]
    }
    return rows.map((r) => {
      let cats: string | null = null
      try {
        if (r.payload) {
          const parsed = JSON.parse(r.payload)
          if (parsed && Array.isArray(parsed.tests)) {
            const set = new Set<string>()
            for (const g of parsed.tests) if (g?.category) set.add(String(g.category))
            cats = Array.from(set).join(', ')
          }
        }
      } catch {
        /* ignore parse error */
      }
      return {
        id: r.id,
        patient_name: r.patient_name,
        patient_age: r.patient_age,
        patient_sex: r.patient_sex,
        patient_father_or_husband: r.patient_father_or_husband,
        created_at: r.created_at,
        test_categories: cats,
      }
    })
  })
  handle('get-test-record', (id: number) => {
    logEvent({ action: 'GET_TEST_RECORD', payload: { id } })
    const db = getDb()
    const row = db
      .prepare(
        'SELECT id, patient_name, patient_age, patient_sex, patient_father_or_husband, payload, created_at FROM test_records WHERE id = ?'
      )
      .get(id) as any
    if (!row) return null
    let parsed: any = null
    try {
      parsed = JSON.parse(row.payload)
    } catch {
      /* ignore parse error */
    }
    return {
      id: row.id,
      patient_name: row.patient_name,
      patient_age: row.patient_age,
      patient_sex: row.patient_sex,
      patient_father_or_husband: row.patient_father_or_husband,
      created_at: row.created_at,
      report: parsed,
    }
  })
  handle('all-tests-grouped', () => {
    logEvent({ action: 'ALL_TESTS_GROUPED' })
    const db = getDb()
    const rows = db
      .prepare(
        'SELECT id, category, name, result, normal_value, required, sort_order, timestamp FROM test ORDER BY category, COALESCE(sort_order, 999999), id'
      )
      .all() as any[]
    const grouped: Record<string, any[]> = {}
    for (const r of rows) {
      grouped[r.category] = grouped[r.category] || []
      grouped[r.category].push({
        id: r.id,
        name: r.name,
        result: r.result,
        normal_value: r.normal_value,
        required: !!r.required,
        sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
        timestamp: r.timestamp,
      })
    }
    return Object.keys(grouped).map((cat) => ({ category: cat, tests: grouped[cat] }))
  })
  handle('add-test-category', ({ category }: { category: string }) => {
    logEvent({ action: 'ADD_TEST_CATEGORY', payload: { category } })
    const db = getDb()
    // Insert a dummy row if category doesn't exist (categories derive from test rows). We'll create a placeholder test name and then allow user to add real tests
    // Instead of dummy, we can simply ensure no-op by checking existence.
    const existing = db.prepare('SELECT 1 FROM test WHERE category = ? LIMIT 1').get(category)
    if (existing) return { created: false, category }
    // Use a placeholder marker row that user can later edit/delete (or we ignore deletion for now)
    const info = db
      .prepare('INSERT INTO test (category, name, result, normal_value) VALUES (?, ?, ?, ?)')
      .run(category, '_placeholder_', '', '')
    return { created: info.changes === 1, category }
  })
  handle(
    'add-test',
    ({ category, name, normal_value }: { category: string; name: string; normal_value?: string | null }) => {
      logEvent({ action: 'ADD_TEST', payload: { category, name } })
      const db = getDb()
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO test (category, name, result, normal_value, required) VALUES (?, ?, ?, ?, 0)'
      )
      const info = stmt.run(category, name, '', normal_value || '')
      const idRow = db.prepare('SELECT id, required FROM test WHERE category = ? AND name = ?').get(category, name) as {
        id: number
        required: number
      }
      return { id: idRow?.id || 0, inserted: info.changes === 1, required: !!idRow?.required }
    }
  )
  handle('update-test-normal', ({ id, normal_value }: { id: number; normal_value?: string | null }) => {
    logEvent({ action: 'UPDATE_TEST_NORMAL', payload: { id } })
    const db = getDb()
    const stmt = db.prepare('UPDATE test SET normal_value = ? WHERE id = ?')
    const info = stmt.run(normal_value || '', id)
    return { updated: info.changes === 1 }
  })
  handle('update-test-required', ({ id, required }: { id: number; required: boolean }) => {
    logEvent({ action: 'UPDATE_TEST_REQUIRED', payload: { id, required } })
    const db = getDb()
    const stmt = db.prepare('UPDATE test SET required = ? WHERE id = ?')
    const info = stmt.run(required ? 1 : 0, id)
    return { updated: info.changes === 1, required }
  })
  handle('maintenance-reseed-tests', () => {
    logEvent({ action: 'MAINTENANCE_RESEED' })
    const db = getDb()
    // Hard reset: clear table then reseed defaults
    const totalBefore = db.prepare('SELECT COUNT(1) as c FROM test').get() as any
    db.prepare('DELETE FROM test').run()
    const { inserted, skipped } = reseedTests(DEFAULT_TESTS)
    return { inserted, skipped, reset: true, previous: totalBefore?.c || 0 }
  })
  handle('export-tests', () => {
    logEvent({ action: 'EXPORT_TESTS' })
    const db = getDb()
    const rows = db
      .prepare(
        'SELECT id, category, name, normal_value, result, required, sort_order FROM test WHERE name != ? ORDER BY category, COALESCE(sort_order, 999999), id'
      )
      .all('_placeholder_') as any[]
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      normal_value: r.normal_value || '',
      result: r.result || '',
      required: !!r.required,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : undefined,
    }))
  })
  handle('import-tests', (payload: any[]) => {
    logEvent({ action: 'IMPORT_TESTS', payload: { count: payload.length } })
    const db = getDb()
    const insertWithId = db.prepare(
      'INSERT OR IGNORE INTO test (id, category, name, result, normal_value, required, sort_order) VALUES (@id, @category, @name, @result, @normal_value, @required, @sort_order)'
    )
    const insertNoId = db.prepare(
      'INSERT OR IGNORE INTO test (category, name, result, normal_value, required, sort_order) VALUES (@category, @name, @result, @normal_value, @required, @sort_order)'
    )
    let inserted = 0
    for (const raw of payload) {
      const base = {
        category: raw.category?.trim() || '',
        name: raw.name?.trim() || '',
        result: (raw.result || '').toString().trim(),
        normal_value: (raw.normal_value || '').toString().trim(),
        required: raw.required ? 1 : 0,
        sort_order: typeof (raw as any).sort_order === 'number' ? (raw as any).sort_order : null,
      }
      if (!base.category || !base.name) continue
      let info: any
      if (raw.id && Number.isFinite(raw.id) && raw.id > 0) {
        info = insertWithId.run({ id: raw.id, ...base })
        // If id already existed (ignored) but (category,name) not present, we may want to attempt without id; skip for simplicity.
      } else {
        info = insertNoId.run(base)
      }
      if (info?.changes === 1) inserted++
    }
    return { inserted, skipped: payload.length - inserted }
  })
  handle('export-logs', ({ format }: { format: 'json' | 'txt' }) => {
    const db = getDb()
    const rows = db.prepare('SELECT ts, action, level, payload, message FROM app_logs ORDER BY id ASC').all() as any[]
    let content = ''
    if (format === 'json') {
      content = rows
        .map((r) => ({
          ts: r.ts,
          action: r.action,
          level: r.level,
          payload: r.payload ? JSON.parse(r.payload) : null,
          message: r.message || '',
        }))
        .map((o) => JSON.stringify(o))
        .join('\n')
    } else {
      content = rows.map((r) => `${r.ts} [${r.level}] ${r.action} ${r.message || ''} ${r.payload || ''}`).join('\n')
    }
    const fileName = `logs-${Date.now()}.${format === 'json' ? 'jsonl' : 'txt'}`
    const dir = app.getPath('documents')
    const outPath = path.join(dir, fileName)
    fs.writeFileSync(outPath, content, 'utf-8')
    logEvent({ action: 'EXPORT_LOGS', payload: { format, count: rows.length } })
    return { filePath: outPath, count: rows.length }
  })
  handle(
    'list-logs',
    ({
      offset,
      limit,
      level,
      action,
      search,
    }: {
      offset: number
      limit: number
      level?: string | null
      action?: string | null
      search?: string | null
    }) => {
      const db = getDb()
      const clauses: string[] = []
      const params: any[] = []
      if (level) {
        clauses.push('level = ?')
        params.push(level.toUpperCase())
      }
      if (action) {
        clauses.push('action = ?')
        params.push(action.toUpperCase())
      }
      if (search && search.trim()) {
        clauses.push('(action LIKE ? OR message LIKE ? OR payload LIKE ?)')
        const like = `%${search.trim()}%`
        params.push(like, like, like)
      }
      const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
      const totalRow = db.prepare(`SELECT COUNT(1) as c FROM app_logs ${where}`).get(...params) as any
      const rows = db
        .prepare(
          `SELECT id, ts, action, level, payload, message FROM app_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`
        )
        .all(...params, limit, offset) as any[]
      return {
        total: totalRow?.c || 0,
        rows: rows.map((r) => ({
          id: r.id,
          ts: r.ts,
          action: r.action,
          level: r.level,
          message: r.message || '',
          payload: r.payload
            ? (() => {
                try {
                  return JSON.parse(r.payload)
                } catch {
                  return r.payload
                }
              })()
            : null,
        })),
      }
    }
  )
  // Reset database (archives old file, recreates schema, reseeds)
  handle('reset-database', () => {
    logEvent({ action: 'RESET_DB_REQUEST' })
    try {
      resetDatabase()
      logEvent({ action: 'RESET_DB_SUCCESS' })
      return { reset: true }
    } catch (err) {
      logEvent({ action: 'RESET_DB_FAILURE', level: 'ERROR', payload: { error: String(err) } })
      return { reset: false }
    }
  })
}

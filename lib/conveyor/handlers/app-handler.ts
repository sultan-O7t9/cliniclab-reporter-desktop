import { type App, BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getDb } from '@/lib/main/database'
import path from 'path'
import fs from 'fs'

const escapeHtml = (v: any) =>
  (v == null ? '' : String(v))
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const registerAppHandlers = (app: App) => {
  const buildReportHtml = (report: any) => {
    const patientName = (report?.patient?.name || '').toString().toUpperCase()
    const patientAge = report?.patient?.age || ''
    const patientSex = report?.patient?.sex || ''
    const fatherOrHusband = (report?.patient?.fatherOrHusband || '').toString().toUpperCase()
    const generatedAt = report?.generatedAt || new Date().toISOString()
    const registrationDate = new Date(generatedAt).toLocaleDateString()
    const categories: any[] = Array.isArray(report?.tests) ? report.tests : []
    const groupHtmlList = categories
      .map((cat) => {
        const tests: any[] = cat.tests || []
        if (!tests.length) return ''
        const hasAnyNormal = tests.some((t) => t.normal && String(t.normal).trim() !== '')
        const headerRow = `<tr>
            <th>TEST NAME</th>
            ${hasAnyNormal ? '' : '<th></th>'}
            <th>RESULT</th>
            ${hasAnyNormal ? '<th>NORMAL VALUE</th>' : ''}
          </tr>`
        const rows = tests
          .map(
            (t: any) => `<tr>
              <td>${escapeHtml(t.name)}</td>
              ${hasAnyNormal ? '' : '<td></td>'}
              <td>${escapeHtml(t.result)}</td>
              ${hasAnyNormal ? '<td>' + escapeHtml(t.normal || '') + '</td>' : ''}
            </tr>`
          )
          .join('')
        return `<div class="report-group" style="margin-bottom:22px;">
            <div class="group-title">${escapeHtml(cat.category)}</div>
            <table class="report-table equal-cols">
              <thead>${headerRow}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`
      })
      .filter(Boolean) as string[]
    const tableSections = groupHtmlList
      .map((html, idx) => {
        const isEndOfPage = (idx + 1) % 4 === 0 && idx !== groupHtmlList.length - 1
        return html + (isEndOfPage ? '<div class="page-break"></div><div class="page-top-spacer"></div>' : '')
      })
      .join('')
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Report</title>
  <style>
  * {color:#17365d;}
  body { margin:24px; font-family:Arial,Helvetica,sans-serif; }
  .clinic-header { text-align:center; margin-bottom:24px; }
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
  @media print { .report-group { page-break-inside: avoid; break-inside: avoid; } }
  </style>
  <!-- Auto print script removed to avoid duplicate dialogs when using direct print -->
</head>
<body>
  <div class="clinic-header">
    <div class="title">SHAMIM ARSHAD CLINIC</div>
    <b class="subtitle1">NOT VALID FOR ANY COURT</b>
    <div class="subtitle2">OPPOSITE FAUJI TOWER EID GAAH CHOWK <b>KUNJAH</b></div>
    <div class="subtitle3">CELL NUMBER <b>--- 0349 4695920</b></div>
  </div>
  <div class="patient-grid">
    <div class="cell"><span class="lbl">Patient Name</span></div>
    <div class="cell"><b class="lbl">${escapeHtml(patientName) || '—'}</b></div>
    <div class="cell"><span class="lbl">Registration Date</span></div>
    <div class="cell"><span class="lbl">${escapeHtml(registrationDate)}</span></div>
  <div class="cell"><span class="lbl">Father/Husband</span></div>
  <div class="cell"><b class="lbl">${escapeHtml(fatherOrHusband) || '—'}</b></div>
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
  <div class="footer"><span class="label">Lab Tech</span>_______________</div>
</body>
</html>`
    return html
  }
  // App operations
  handle('version', () => app.getVersion())
  handle('test-categories', () => {
    const db = getDb()
    const rows = db.prepare('SELECT DISTINCT category FROM test ORDER BY category').all() as { category: string }[]
    return rows.map((r) => r.category)
  })
  handle('tests-by-category', (category: string) => {
    const db = getDb()
    const rows = db
      .prepare('SELECT id, category, name, result, normal_value, timestamp FROM test WHERE category = ? ORDER BY name')
      .all(category)

    return rows as any
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
    return { id: Number(info.lastInsertRowid) }
  })
  handle('generate-report-pdf', ({ report }: { report: any }) => {
    const promise = (async () => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false },
      })
      const patientName = (report?.patient?.name || '').toString().toUpperCase()
      const patientAge = report?.patient?.age || ''
      const patientSex = report?.patient?.sex || ''
      const generatedAt = report?.generatedAt || new Date().toISOString()
      const registrationDate = new Date(generatedAt).toLocaleDateString()
      const categories: any[] = Array.isArray(report?.tests) ? report.tests : []
      const groupHtmlList = categories
        .map((cat) => {
          const tests: any[] = cat.tests || []
          if (!tests.length) return ''
          const hasAnyNormal = tests.some((t) => t.normal && String(t.normal).trim() !== '')
          // Always render 3 equal columns. If no normal values at all, leave third column cells empty.
          const headerRow = `<tr>
            <th>TEST NAME</th>
            ${hasAnyNormal ? '' : '<th></th>'}
            <th>RESULT</th>
            ${hasAnyNormal ? '<th>NORMAL VALUE</th>' : ''}
          </tr>`
          const rows = tests
            .map(
              (t: any) => `<tr>
              <td>${escapeHtml(t.name)}</td>
              ${hasAnyNormal ? '' : '<td></td>'}
              <td>${escapeHtml(t.result)}</td>
              ${hasAnyNormal ? '<td>' + escapeHtml(t.normal || '') + '</td>' : ''}
            </tr>`
            )
            .join('')
          return `<div class="report-group" style="margin-bottom:22px;">
            <div class="group-title">${escapeHtml(cat.category)}</div>
            <table class="report-table equal-cols">
              <thead>${headerRow}</thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`
        })
        .filter(Boolean) as string[]

      // Insert page breaks after every 4 groups
      const tableSections = groupHtmlList
        .map((html, idx) => {
          const isEndOfPage = (idx + 1) % 4 === 0 && idx !== groupHtmlList.length - 1
          return html + (isEndOfPage ? '<div class="page-break"></div><div class="page-top-spacer"></div>' : '')
        })
        .join('')
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Report</title>
  <style>
  * {
  color:#17365d;
  }
    body { margin:24px; font-family:Arial,Helvetica,sans-serif; }
    .clinic-header { text-align:center; margin-bottom:24px; }
  .clinic-header .title {text-decoration:underline; font-size:36px;color:#17365d;font-family:Cambria,serif; font-weight:700; letter-spacing:1px; }
  .clinic-header .subtitle1 {color:#17365d; font-size:10px; margin-top:4px; font-family:Arial,sans-serif;}
  .clinic-header .subtitle2, .clinic-header .subtitle3 { font-size:10px; font-family:Arial,sans-serif; line-height:1.2; margin-top:2px; color:#17365d; }
  /* Patient info grid */
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
  .report-table thead {
  border:1.5px solid #17365d;}
  .report-table th, .report-table td {  padding:6px 6px; font-size:11px; font-family:Cambria,serif; text-align:center; vertical-align:middle; }
  .report-table th {
  padding:2px 6px;
  }
  .report-table thead th { background:#f0f0f0; font-weight:600; }
  .group-title { font-family:Cambria,serif; font-size:18px; font-weight:bold; margin:12px auto 6px; text-align:center; }
    .lbl-small { font-size:9px; }
    @media print { .report-group { page-break-inside: avoid; break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="clinic-header">
    <div class="title">SHAMIM ARSHAD CLINIC</div>
    <b class="subtitle1">NOT VALID FOR ANY COURT</b>
    <div class="subtitle2">OPPOSITE FAUJI TOWER EID GAAH CHOWK <b>KUNJAH</b></div>
    <div class="subtitle3">CELL NUMBER <b>--- 0349 4695920</b></div>
  </div>
  <div class="patient-grid">
    <div class="cell"><span class="lbl">Patient Name</span></div>
    <div class="cell"><b class="lbl">${escapeHtml(patientName) || '—'}</b></div>
    <div class="cell"><span class="lbl">Registration Date</span></div>
    <div class="cell"><span class="lbl">${escapeHtml(registrationDate)}</span></div>
  <div class="cell"><span class="lbl">Father/Husband</span></div>
  <div class="cell"><b class="lbl">${escapeHtml((report?.patient?.fatherOrHusband || '').toString().toUpperCase()) || '—'}</b></div>
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
  <div class="footer"><span class="label">Lab Tech</span>_______________</div>
</body>
</html>`
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: false,
        pageSize: 'A4',
        margins: { marginType: 'default' },
      })
      win.destroy()
      const documentsPath = app.getPath('documents')
      const outDir = path.join(documentsPath, 'electron-reports')
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = String(now.getFullYear())
      const hh = String(now.getHours()).padStart(2, '0')
      const min = String(now.getMinutes()).padStart(2, '0')
      const dateLabel = `${dd}-${mm}-${yyyy} ${hh}-${min}` // replace colon with dash for Windows compatibility
      const safePatient =
        (patientName || 'unknown')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'patient'
      // Write file with retry logic to mitigate occasional EBUSY (locked by AV/indexing on Windows)
      const baseName = `report-${safePatient}-${dateLabel}`
      const maxAttempts = 5
      let attempt = 0
      let lastErr: any = null
      let finalPath = ''
      while (attempt < maxAttempts) {
        const suffix = attempt === 0 ? '' : `-${attempt + 1}`
        const candidate = path.join(outDir, `${baseName}${suffix}.pdf`)
        try {
          fs.writeFileSync(candidate, pdfBuffer, { flag: 'wx' })
          finalPath = candidate
          lastErr = null
          break
        } catch (err: any) {
          // If file exists or is busy/locked, wait briefly then retry with a new suffix
          if (['EEXIST', 'EBUSY', 'EPERM'].includes(err.code)) {
            lastErr = err
            // brief delay (blocking) ~25ms; short enough given small retry count
            const waitUntil = Date.now() + 25
            while (Date.now() < waitUntil) {
              /* spin */
            }
            attempt++
            continue
          }
          // Any other error: rethrow immediately
          throw err
        }
      }
      if (lastErr && !finalPath) {
        throw lastErr
      }
      return { filePath: finalPath }
    })()
    return promise as any
  })
  handle('open-report-preview', ({ report }: { report: any }) => {
    const promise = (async () => {
      const win = new BrowserWindow({
        show: true,
        width: 900,
        height: 1000,
        webPreferences: { sandbox: false },
      })
      const html = buildReportHtml(report)
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      // Return immediately; user can print via auto or Ctrl+P
      return { opened: true }
    })()
    return promise as any
  })
  handle('print-report', ({ report }: { report: any }) => {
    const promise = (async () => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false },
      })
      const html = buildReportHtml(report)
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
              /* ignore destroy errors */
            }
            if (!success) return resolve({ printed: false, error: failureReason || 'Unknown print failure' })
            resolve({ printed: true })
          }
        )
      })
    })()
    return promise as any
  })
}

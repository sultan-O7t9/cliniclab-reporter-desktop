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
    const stmt = db.prepare(
      'INSERT INTO test_records (patient_name, patient_age, patient_sex, payload) VALUES (?, ?, ?, ?)'
    )
    const info = stmt.run(
      payload.patient?.name || '',
      payload.patient?.age ? Number(payload.patient.age) : null,
      payload.patient?.sex || '',
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
          const hasNormal = tests.some((t) => t.normal && String(t.normal).trim() !== '')
          const rows = tests
            .map((t: any) => {
              const normalCell = hasNormal
                ? `<td style="padding:4px 8px;font-size:11px;font-family:Cambria,sans-serif;text-align:center;">${escapeHtml(
                    t.normal || ''
                  )}</td>`
                : ''
              return `<tr>
                <td style="padding:4px 8px;font-size:11px;font-family:Cambria,sans-serif;text-align:center;">${escapeHtml(
                  t.name
                )}</td>
                <td style="padding:4px 8px;font-size:11px;font-family:Cambria,sans-serif;text-align:center;">${escapeHtml(
                  t.result
                )}</td>
                ${normalCell}
              </tr>`
            })
            .join('')
          const normalHeader = hasNormal
            ? `<th style="text-align:left;padding:4px 8px;font-size:11px; font-family:Cambria,sans-serif;text-align:center;background:#f0f0f0;">NORMAL VALUE</th>`
            : ''
          return `<div class="report-group" style="margin-bottom:22px;">
            <div style="font-family:Cambria,serif;font-size:20px;font-weight:bold;margin:4px 0 6px; text-align:center">${escapeHtml(
              cat.category
            )}</div>
            <table style="border-collapse:collapse;width:100%;font-family:Arial,Helvetica,sans-serif;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:4px 8px;font-size:11px; font-family:Cambria,sans-serif;text-align:center;background:#f0f0f0;">TEST NAME</th>
                  <th style="text-align:left;padding:4px 8px;font-size:11px; font-family:Cambria,sans-serif;text-align:center;background:#f0f0f0;">RESULT</th>
                  ${normalHeader}
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`
        })
        .filter(Boolean) as string[]

      // Insert page breaks after every 4 groups
      const tableSections = groupHtmlList
        .map((html, idx) => {
          const isEndOfPage = (idx + 1) % 4 === 0 && idx !== groupHtmlList.length - 1
          return html + (isEndOfPage ? '<div class="page-break"></div>' : '')
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
    .footer { position:fixed; bottom:20px; left:24px; right:24px; font-size:12px;width:100%;display:flex;justify-content:flex-end;color:#17365d; }
    .footer .label {color:#17365d; font-size:14px; font-family:Cambria,serif; margin-right:8px; }
    table { border-collapse: collapse; width:100%; }
    th, td { padding:4px 8px; font-size:12px; text-align:left; }
    th { background:#f0f0f0; }
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
    <div class="cell"><b class="lbl">----</b></div>
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filePath = path.join(outDir, `report-${timestamp}.pdf`)
      fs.writeFileSync(filePath, pdfBuffer)
      return { filePath }
    })()
    return promise as any
  })
}

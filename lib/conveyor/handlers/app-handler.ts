import { type App, BrowserWindow } from 'electron'
import { handle } from '@/lib/main/shared'
import { getDb, logEvent, resetDatabase } from '@/lib/main/database'
import { applyTestsUpdate2025, needsTestsUpdate2025, markTestsUpdatePrompted2025 } from '@/lib/main/database'
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
  // Tests update 2025: helper endpoints for renderer confirmation flow
  handle('needs-tests-update-2025' as any, () => {
    const needs = needsTestsUpdate2025()
    return { needs }
  })
  handle('mark-tests-update-prompted-2025' as any, () => {
    try {
      markTestsUpdatePrompted2025()
      return { ok: true }
    } catch {
      return { ok: false }
    }
  })
  handle('apply-tests-update-2025' as any, () => {
    const res = applyTestsUpdate2025()
    return res
  })
  const resolveResourcesDir = () => {
    return app.isPackaged ? path.join(process.resourcesPath, 'resources') : path.join(app.getAppPath(), 'resources')
  }

  const getLogoDataUri = () => {
    try {
      const resourceDir = resolveResourcesDir()
      const resourcePaths = [
        path.join(resourceDir, 'icons', 'clinic-logo.png'),
        path.join(resourceDir, 'icons', 'logo.png'),
        path.join(resourceDir, 'icons', 'icon.png'),
        path.join(resourceDir, 'icons', 'logo.svg'),
      ]
      // In packaged build, also check app.asar.unpacked/resources/icons
      if (app.isPackaged) {
        const unpackedBase = path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'icons')
        resourcePaths.push(
          path.join(unpackedBase, 'clinic-logo.png'),
          path.join(unpackedBase, 'logo.png'),
          path.join(unpackedBase, 'icon.png'),
          path.join(unpackedBase, 'logo.svg')
        )
      }
      const file = resourcePaths.find((p) => fs.existsSync(p))
      if (!file) {
        console.warn('[PDF] Logo not found in resources/icons/. Tried:', resourcePaths)
        return ''
      }
      if (file.endsWith('.svg')) {
        const data = fs.readFileSync(file)
        return 'data:image/svg+xml;base64,' + data.toString('base64')
      } else {
        const data = fs.readFileSync(file)
        return 'data:image/png;base64,' + data.toString('base64')
      }
    } catch (e) {
      console.warn('[PDF] Error loading logo:', e)
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
        // Determine if any test has children: if yes, use 4 columns (Test, Child Test, Result, Normal Value)
        const anyChildren = tests.some((t: any) => Array.isArray(t.children) && t.children.length > 0)
        const hasAnyNormal = tests.some(
          (t) => (t.normal || t.normal_value) && String(t.normal || t.normal_value).trim() !== ''
        )
        const headerRow = anyChildren
          ? `<tr>
              <th>TEST NAME</th>
              <th></th>
              <th>RESULT</th>
              <th>NORMAL VALUE</th>
            </tr>`
          : `<tr>
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
        // Helpers to parse/format/evaluate normal specs for coloring
        type Range = { min?: number; max?: number }
        type NormalSpec =
          | { type: 'none' }
          | { type: 'options'; options: Array<string | { label: string; color?: string }> }
          | { type: 'range'; range: Range }
          | { type: 'sexed-range'; male?: Range; female?: Range }

        const trimLower = (s: string) => s.trim().toLowerCase()
        const parseNumber = (s: string): number | undefined => {
          const m = s.replace(/,/g, '').match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/)
          if (!m) return undefined
          const n = parseFloat(m[0])
          return Number.isFinite(n) ? n : undefined
        }
        const parseRange = (raw: string): Range | null => {
          const s = raw.replace(/\s+/g, ' ').trim()
          if (!s) return null
          // >=x, <=y, >x, <y
          let m = s.match(/^>=\s*([\d.,]+)$/i)
          if (m) return { min: parseNumber(m[1]) }
          m = s.match(/^>\s*([\d.,]+)$/i)
          if (m) return { min: parseNumber(m[1]) }
          m = s.match(/^<=\s*([\d.,]+)$/i)
          if (m) return { max: parseNumber(m[1]) }
          m = s.match(/^<\s*([\d.,]+)$/i)
          if (m) return { max: parseNumber(m[1]) }
          // a-b or a to b
          m = s.match(/^([\d.,]+)\s*(?:-|–|—|to)\s*([\d.,]+)$/i)
          if (m) return { min: parseNumber(m[1]), max: parseNumber(m[2]) }
          // a+ (min only)
          m = s.match(/^([\d.,]+)\s*\+$/)
          if (m) return { min: parseNumber(m[1]) }
          // single number (treat as exact or lower bound)
          const n = parseNumber(s)
          if (n !== undefined) return { min: n, max: n }
          return null
        }
        const parseOptions = (raw: string): Array<string | { label: string; color?: string }> | null => {
          const s = (raw || '').trim()
          if (!s) return null
          try {
            const arr = JSON.parse(s)
            if (Array.isArray(arr)) {
              if (arr.every((x) => typeof x === 'string')) return arr as string[]
              if (arr.every((x) => x && typeof x === 'object' && typeof x.label === 'string')) {
                return arr as Array<{ label: string; color?: string }>
              }
            }
          } catch {
            /* not json */
          }
          if (/[|,/]/.test(s)) {
            const parts = s
              .split(/[|,/]/)
              .map((p) => p.trim())
              .filter(Boolean)
            if (parts.length >= 2) return parts
          }
          // Common pair
          if (/\bpositive\b|\bnegative\b/i.test(s)) {
            return ['POSITIVE', 'NEGATIVE']
          }
          return null
        }
        const parseSexedRange = (raw: string): { male?: Range; female?: Range } | null => {
          const s = (raw || '').replace(/;/g, ',')
          const parts = s
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean)
          if (!parts.length) return null
          let male: Range | undefined
          let female: Range | undefined
          for (const p of parts) {
            const pm = p.match(/^(m|male)\s*[:=]\s*(.+)$/i)
            const pf = p.match(/^(f|female)\s*[:=]\s*(.+)$/i)
            if (pm) male = parseRange(pm[2]) || male
            else if (pf) female = parseRange(pf[2]) || female
          }
          if (!male && !female) return null
          return { male, female }
        }
        const parseNormalSpec = (raw: string, _fallback?: string): NormalSpec => {
          const s = (raw || '').trim()
          if (!s) return { type: 'none' }
          if (s.startsWith('{')) {
            try {
              const o = JSON.parse(s)
              if (o && typeof o === 'object' && typeof o.type === 'string') {
                if (o.type === 'options' && Array.isArray(o.options)) {
                  return { type: 'options', options: o.options }
                }
                if (o.type === 'range' && o.range && typeof o.range === 'object') {
                  return { type: 'range', range: { min: o.range.min, max: o.range.max } }
                }
                if (o.type === 'sexed-range') {
                  const male: Range | undefined = o.male ? { min: o.male.min, max: o.male.max } : undefined
                  const female: Range | undefined = o.female ? { min: o.female.min, max: o.female.max } : undefined
                  return { type: 'sexed-range', male, female }
                }
              }
            } catch {
              /* fallthrough */
            }
          }
          const sexed = parseSexedRange(s)
          if (sexed) return { type: 'sexed-range', ...sexed }
          const rng = parseRange(s)
          if (rng) return { type: 'range', range: rng }
          const opts = parseOptions(s)
          if (opts) return { type: 'options', options: opts }
          return { type: 'none' }
        }
        const formatNormalDisplay = (raw: string): string => {
          if (!raw) return ''
          try {
            const arr = JSON.parse(raw)
            if (Array.isArray(arr)) return arr.join(' / ')
          } catch {
            /* not json*/
          }
          // Normalize sex separators
          if (/\b(m|male)\s*[:=]/i.test(raw) || /\b(f|female)\s*[:=]/i.test(raw)) {
            return raw.replace(/\s*,\s*/g, '; ').replace(/\s*;\s*/g, '; ')
          }
          return raw
        }
        const colorFor = (
          resultRaw: string,
          normalRaw: string,
          normalSpecRaw?: string
        ): { cls: string; style?: string } => {
          const res = (resultRaw || '').toString().trim()
          if (!res) return { cls: '', style: undefined }
          const spec = parseNormalSpec(normalSpecRaw || normalRaw, normalRaw)
          const lowerRes = res.toLowerCase()
          if (spec.type === 'options') {
            const normalized = spec.options.map((o) => (typeof o === 'string' ? { label: o } : o))
            // Only apply color when the option explicitly defines a color; do not color plain text options
            const match = normalized.find((o) => trimLower(o.label) === lowerRes)
            if (match && match.color) return { cls: '', style: `color:${match.color}` }
            return { cls: '' }
          }
          const pickRange = (): Range | undefined => {
            if (spec.type === 'range') return spec.range
            if (spec.type === 'sexed-range') {
              const sex = (patientSex || '').toString().trim().toLowerCase()
              if (sex.startsWith('m')) return spec.male || spec.female
              if (sex.startsWith('f')) return spec.female || spec.male
              return spec.male || spec.female
            }
            return undefined
          }
          const rng = pickRange()
          if (rng) {
            const n = parseNumber(res)
            if (n === undefined) return { cls: '' }
            const hasMin = typeof rng.min === 'number'
            const hasMax = typeof rng.max === 'number'
            if (hasMin && n < (rng.min as number)) {
              if (hasMax && (rng.max as number) >= 9999) return { cls: 'result-red' }
              else return { cls: 'result-yellow' }
            }

            if (hasMax && n > (rng.max as number)) return { cls: 'result-red' }
            return { cls: 'result-green' }
          }
          return { cls: '' }
        }
        const renderRow = (t: any, _isChild = false, parentName?: string, isFirstChild?: boolean) => {
          const normalRaw = t.normal || t.normal_value || ''
          const normalSpecRaw = t.normal_spec || ''
          const normal = formatNormalDisplay(normalRaw)
          const colorInfo = colorFor(t.result, normalRaw, normalSpecRaw)
          if (anyChildren) {
            // 4 columns: if child row, show parent name only on first child; if standalone test, put name in Test column
            let parentCell = '<td></td>'
            let childCell = '<td></td>'
            if (_isChild) {
              parentCell = isFirstChild && parentName ? `<td class="title">${escapeHtml(parentName)}</td>` : '<td></td>'
              childCell = `<td class="title" style="padding-left:8px;">${escapeHtml(t.name)}</td>`
            } else {
              // Standalone test (no children) within a table that otherwise has children
              parentCell = `<td class="title">${escapeHtml(t.name)}</td>`
              childCell = '<td></td>'
            }
            return `<tr>
                ${parentCell}
                ${childCell}
                <td class="result ${colorInfo.cls}"${colorInfo.style ? ` style="${escapeHtml(colorInfo.style)}"` : ''}>${escapeHtml(t.result)}</td>
                <td>${escapeHtml(normal)}</td>
              </tr>`
          } else {
            const nameCell = `<td class="title">${escapeHtml(t.name)}</td>`
            return `<tr>
                ${nameCell}
                ${hasAnyNormal ? '' : '<td></td>'}
                <td class="result ${colorInfo.cls}"${colorInfo.style ? ` style="${escapeHtml(colorInfo.style)}"` : ''}>${escapeHtml(t.result)}</td>
                ${hasAnyNormal ? '<td>' + escapeHtml(normal) + '</td>' : ''}
              </tr>`
          }
        }
        const rows = sortedTests
          .map((t: any) => {
            const hasChildren = Array.isArray(t.children) && t.children.length > 0
            if (!hasChildren) return renderRow(t)
            // Preserve original child order from UI payload when no sort metadata is present.
            const childrenCopy = t.children.slice()
            const indexedChildren = childrenCopy.map((c: any, idx: number) => ({ c, idx }))
            const shouldSortChildren = indexedChildren.some(({ c }) => typeof c.sort_order === 'number')
            const childrenSorted = shouldSortChildren
              ? indexedChildren
                  .slice()
                  .sort((a: any, b: any) => {
                    const ao = typeof a.c.sort_order === 'number' ? a.c.sort_order : 999999
                    const bo = typeof b.c.sort_order === 'number' ? b.c.sort_order : 999999
                    if (ao !== bo) return ao - bo
                    // Preserve original order among items without sort_order
                    return a.idx - b.idx
                  })
                  .map(({ c }: any) => c)
              : childrenCopy
            const childRows = childrenSorted
              .map((ch: any, idx: number) => renderRow(ch, true, t.name, idx === 0))
              .join('')
            // In 4-column mode, we don't render a separate parent label row; parent name appears only on first child row
            if (anyChildren) return childRows
            // In 3-column mode, render a parent label row then children indented
            const parentLabel = `<tr>
                <td class="title" style="font-weight:700;">${escapeHtml(t.name)}</td>
                ${hasAnyNormal ? '' : '<td></td>'}
                <td class="result"></td>
                ${hasAnyNormal ? '<td>' + escapeHtml(t.normal || t.normal_value || '') + '</td>' : ''}
              </tr>`
            return parentLabel + childRows
          })
          .join('')
        const html = `<div class="report-group" style="margin-bottom:24px;">
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
      .map((entry, idx, arr) => {
        // If urine report: ensure it's isolated on its own page
        if (entry.urine) {
          // Only add a page break before if previous group did not already end with a page break
          const prevIsPageBreak = idx > 0 && (idx % 4 === 0 || arr[idx - 1]?.breakAfter)
          const before = idx === 0 || prevIsPageBreak ? '' : '<div class="page-break"></div>'
          const after = idx === groupEntries.length - 1 ? '' : '<div class="page-break"></div>'
          return before + `<div class="urine-wrapper">${entry.html}</div>` + after
        }
        const isEndOfPage = (idx + 1) % 4 === 0 && idx !== groupEntries.length - 1
        let suffix = ''
        if (entry.breakAfter) {
          suffix =
            '<div class="manual-break-spacer" aria-hidden="true"></div><div class="page-break"></div><div class="page-top-spacer"></div>'
        } else if (isEndOfPage) {
          // Only add page break if next group is not urine
          const nextIsUrine = arr[idx + 1]?.urine
          if (!nextIsUrine) {
            suffix = '<div class="page-break"></div><div class="page-top-spacer"></div>'
          }
        } else if (urineIndex !== -1 && idx > urineIndex && idx === urineIndex + 1) {
          suffix = '<div class="page-top-spacer"></div>'
        }
        // Remove margin-bottom if this is the 4th group or a page break follows
        let html = entry.html
        if (isEndOfPage || entry.breakAfter) {
          html = html.replace('style="margin-bottom:24px;"', 'style="margin-bottom:0;"')
        }
        return html + suffix
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
  .clinic-header * {
  line-height:1.5;}
  .clinic-header { text-align:center; margin-bottom:24px; position:relative; }

  .clinic-header .qr { position:absolute; right:64px; bottom:0px;  align-self:flex-end;  height:56px; width:56px; object-fit:contain; }
  .clinic-header .phone-label { position:absolute; right:90px; top:4px; font-size:12px; font-family:Calibri,serif; font-weight:600; letter-spacing:0.5px; }
  .logo-container{
  display:flex;
  align-items:center;
  justify-content:center;
      position:relative;

  }
  .logo {

      height: 200px;
      width: auto;
      display: block;

  }
  .clinic-header .title {text-decoration:underline; font-size:36px;color:#17365d;font-family:Calibri,serif; font-weight:700; letter-spacing:1px; }
  .clinic-header .subtitle1 {color:#17365d; font-size:10px; margin-top:20px; font-family:Arial,sans-serif;}
  .clinic-header .subtitle2, .clinic-header .subtitle3 { font-size:12px; font-family:Arial,sans-serif; line-height:1.2; margin-top:2px; color:#17365d; }
  .patient-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:4px 12px; font-family:Calibri,serif; font-size:12px; color:#17365d; max-width:80%;margin:0 auto 16px; }
  .patient-grid .cell {text-transform:uppercase; line-height:1.3; }
  .patient-grid .lbl {text-wrap:nowrap; text-transform:uppercase; margin-right:4px; }
  .report-group { page-break-inside: avoid; break-inside: avoid; margin-bottom:26px; }
  .report-group .result{
  font-weight:bold;
  }
  /* Dynamic result coloring overrides */
  .report-table td.result.result-green { color:#00FF00 !important; font-weight:700; }
  .report-table td.result.result-yellow { color:#fec200 !important; font-weight:700; }
  .report-table td.result.result-red { color:#FF0000 !important; font-weight:700; }
  .page-break { page-break-after: always; break-after: page; }
  .content-wrapper { padding-bottom:70px; }
  .page-top-spacer { height:18px; }
  .footer { position:fixed; bottom:20px; left:24px; right:24px; font-size:12px;width:100%;display:flex;justify-content:flex-end;color:#17365d; }
  .footer .label {color:#17365d; font-size:14px; font-family:Calibri,serif; margin-right:8px; }
  .report-table { border-collapse:collapse; width:100%; max-width:80%; margin:0 auto 8px; table-layout:fixed; }
  .report-table.equal-cols th, .report-table.equal-cols td { width:33.3333%; }
  .report-table .title{ font-weight:bold;}
  .report-table thead { border:1.5px solid #17365d; }
  .report-table th, .report-table td {  padding:6px 6px; font-size:13px; font-family:Calibri,serif; text-align:center; vertical-align:middle; }
  .report-table th { padding:2px 6px; }
  .report-table thead th { background:#f0f0f0; font-weight:600; }
  .group-title { font-family:Calibri,serif; font-size:32px; font-weight:bold; margin:12px auto 6px; text-align:center; }
  .lbl-small { font-size:11px; }
  .manual-break-spacer { height:48px; }
  /* Urine report styles */
  .urine-wrapper { page-break-inside:avoid; break-inside:avoid; }
  .urine-report-page { max-width:80%; margin:0 auto 12px; font-family:Calibri,serif; font-size:12px; line-height:1.5; }
  .urine-title { text-align:center; font-size:24px; font-weight:bold; margin:12px 0 24px; }
  .urine-top-grid {font-family:Calibri,sans-serif; font-size:14px; text-transform:uppercase;  display:grid; grid-template-columns:repeat(4,1fr);  border:1px solid #17365d; border-bottom:none; padding:4px 12px; }
  .urine-top-row { display:flex; flex-wrap:wrap; gap:8px 24px; margin:2px 0; }
  .urine-label { min-width:90px; }
  .urine-value { min-width:60px;  padding:0 4px; }
  .urine-divider { border-top:1px solid #17365d; margin:8px 0 10px; }
  .urine-columns { display:flex; align-items:flex-start; border:1px solid #17365d; font-family:Calibri,sans-serif; font-size:13px; text-transform:uppercase; }
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
  <div class="logo-container">
  ${logoDataUri ? `<img class="logo" src="${logoDataUri}" />` : ''}

  </div>


<div style="position:relative">
<i class="subtitle1">NOT VALID FOR ANY COURT</i>
<div class="subtitle2">OPPOSITE FAUJI TOWER EID GAAH CHOWK <b>KUNJAH</b></div>
<div class="subtitle3">CELL NUMBER <b>--- ${PHONE_DISPLAY}</b></div>
</div>
 ${qrDataUri ? `<img class="qr" src="${qrDataUri}" />` : ''}
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
    <div class="cell"><b class="lbl lbl-small">SHAMIM ARSHAD POLYCLINIC</b></div>
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
        'SELECT id, category, name, result, normal_value, normal_spec, required, sort_order, timestamp FROM test WHERE category = ? ORDER BY COALESCE(sort_order, 999999), id'
      )
      .all(category) as any[]
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      result: r.result,
      normal_value: r.normal_value,
      normal_spec: r.normal_spec || null,
      required: !!r.required,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
      timestamp: r.timestamp,
    })) as any
  })
  // Nested variant per single category
  handle('tests-by-category-nested', (category: string) => {
    const db = getDb()
    logEvent({ action: 'TESTS_BY_CATEGORY_NESTED', payload: { category } })
    const rows = db
      .prepare(
        'SELECT id, category, name, result, normal_value, normal_spec, required, sort_order, parent_id, timestamp FROM test WHERE category = ? ORDER BY COALESCE(sort_order, 999999), COALESCE(parent_id, 0), id'
      )
      .all(category) as any[]
    const byId: Record<number, any> = {}
    const list = rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      result: r.result,
      normal_value: r.normal_value,
      normal_spec: r.normal_spec || null,
      required: !!r.required,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
      parent_id: typeof r.parent_id === 'number' ? r.parent_id : null,
      timestamp: r.timestamp,
    }))
    list.forEach((t) => (byId[t.id] = { ...t }))
    const roots: any[] = []
    list.forEach((t) => {
      if (t.parent_id) {
        const p = byId[t.parent_id]
        if (p) {
          p.children = p.children || []
          p.children.push({ ...t })
        } else {
          roots.push(t)
        }
      } else {
        roots.push(byId[t.id])
      }
    })
    return { category, tests: roots }
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
      // First: create an offscreen window to render the report
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false },
      })
      const html = await buildReportHtml(report)
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      // Optionally force a layout flush
      try {
        await new Promise((r) => setTimeout(r, 50))
      } catch {
        /* ignore delay errors */
      }
      // Generate a high-scale PDF (scaleFactor=2) for crisper print fonts/images (if driver uses rasterization)
      try {
        await win.webContents.printToPDF({
          printBackground: true,
          landscape: false,
          margins: { marginType: 'default' },
          scaleFactor: 2,
          pageSize: 'A4',
          preferCSSPageSize: true,
        } as any)
      } catch (e) {
        // If PDF generation fails, continue to attempt normal print
        logEvent({ action: 'PRINT_REPORT_PDF_SCALE_FALLBACK', level: 'WARN', message: String(e) })
      }
      return await new Promise<{ printed: boolean; error?: string }>((resolve) => {
        win.webContents.print(
          {
            silent: false,
            printBackground: true,
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

  // Generate a PDF (for preview / higher quality printing) with optional scale factor
  handle('print-to-pdf', ({ report, scale }: { report: any; scale?: number }) => {
    logEvent({ action: 'PRINT_TO_PDF_ATTEMPT', payload: { scale } })
    const promise = (async () => {
      const win = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: false },
      })
      const html = await buildReportHtml(report)
      await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
      const clampedScale = !scale || Number.isNaN(scale) ? 1 : Math.min(2, Math.max(0.5, scale))
      try {
        const pdfBuffer = await win.webContents.printToPDF({
          printBackground: true,
          landscape: false,
          margins: { marginType: 'default' },
          scaleFactor: clampedScale, // Chromium allows ~0.1 - 2.0; Electron docs recommend 0.5 - 2
          pageSize: 'A4',
          preferCSSPageSize: true,
        } as any)
        const pdfPath = path.join(app.getPath('temp'), `report-preview-${Date.now()}.pdf`)
        fs.writeFileSync(pdfPath, pdfBuffer)
        logEvent({ action: 'PRINT_TO_PDF_SUCCESS', payload: { pdfPath, scale: clampedScale } })
        try {
          win.destroy()
        } catch {
          /* ignore */
        }
        const dataUrl = 'data:application/pdf;base64,' + pdfBuffer.toString('base64')
        return { filePath: pdfPath, dataUrl }
      } catch (err: any) {
        logEvent({ action: 'PRINT_TO_PDF_FAIL', level: 'ERROR', message: err?.message || String(err) })
        try {
          win.destroy()
        } catch {
          /* ignore */
        }
        throw new Error('Failed to generate PDF: ' + (err?.message || err))
      }
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
        'SELECT id, category, name, result, normal_value, normal_spec, required, sort_order, parent_id, timestamp FROM test ORDER BY category, COALESCE(sort_order, 999999), COALESCE(parent_id, 0), id'
      )
      .all() as any[]
    const grouped: Record<string, any[]> = {}
    for (const r of rows) {
      grouped[r.category] = grouped[r.category] || []
      const item = {
        id: r.id,
        name: r.name,
        result: r.result,
        normal_value: r.normal_value,
        normal_spec: r.normal_spec || null,
        required: !!r.required,
        sort_order: typeof r.sort_order === 'number' ? r.sort_order : null,
        parent_id: typeof r.parent_id === 'number' ? r.parent_id : null,
        timestamp: r.timestamp,
      }
      grouped[r.category].push(item)
    }
    // Nest children under parents
    return Object.keys(grouped).map((cat) => {
      const list = grouped[cat]
      const byId: Record<number, any> = {}
      list.forEach((t) => (byId[t.id] = { ...t }))
      const roots: any[] = []
      list.forEach((t) => {
        if (t.parent_id) {
          const p = byId[t.parent_id]
          if (p) {
            p.children = p.children || []
            p.children.push({ ...t })
          } else {
            roots.push(t) // orphan safety
          }
        } else {
          roots.push(byId[t.id])
        }
      })
      return { category: cat, tests: roots }
    })
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
    ({
      category,
      name,
      normal_value,
      normal_spec,
    }: {
      category: string
      name: string
      normal_value?: string | null
      normal_spec?: string | null
    }) => {
      logEvent({ action: 'ADD_TEST', payload: { category, name } })
      const db = getDb()
      // Determine next sort_order within the category for root tests
      const maxRow = db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxo FROM test WHERE category = ? AND parent_id IS NULL')
        .get(category) as { maxo: number } | undefined
      const nextOrder = (maxRow?.maxo ?? -1) + 1
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO test (category, name, result, normal_value, normal_spec, required, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, 0, NULL, ?)'
      )
      const info = stmt.run(category, name, '', normal_value || '', normal_spec || null, nextOrder)
      const idRow = db.prepare('SELECT id, required FROM test WHERE category = ? AND name = ?').get(category, name) as {
        id: number
        required: number
      }
      return { id: idRow?.id || 0, inserted: info.changes === 1, required: !!idRow?.required }
    }
  )
  handle(
    'add-child-test',
    ({
      category,
      parent_id,
      name,
      normal_value,
      normal_spec,
    }: {
      category: string
      parent_id: number
      name: string
      normal_value?: string | null
      normal_spec?: string | null
    }) => {
      logEvent({ action: 'ADD_CHILD_TEST', payload: { category, parent_id, name } })
      const db = getDb()
      // Determine next sort_order for this parent's children within the category
      const maxRow = db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxo FROM test WHERE category = ? AND parent_id = ?')
        .get(category, parent_id) as { maxo: number } | undefined
      const nextOrder = (maxRow?.maxo ?? -1) + 1
      const stmt = db.prepare(
        'INSERT OR IGNORE INTO test (category, name, result, normal_value, normal_spec, required, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, 0, ?, ?)'
      )
      const info = stmt.run(category, name, '', normal_value || '', normal_spec || null, parent_id, nextOrder)
      const idRow = db
        .prepare('SELECT id FROM test WHERE category = ? AND name = ? AND parent_id = ?')
        .get(category, name, parent_id) as { id: number } | undefined
      return { id: idRow?.id || 0, inserted: info.changes === 1 }
    }
  )
  handle('update-test-normal', ({ id, normal_value }: { id: number; normal_value?: string | null }) => {
    logEvent({ action: 'UPDATE_TEST_NORMAL', payload: { id } })
    const db = getDb()
    const stmt = db.prepare('UPDATE test SET normal_value = ? WHERE id = ?')
    const info = stmt.run(normal_value || '', id)
    return { updated: info.changes === 1 }
  })
  handle(
    'update-test-normal-spec',
    ({ id, normal_value, normal_spec }: { id: number; normal_value?: string | null; normal_spec?: string | null }) => {
      logEvent({ action: 'UPDATE_TEST_NORMAL_SPEC', payload: { id } })
      const db = getDb()
      const stmt = db.prepare('UPDATE test SET normal_value = ?, normal_spec = ? WHERE id = ?')
      const info = stmt.run(normal_value || '', normal_spec || null, id)
      return { updated: info.changes === 1 }
    }
  )
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
        'SELECT id, category, name, normal_value, normal_spec, result, required, sort_order, parent_id FROM test WHERE name != ? ORDER BY category, COALESCE(sort_order, 999999), COALESCE(parent_id, 0), id'
      )
      .all('_placeholder_') as any[]
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      name: r.name,
      normal_value: r.normal_value || '',
      normal_spec: r.normal_spec || undefined,
      result: r.result || '',
      required: !!r.required,
      sort_order: typeof r.sort_order === 'number' ? r.sort_order : undefined,
      parent_id: typeof r.parent_id === 'number' ? r.parent_id : undefined,
    }))
  })
  handle('import-tests', (payload: any[]) => {
    logEvent({ action: 'IMPORT_TESTS', payload: { count: payload.length } })
    const db = getDb()
    const insertWithId = db.prepare(
      'INSERT OR IGNORE INTO test (id, category, name, result, normal_value, normal_spec, required, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const insertNoId = db.prepare(
      'INSERT OR IGNORE INTO test (category, name, result, normal_value, normal_spec, required, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    const updateById = db.prepare(
      'UPDATE test SET category = ?, name = ?, result = ?, normal_value = ?, normal_spec = ?, required = ?, sort_order = ?, parent_id = ? WHERE id = ?'
    )
    const selectById = db.prepare('SELECT id FROM test WHERE id = ?')
    const selectByKeyWithParent = db.prepare('SELECT id FROM test WHERE category = ? AND name = ? AND parent_id = ?')
    const selectByKeyRoot = db.prepare('SELECT id FROM test WHERE category = ? AND name = ? AND parent_id IS NULL')

    let inserted = 0
    let updated = 0
    for (const raw of payload) {
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

      // Normalize normal_spec: preserve text; if missing, set text
      if (typeof (raw as any).normal_spec === 'string') {
        try {
          // store as-is
          JSON.parse((raw as any).normal_spec)
          base.normal_spec = (raw as any).normal_spec
        } catch {
          // invalid JSON string; set to text
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

      // Find existing row
      let existing: { id: number } | undefined
      if (raw.id && Number.isFinite(raw.id) && raw.id > 0) {
        existing = selectById.get(raw.id) as any
      }
      if (!existing) {
        if (base.parent_id != null) {
          existing = selectByKeyWithParent.get(base.category, base.name, base.parent_id) as any
        } else {
          existing = selectByKeyRoot.get(base.category, base.name) as any
        }
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
        if (raw.id && Number.isFinite(raw.id) && raw.id > 0) {
          info = insertWithId.run(
            raw.id,
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
    return { inserted, updated, skipped: Math.max(0, payload.length - inserted - updated) }
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
